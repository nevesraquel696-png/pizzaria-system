const Pedido = require('../models/Pedido');
const Produto = require('../models/Produto');
const Configuracao = require('../models/Configuracao');
const { PrecoPizza, CATEGORIAS_VALIDAS, FATIAS_VALIDAS } = require('../models/PrecoPizza');

// Validação estrutural básica do corpo do pedido (antes de calcular preços)
function validarEstrutura(body) {
    const erros = [];
    const { cliente_nome, tipo_entrega, forma_pagamento, itens } = body;

    if (!cliente_nome || cliente_nome.trim().length < 2) erros.push('Nome do cliente é obrigatório.');
    if (!['local', 'retirada', 'entrega'].includes(tipo_entrega)) erros.push('Tipo de entrega inválido.');
    if (!['pix', 'cartao', 'dinheiro'].includes(forma_pagamento)) erros.push('Forma de pagamento inválida.');
    if (tipo_entrega === 'entrega' && (!body.telefone || !body.endereco)) {
        erros.push('Telefone e endereço são obrigatórios para entrega.');
    }
    if (!Array.isArray(itens) || itens.length === 0) erros.push('O pedido precisa ter ao menos um item.');

    return erros;
}

// Calcula o preço de cada item NO SERVIDOR - nunca confiamos em preço/total
// enviado pelo cliente, senão qualquer pessoa poderia forjar um pedido de R$0,01.
//
// OTIMIZAÇÃO: em vez de consultar o banco várias vezes por item (uma consulta
// esperando a outra terminar), buscamos TODOS os produtos e TODOS os preços
// de uma vez só, no início, e depois só usamos esses dados já carregados em
// memória. Isso é importante porque o banco (TiDB Cloud) e o servidor (Render)
// ficam em datacenters diferentes - cada consulta extra soma um tempo de
// ida-e-volta pela rede, e isso deixava pedidos com vários itens bem lentos.
async function processarItens(itensRecebidos) {
    const erros = [];
    const itensProcessados = [];

    // 1) Descobre todos os IDs de produto envolvidos no pedido inteiro
    const todosOsIds = new Set();
    itensRecebidos.forEach(item => {
        if (item.tipo_item === 'pizza') {
            (item.sabor_ids || []).forEach(id => todosOsIds.add(id));
            if (item.borda_id) todosOsIds.add(item.borda_id);
        } else if (item.produto_id) {
            todosOsIds.add(item.produto_id);
        }
    });

    // 2) Busca tudo de uma vez: produtos por ID + tabela de preços inteira
    const [produtosEncontrados, precosPizza] = await Promise.all([
        Produto.buscarPorIds([...todosOsIds]),
        PrecoPizza.listarTodos()
    ]);
    const produtosPorId = new Map(produtosEncontrados.map(p => [p.id, p]));
    const buscarPreco = (categoria, fatias) => {
        const encontrado = precosPizza.find(p => p.categoria === categoria && Number(p.fatias) === Number(fatias));
        return encontrado ? Number(encontrado.preco) : null;
    };

    // 3) A partir daqui, tudo é processado em memória, sem novas consultas
    itensRecebidos.forEach((item, i) => {
        const prefixo = `Item ${i + 1}:`;

        if (item.tipo_item === 'pizza') {
            const { pizza_categoria, fatias, sabor_ids, borda_id } = item;

            if (!CATEGORIAS_VALIDAS.includes(pizza_categoria)) {
                return erros.push(`${prefixo} categoria de pizza inválida.`);
            }
            if (!FATIAS_VALIDAS.includes(Number(fatias))) {
                return erros.push(`${prefixo} número de fatias inválido.`);
            }
            if (!Array.isArray(sabor_ids) || sabor_ids.length === 0 || sabor_ids.length > 3) {
                return erros.push(`${prefixo} escolha de 1 a 3 sabores.`);
            }

            const saboresValidos = sabor_ids
                .map(id => produtosPorId.get(id))
                .filter(s => s && s.tipo === 'sabor_pizza' && s.categoria === pizza_categoria && s.disponivel);
            if (saboresValidos.length !== sabor_ids.length) {
                return erros.push(`${prefixo} um ou mais sabores são inválidos ou não estão disponíveis nessa categoria.`);
            }

            let precoBorda = 0;
            let nomeBorda = null;
            if (borda_id) {
                const borda = produtosPorId.get(borda_id);
                if (!borda || borda.tipo !== 'borda' || !borda.disponivel) {
                    return erros.push(`${prefixo} borda inválida ou indisponível.`);
                }
                precoBorda = Number(borda.preco_base);
                nomeBorda = borda.nome;
            }

            const precoPizza = buscarPreco(pizza_categoria, Number(fatias));
            if (precoPizza === null) {
                return erros.push(`${prefixo} preço não configurado para essa categoria/tamanho.`);
            }

            itensProcessados.push({
                tipo_item: 'pizza',
                pizza_categoria,
                fatias: Number(fatias),
                sabores: saboresValidos.map(s => s.nome),
                borda: nomeBorda,
                quantidade: item.quantidade || 1,
                preco_unitario: precoPizza + precoBorda
            });

        } else if (item.tipo_item === 'bebida' || item.tipo_item === 'outros') {
            const produto = produtosPorId.get(item.produto_id);
            if (!produto || !produto.disponivel || !['bebida', 'outros'].includes(produto.tipo)) {
                return erros.push(`${prefixo} produto inválido ou indisponível.`);
            }

            itensProcessados.push({
                tipo_item: produto.tipo,
                nome_item: produto.nome,
                quantidade: item.quantidade || 1,
                preco_unitario: Number(produto.preco_base)
            });

        } else {
            erros.push(`${prefixo} tipo de item inválido.`);
        }
    });

    return { erros, itensProcessados };
}

