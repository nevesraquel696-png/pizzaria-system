const Pedido = require('../models/Pedido');
const Produto = require('../models/Produto');
const Configuracao = require('../models/Configuracao');
const { PrecoPizza, FATIAS_VALIDAS } = require('../models/PrecoPizza');
const Cupom = require('../models/Cupom');
const Promocao = require('../models/Promocao');
const ClientePin = require('../models/ClientePin');
const validarCupom = require('../utils/validarCupom');
const { obterDiaOperacional } = require('../utils/diaOperacional');

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

    // 2) Busca tudo de uma vez: produtos por ID + tabela de preços inteira +
    // promoções envolvidas (se algum item referenciar uma)
    const [produtosEncontrados, precosPizza, promocoesEncontradas] = await Promise.all([
        Produto.buscarPorIds([...todosOsIds]),
        PrecoPizza.listarTodos(),
        Promocao.buscarPorIds([...new Set(itensRecebidos.filter(i => i.promocao_id).map(i => i.promocao_id))])
    ]);
    const produtosPorId = new Map(produtosEncontrados.map(p => [p.id, p]));
    const promocoesPorId = new Map(promocoesEncontradas.map(p => [p.id, p]));
    const buscarPreco = (categoria, fatias) => {
        const encontrado = precosPizza.find(p => p.categoria === categoria && Number(p.fatias) === Number(fatias));
        return encontrado ? Number(encontrado.preco) : null;
    };

    // 3) A partir daqui, tudo é processado em memória, sem novas consultas
    itensRecebidos.forEach((item, i) => {
        const prefixo = `Item ${i + 1}:`;

        if (item.tipo_item === 'pizza') {
            const { fatias, sabor_ids, borda_id } = item;

            if (!FATIAS_VALIDAS.includes(Number(fatias))) {
                return erros.push(`${prefixo} número de fatias inválido.`);
            }
            if (!Array.isArray(sabor_ids) || sabor_ids.length === 0 || sabor_ids.length > 3) {
                return erros.push(`${prefixo} escolha de 1 a 3 sabores.`);
            }

            // Os sabores agora podem vir de categorias diferentes (ex: 1 sabor
            // tradicional + 1 doce na mesma pizza) - não exigimos mais que
            // todos pertençam à mesma categoria enviada pelo cliente.
            const saboresValidos = sabor_ids
                .map(id => produtosPorId.get(id))
                .filter(s => s && s.tipo === 'sabor_pizza' && s.disponivel);
            if (saboresValidos.length !== sabor_ids.length) {
                return erros.push(`${prefixo} um ou mais sabores são inválidos ou não estão disponíveis.`);
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

            // Pizza de promoção: preço fixo "de/por" definido pelo admin,
            // não usa a tabela de preços por categoria. Nunca confiamos no
            // preço enviado pelo cliente - o valor de verdade vem sempre da
            // promoção buscada agora no banco.
            if (item.promocao_id) {
                const promocao = promocoesPorId.get(Number(item.promocao_id));
                if (!promocao || !promocao.ativo) {
                    return erros.push(`${prefixo} promoção inválida ou não está mais disponível.`);
                }
                if (Number(fatias) !== Number(promocao.fatias)) {
                    return erros.push(`${prefixo} tamanho não corresponde ao da promoção.`);
                }
                const idsPermitidos = promocao.sabor_ids.map(Number);
                const todosPermitidos = sabor_ids.every(id => idsPermitidos.includes(Number(id)));
                if (!todosPermitidos) {
                    return erros.push(`${prefixo} sabor fora da lista permitida para essa promoção.`);
                }

                itensProcessados.push({
                    tipo_item: 'pizza',
                    pizza_categoria: 'promocao',
                    fatias: Number(fatias),
                    sabores: saboresValidos.map(s => s.nome),
                    borda: nomeBorda,
                    nome_item: promocao.nome,
                    quantidade: item.quantidade || 1,
                    preco_unitario: Number(promocao.preco_por) + precoBorda
                });
                return;
            }

            // Regra de cobrança pra combinação "mista": vale o preço da
            // categoria mais cara entre as envolvidas na pizza. Nunca confiamos
            // na categoria enviada pelo cliente - ela é sempre derivada aqui,
            // a partir da categoria real de cada sabor (já validado no banco).
            const categoriasEnvolvidas = [...new Set(saboresValidos.map(s => s.categoria))];
            const precosPorCategoria = categoriasEnvolvidas.map(categoria => ({
                categoria,
                preco: buscarPreco(categoria, Number(fatias))
            }));
            if (precosPorCategoria.some(p => p.preco === null)) {
                return erros.push(`${prefixo} preço não configurado para essa categoria/tamanho.`);
            }
            const categoriaMaisCara = precosPorCategoria.reduce((maior, atual) =>
                atual.preco > maior.preco ? atual : maior
            );

            itensProcessados.push({
                tipo_item: 'pizza',
                pizza_categoria: categoriaMaisCara.categoria,
                fatias: Number(fatias),
                sabores: saboresValidos.map(s => s.nome),
                borda: nomeBorda,
                quantidade: item.quantidade || 1,
                preco_unitario: categoriaMaisCara.preco + precoBorda
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

    // Config buscada sempre agora (não só pra taxa de entrega): também é
    // usada pra calcular a qual dia operacional (expediente) o pedido
    // pertence - ver backend/utils/diaOperacional.js.
    const config = await Configuracao.obter();
    const diaOperacional = obterDiaOperacional(config);

    // Taxa de entrega: só se aplica quando o pedido é do tipo "entrega",
    // e o valor vem do que o admin configurou (nunca confiar em valor do cliente)
    let taxaEntrega = 0;
    if (req.body.tipo_entrega === 'entrega') {
        taxaEntrega = Number(config.taxa_entrega || 0);
    }

    // Cupom: revalidado aqui do zero (nunca confiamos no desconto que
    // vier do cliente) - se o código não existir mais ou tiver expirado
    // entre o momento em que o cliente aplicou e o de confirmar, o pedido
    // é recusado em vez de seguir sem desconto.
    let cupomAplicado = null;
    let desconto = 0;
    if (req.body.cupom_codigo) {
        const resultado = await validarCupom(req.body.cupom_codigo, subtotal);
        if (resultado.erro) {
            return { status: 400, corpo: { erro: `Cupom inválido: ${resultado.erro}` } };
        }
        cupomAplicado = resultado.cupom;
        desconto = resultado.desconto;
    }

    const total = subtotal + taxaEntrega - desconto;

    const { id: pedidoId, numero_pedido_dia: numeroPedidoDia } = await Pedido.criar({
        ...req.body,
        total,
        taxa_entrega: taxaEntrega,
        cupom_codigo: cupomAplicado ? cupomAplicado.codigo : null,
        desconto,
        itens: itensProcessados,
        dia_operacional: diaOperacional
    });

    if (cupomAplicado) {
        await Cupom.incrementarUso(cupomAplicado.id);
    }

    // Senha opcional: só cria se o cliente escolheu uma (campo criar_pin,
    // 4 dígitos) e esse telefone ainda não tem senha. Nunca obrigatório -
    // quem não quiser continua pedindo do mesmo jeito de sempre.
    if (req.body.criar_pin && req.body.telefone) {
        const digitosTelefone = String(req.body.telefone).replace(/\D/g, '');
        const pin = String(req.body.criar_pin).trim();
        if (/^\d{4}$/.test(pin) && digitosTelefone.length >= 10) {
            try {
                await ClientePin.criar(digitosTelefone, pin);
            } catch (err) {
                console.error('Erro ao criar senha do cliente:', err.message);
                // Não falha o pedido por causa disso - a senha é um extra, o
                // pedido em si já foi salvo e é o que importa de verdade.
            }
        }
    }

    const io = req.app.get('io');
    io.emit('novoPedido', {
        pedidoId,
        numeroPedidoDia,
        cliente_nome: req.body.cliente_nome,
        tipo_entrega: req.body.tipo_entrega,
        total
    });

    return { status: 201, corpo: { mensagem: mensagemSucesso, pedidoId, numeroPedidoDia, total, taxa_entrega: taxaEntrega, desconto } };
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

// Aba "Pedidos" do painel/cozinha: mostra só o expediente em curso. Reinicia
// sozinha a cada novo dia operacional - sem precisar de nenhum botão de
// "fechar o dia", é só uma questão de qual dia_operacional está em vigor
// agora (ver backend/utils/diaOperacional.js).
// Checkout do cliente: ao digitar o telefone completo, devolve nome e
// endereço do pedido mais recente feito com esse número (se existir), pra
// pré-preencher o formulário. Só aceita telefone com formato de telefone
// (10 ou 11 dígitos) - evita usarem essa rota pra tentar buscar qualquer
// string aleatória no banco.
exports.buscarClientePorTelefone = async (req, res) => {
    const digitos = String(req.params.telefone || '').replace(/\D/g, '');
    if (digitos.length < 10 || digitos.length > 11) {
        return res.status(400).json({ erro: 'Telefone inválido.' });
    }

    try {
        // Se esse telefone tem senha cadastrada, NÃO devolve nome/endereço
        // direto - só depois de confirmar a senha em /verificar-pin. Quem
        // nunca criou senha continua exatamente como antes (sem quebrar
        // nada pra quem já pediu antes dessa funcionalidade existir).
        const temSenha = await ClientePin.existe(digitos);
        if (temSenha) {
            return res.json({ requer_pin: true });
        }

        const cliente = await Pedido.buscarDadosClientePorTelefone(digitos);
        if (!cliente) return res.status(404).json({ erro: 'Nenhum pedido anterior encontrado com esse telefone.' });

        res.json({
            requer_pin: false,
            cliente_nome: cliente.cliente_nome,
            endereco: cliente.endereco,
            tipo_entrega: cliente.tipo_entrega
        });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar dados do cliente.' });
    }
};

// Confirma a senha de 4 números pra liberar nome/endereço salvos desse
// telefone. Bloqueio por tentativas erradas é controlado no próprio
// ClientePin.verificar (por telefone, não por IP - ver comentário lá).
exports.verificarPinCliente = async (req, res) => {
    const digitos = String(req.params.telefone || '').replace(/\D/g, '');
    const pin = String(req.body.pin || '').trim();

    if (digitos.length < 10 || digitos.length > 11) {
        return res.status(400).json({ erro: 'Telefone inválido.' });
    }
    if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ erro: 'Senha deve ter 4 números.' });
    }

    try {
        const confere = await ClientePin.verificar(digitos, pin);
        if (!confere) return res.status(401).json({ erro: 'Senha incorreta.' });

        const cliente = await Pedido.buscarDadosClientePorTelefone(digitos);
        res.json({
            cliente_nome: cliente?.cliente_nome || null,
            endereco: cliente?.endereco || null,
            tipo_entrega: cliente?.tipo_entrega || null
        });
    } catch (err) {
        // Mensagem de bloqueio por tentativas (vem do model) - 429 = "espere um pouco"
        res.status(429).json({ erro: err.message });
    }
};

exports.listarPedidos = async (req, res) => {
    try {
        const config = await Configuracao.obter();
        const diaOperacional = obterDiaOperacional(config);
        const pedidos = await Pedido.listarPorDiaOperacional(diaOperacional);
        res.json(pedidos);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar pedidos.' });
    }
};

// Histórico: lista os dias com movimento (mais recente primeiro), com
// contagem de pedidos e total faturado de cada um - usado pra montar o
// seletor de dias na aba "Histórico" do admin.
exports.listarDiasHistorico = async (req, res) => {
    try {
        const dias = await Pedido.listarDiasComPedidos();
        res.json(dias);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar histórico de dias.' });
    }
};

// Histórico: pedidos completos de um dia operacional específico (formato
// YYYY-MM-DD), pra quando o admin abre um dia no seletor.
exports.listarPedidosPorDia = async (req, res) => {
    const { dia } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
        return res.status(400).json({ erro: 'Data inválida. Use o formato AAAA-MM-DD.' });
    }

    try {
        const pedidos = await Pedido.listarPorDiaOperacional(dia);
        res.json(pedidos);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar pedidos do dia.' });
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