// Lógica compartilhada entre o pedido do cliente e o pedido criado pelo admin
async function processarECriarPedido(req, mensagemSucesso) {
    const { erros, itensProcessados } = await processarItens(req.body.itens);
    if (erros.length > 0) {
        return { status: 400, corpo: { erro: 'Itens do pedido inválidos', detalhes: erros } };
    }

    const subtotal = itensProcessados.reduce((soma, item) => soma + item.preco_unitario * item.quantidade, 0);

    // Taxa de entrega: só se aplica quando o pedido é do tipo "entrega",
    // e o valor vem do que o admin configurou (nunca confiar em valor do cliente)
    let taxaEntrega = 0;
    if (req.body.tipo_entrega === 'entrega') {
        const config = await Configuracao.obter();
        taxaEntrega = Number(config.taxa_entrega || 0);
    }

    const total = subtotal + taxaEntrega;

    const pedidoId = await Pedido.criar({ ...req.body, total, taxa_entrega: taxaEntrega, itens: itensProcessados });

    const io = req.app.get('io');
    io.emit('novoPedido', {
        pedidoId,
        cliente_nome: req.body.cliente_nome,
        tipo_entrega: req.body.tipo_entrega,
        total
    });

    return { status: 201, corpo: { mensagem: mensagemSucesso, pedidoId, total, taxa_entrega: taxaEntrega } };
}

exports.criarPedido = async (req, res) => {
    const errosEstrutura = validarEstrutura(req.body);
    if (errosEstrutura.length > 0) {
        return res.status(400).json({ erro: 'Dados do pedido inválidos', detalhes: errosEstrutura });
    }

    try {
        const { status, corpo } = await processarECriarPedido(req, 'Pedido realizado com sucesso!');
        res.status(status).json(corpo);
    } catch (err) {
        console.error('Erro ao criar pedido:', err.message);
        res.status(500).json({ erro: 'Erro ao salvar o pedido.' });
    }
};

// Mesma lógica do pedido do cliente, mas usada pelo painel admin:
// não é bloqueada pelo horário de funcionamento, pois o atendente pode
// precisar lançar um pedido feito por telefone mesmo fora do horário
// "oficial" (ex: fechando exceção para um cliente).
exports.criarPedidoAdmin = async (req, res) => {
    const errosEstrutura = validarEstrutura(req.body);
    if (errosEstrutura.length > 0) {
        return res.status(400).json({ erro: 'Dados do pedido inválidos', detalhes: errosEstrutura });
    }

    try {
        const { status, corpo } = await processarECriarPedido(req, 'Pedido criado com sucesso pelo painel!');
        res.status(status).json(corpo);
    } catch (err) {
        console.error('Erro ao criar pedido (admin):', err.message);
        res.status(500).json({ erro: 'Erro ao salvar o pedido.' });
    }
};

exports.listarPedidos = async (req, res) => {
    try {
        const pedidos = await Pedido.listarTodos();
        res.json(pedidos);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
    }
};

exports.buscarPedido = async (req, res) => {
    try {
        const pedido = await Pedido.buscarPorId(req.params.id);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });
        res.json(pedido);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar pedido.' });
    }
};

exports.atualizarStatus = async (req, res) => {
    try {
        await Pedido.atualizarStatus(req.params.id, req.body.status);

        const io = req.app.get('io');
        io.emit('statusAtualizado', { pedidoId: req.params.id, status: req.body.status });

        res.json({ mensagem: 'Status atualizado com sucesso.' });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
};

exports.reimprimir = async (req, res) => {
    try {
        const pedido = await Pedido.buscarPorId(req.params.id);
        if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

        await Pedido.incrementarImpressao(req.params.id);

        // A geração real da impressão fica no módulo /printer (ESC/POS)
        res.json({ mensagem: 'Comanda enviada para reimpressão.', pedido });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao reimprimir comanda.' });
    }
};

exports.excluirPedido = async (req, res) => {
    try {
        await Pedido.excluir(req.params.id);
        res.json({ mensagem: 'Pedido excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao excluir pedido.' });
    }
};
