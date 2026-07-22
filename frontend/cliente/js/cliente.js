let PRODUTOS = { sabores: [], bordas: [], bebidas: [], outros: [] };
let PRECOS_PIZZA = [];
let CONFIG_LOJA = {};
let IMAGENS_TAMANHO = {}; // { 4: 'data:image/...', 6: ..., ... } - base64 vindo do banco
let CARRINHO = []; // itens acumulados: { tipo_item, pizza_categoria, fatias, sabor_ids, borda_id, quantidade, _nome, _preco }
let SABOR_ATUAL = null; // { categoria, fatias } - contexto da ficha de produto aberta no momento
let CUPOM_APLICADO = null; // { codigo, tipo, valor, desconto } - null se nenhum cupom válido aplicado

const NOMES_CATEGORIA = { tradicional: 'Tradicional', especial: 'Especial', doce: 'Doce', promocao: 'Promoção' };
const ICONES_CATEGORIA = { tradicional: 'pizza', especial: 'estrela', doce: 'gota', promocao: 'fogo' };
const CATEGORIAS_ORDEM = ['tradicional', 'especial', 'doce', 'promocao'];

document.addEventListener('DOMContentLoaded', async () => {
    aplicarIcones();
    await Promise.all([carregarProdutos(), carregarPrecos(), carregarStatusLoja(), carregarImagensTamanho()]);
    renderizarCardapio();
    configurarEventos();
});

// Preenche todo <span class="icone" data-icone="NOME"> com o SVG de icones.js
function aplicarIcones() {
    document.querySelectorAll('[data-icone]').forEach(el => {
        el.innerHTML = ICONES[el.dataset.icone] || '';
    });
}

async function carregarImagensTamanho() {
    try {
        const imagens = await apiFetch('/imagens-tamanho');
        imagens.forEach(img => {
            if (img.imagem_base64) IMAGENS_TAMANHO[img.fatias] = img.imagem_base64;
        });
    } catch (err) {
        console.error('Erro ao carregar imagens de tamanho:', err.message);
    }
}

// Retorna o HTML pra mostrar no "quadrado" do card: a foto customizada do
// admin pra esse tamanho, se existir, senão o ícone SVG padrão de pizza.
// Já vem em base64 direto do banco - não depende de nenhum arquivo em disco,
// que era o motivo da foto sumir quando o servidor reiniciava.
function iconeOuImagemTamanho(fatias) {
    if (IMAGENS_TAMANHO[fatias]) {
        return `<img src="${IMAGENS_TAMANHO[fatias]}" alt="${fatias} fatias" class="imagem-categoria-card">`;
    }
    return `<span class="icone">${ICONES.pizza}</span>`;
}

// Mesma ideia, mas pra bebidas e outros - cada produto pode ter a própria
// foto cadastrada no admin.
function iconeOuImagemProduto(produto, iconeFallback) {
    if (produto.imagem_base64) {
        return `<img src="${produto.imagem_base64}" alt="${produto.nome}" class="imagem-categoria-card">`;
    }
    return `<span class="icone">${iconeFallback}</span>`;
}

async function carregarProdutos() {
    try {
        const produtos = await apiFetch('/produtos?disponiveis=true');
        PRODUTOS.sabores = produtos.filter(p => p.tipo === 'sabor_pizza');
        PRODUTOS.bordas = produtos.filter(p => p.tipo === 'borda');
        PRODUTOS.bebidas = produtos.filter(p => p.tipo === 'bebida');
        PRODUTOS.outros = produtos.filter(p => p.tipo === 'outros');
    } catch (err) {
        document.getElementById('secoes-cardapio').innerHTML =
            `<p class="erro">Não foi possível carregar o cardápio. Verifique se o servidor está rodando.</p>`;
    }
}

async function carregarPrecos() {
    try {
        PRECOS_PIZZA = await apiFetch('/precos-pizza');
    } catch (err) {
        console.error(err);
    }
}

async function carregarStatusLoja() {
    const faixa = document.getElementById('faixa-status');
    try {
        const config = await apiFetch('/config');
        CONFIG_LOJA = config;
        const agora = new Date();
        const horaAtual = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
        const aberto = horaAtual >= config.horario_abertura && horaAtual <= config.horario_fechamento;

        if (aberto) {
            faixa.textContent = `Loja aberta · Fecha às ${config.horario_fechamento?.slice(0, 5)}`;
            faixa.classList.add('aberta');
        } else {
            faixa.textContent = `Loja fechada · Abre hoje às ${config.horario_abertura?.slice(0, 5)}`;
            faixa.classList.remove('aberta');
        }

        renderizarFaixaPromocao(config);
    } catch (err) {
        faixa.style.display = 'none';
    }
}

// Banner fixo de promoção, configurado pelo admin - só um aviso, não aplica
// desconto sozinho (desconto de verdade é via cupom).
function renderizarFaixaPromocao(config) {
    const faixa = document.getElementById('faixa-promocao');
    if (config.promocao_ativa && config.promocao_texto) {
        faixa.textContent = `📣 ${config.promocao_texto}`;
        faixa.classList.remove('oculto');
    } else {
        faixa.classList.add('oculto');
    }
}

function obterPreco(categoria, fatias) {
    const item = PRECOS_PIZZA.find(p => p.categoria === categoria && Number(p.fatias) === Number(fatias));
    return item ? Number(item.preco) : null;
}

// ---------- Renderização do cardápio ----------
// Layout: uma única seção de "Tamanhos" (lista vertical, de cima pra baixo),
// sem separar por categoria - a categoria (Tradicional/Especial/Doce/Promoção)
// só é escolhida dentro da ficha do produto, não na tela inicial.
// Bebidas e Outros sempre no final da página.
const FATIAS_OPCOES = [4, 6, 8, 12, 14];

function categoriasComSabores() {
    return CATEGORIAS_ORDEM.filter(cat => PRODUTOS.sabores.some(s => s.categoria === cat));
}

// Categoria usada como ponto de partida ao abrir a ficha do produto.
function categoriaPadrao() {
    return categoriasComSabores()[0] || CATEGORIAS_ORDEM[0];
}

function renderizarCardapio() {
    const main = document.getElementById('secoes-cardapio');
    main.innerHTML = `
        <section class="secao-categoria" id="secao-tamanhos">
            <h2><span class="icone icone-titulo-secao">${ICONES.pizza}</span> Tamanhos</h2>
            <div class="lista-linhas" id="lista-tamanhos"></div>
        </section>
        <section class="secao-categoria" id="secao-bebidas">
            <h2><span class="icone icone-titulo-secao">${ICONES.bebida}</span> Bebidas</h2>
            <div class="lista-linhas" id="lista-bebidas"></div>
        </section>
        <section class="secao-categoria" id="secao-outros">
            <h2><span class="icone icone-titulo-secao">${ICONES.ferramentas}</span> Outros</h2>
            <div class="lista-linhas" id="lista-outros"></div>
        </section>
    `;

    renderizarTamanhos();
    renderizarBebidas();
    renderizarOutros();
}

// Seção única de tamanhos: lista vertical, sem escolher categoria ainda.
// O preço mostrado é "a partir de" (o menor entre as categorias com sabor
// cadastrado pra aquele tamanho) - a categoria exata é escolhida na ficha.
function renderizarTamanhos() {
    const lista = document.getElementById('lista-tamanhos');
    const categorias = categoriasComSabores();

    if (categorias.length === 0) {
        lista.innerHTML = '<p class="carregando">Nenhum sabor cadastrado ainda.</p>';
        return;
    }

    const linhas = FATIAS_OPCOES.map(fatias => {
        const precos = categorias.map(cat => obterPreco(cat, fatias)).filter(p => p !== null);
        if (precos.length === 0) return '';
        const menorPreco = Math.min(...precos);
        return `
            <button class="linha-produto" data-fatias="${fatias}">
                <div class="linha-produto-imagem">${iconeOuImagemTamanho(fatias)}</div>
                <div class="linha-produto-info">
                    <div class="linha-produto-nome">${fatias} fatias</div>
                    <div class="linha-produto-desc">Escolha o tipo e os sabores</div>
                </div>
                <span class="card-preco">a partir de R$ ${menorPreco.toFixed(2)}</span>
                <span class="seta-linha" aria-hidden="true">›</span>
            </button>
        `;
    }).join('');

    lista.innerHTML = linhas.trim() || '<p class="carregando">Preços não configurados ainda.</p>';

    lista.querySelectorAll('.linha-produto[data-fatias]').forEach(linha => {
        linha.addEventListener('click', () => abrirFichaProduto(Number(linha.dataset.fatias)));
    });
}

function renderizarBebidas() {
    const secao = document.getElementById('secao-bebidas');
    if (PRODUTOS.bebidas.length === 0) { secao.remove(); return; }

    const lista = document.getElementById('lista-bebidas');
    lista.innerHTML = PRODUTOS.bebidas.map(b => `
        <div class="linha-produto linha-produto-simples">
            <div class="linha-produto-imagem">${iconeOuImagemProduto(b, ICONES.bebida)}</div>
            <div class="linha-produto-info"><div class="linha-produto-nome">${b.nome}</div></div>
            <span class="card-preco">R$ ${Number(b.preco_base).toFixed(2)}</span>
            <button class="btn-add-rapido" data-bebida-id="${b.id}" aria-label="Adicionar ${escapeHtml(b.nome)}"><span class="icone">${ICONES.mais}</span></button>
        </div>
    `).join('');

    lista.querySelectorAll('.btn-add-rapido').forEach(btn => {
        btn.addEventListener('click', () => adicionarBebidaRapida(Number(btn.dataset.bebidaId)));
    });
}

// "Outros" - itens do cardápio que não são pizza, borda nem bebida
// (ex: sobremesas avulsas, molhos extras). Sempre por último na página.
function renderizarOutros() {
    const secao = document.getElementById('secao-outros');
    if (!PRODUTOS.outros || PRODUTOS.outros.length === 0) { secao.remove(); return; }

    const lista = document.getElementById('lista-outros');
    lista.innerHTML = PRODUTOS.outros.map(o => `
        <div class="linha-produto linha-produto-simples">
            <div class="linha-produto-imagem">${iconeOuImagemProduto(o, ICONES.ferramentas)}</div>
            <div class="linha-produto-info"><div class="linha-produto-nome">${o.nome}</div></div>
            <span class="card-preco">R$ ${Number(o.preco_base).toFixed(2)}</span>
            <button class="btn-add-rapido" data-outro-id="${o.id}" aria-label="Adicionar ${escapeHtml(o.nome)}"><span class="icone">${ICONES.mais}</span></button>
        </div>
    `).join('');

    lista.querySelectorAll('.btn-add-rapido').forEach(btn => {
        btn.addEventListener('click', () => adicionarOutroRapido(Number(btn.dataset.outroId)));
    });
}

// ---------- Ficha do produto (sheet) ----------
// A categoria (Tradicional/Especial/Doce/Promoção) é escolhida aqui dentro,
// através das abas, não mais na tela inicial - só o tamanho vem de fora.
function abrirFichaProduto(fatias) {
    SABOR_ATUAL = { categoria: categoriaPadrao(), fatias };

    document.getElementById('qtd-valor').textContent = '1';
    renderizarAbasCategoriaSheet();
    renderizarConteudoSheet();

    const selectBorda = document.getElementById('sheet-borda');
    selectBorda.innerHTML = '<option value="">Sem borda</option>' + PRODUTOS.bordas.map(b =>
        `<option value="${b.id}" data-preco="${b.preco_base}">${b.nome} (+R$ ${Number(b.preco_base).toFixed(2)})</option>`
    ).join('');

    document.getElementById('sheet-fundo-produto').classList.remove('oculto');
}

// Abas de categoria dentro da ficha - só mostra categorias com sabor cadastrado.
function renderizarAbasCategoriaSheet() {
    const container = document.getElementById('sheet-categorias');
    const categorias = categoriasComSabores();

    container.innerHTML = categorias.map(cat => `
        <button type="button" class="pill-categoria-sheet${cat === SABOR_ATUAL.categoria ? ' ativo' : ''}" data-categoria="${cat}">${NOMES_CATEGORIA[cat]}</button>
    `).join('');

    container.querySelectorAll('.pill-categoria-sheet').forEach(pill => {
        pill.addEventListener('click', () => {
            if (pill.dataset.categoria === SABOR_ATUAL.categoria) return;
            SABOR_ATUAL.categoria = pill.dataset.categoria;
            renderizarAbasCategoriaSheet();
            renderizarConteudoSheet();
        });
    });
}

// Imagem, título, preço e lista de sabores - depende da categoria escolhida
// nas abas acima, então é chamada de novo toda vez que ela muda.
function renderizarConteudoSheet() {
    const { categoria, fatias } = SABOR_ATUAL;

    document.getElementById('sheet-imagem').innerHTML = iconeOuImagemTamanho(fatias);
    document.getElementById('sheet-titulo').textContent = `Pizza ${NOMES_CATEGORIA[categoria]} - ${fatias} fatias`;
    atualizarPrecoSheet();

    const sabores = PRODUTOS.sabores.filter(s => s.categoria === categoria);
    const container = document.getElementById('sheet-sabores-extra');
    container.innerHTML = sabores.map((s, i) => `
        <label class="opcao-sabor">
            <input type="checkbox" name="sheet-sabor" value="${s.id}" ${i === 0 ? 'checked' : ''}>
            <span>
                <strong>${s.nome}</strong>
                ${s.descricao ? `<br><small>${s.descricao}</small>` : ''}
            </span>
        </label>
    `).join('');
    container.onchange = () => {
        const marcados = container.querySelectorAll('input:checked');
        if (marcados.length > 3) {
            event.target.checked = false;
            alert('Máximo de 3 sabores por pizza.');
        }
    };
}

function atualizarPrecoSheet() {
    const { categoria, fatias } = SABOR_ATUAL;
    const preco = obterPreco(categoria, fatias);
    document.getElementById('sheet-preco').innerHTML = preco !== null
        ? `<span class="etiqueta-preco">R$ ${preco.toFixed(2)}</span>`
        : '<span class="erro">Preço não configurado.</span>';
}

function fecharFichaProduto() {
    document.getElementById('sheet-fundo-produto').classList.add('oculto');
    SABOR_ATUAL = null;
}

function adicionarAoCarrinho() {
    const { categoria, fatias } = SABOR_ATUAL;
    const precoPizza = obterPreco(categoria, fatias);
    if (precoPizza === null) return alert('Preço não configurado para essa combinação.');

    const saborIds = [...document.querySelectorAll('input[name="sheet-sabor"]:checked')].map(i => Number(i.value));
    if (saborIds.length === 0) return alert('Escolha ao menos 1 sabor.');

    const nomesSabores = saborIds.map(id => PRODUTOS.sabores.find(s => s.id === id)?.nome).join(', ');

    const bordaSelect = document.getElementById('sheet-borda');
    const bordaId = bordaSelect.value ? Number(bordaSelect.value) : null;
    const precoBorda = bordaId ? Number(bordaSelect.selectedOptions[0].dataset.preco) : 0;
    const nomeBorda = bordaId ? bordaSelect.selectedOptions[0].textContent : null;

    const quantidade = Number(document.getElementById('qtd-valor').textContent);

    CARRINHO.push({
        tipo_item: 'pizza',
        pizza_categoria: categoria,
        fatias,
        sabor_ids: saborIds,
        borda_id: bordaId,
        quantidade,
        _nome: `Pizza ${NOMES_CATEGORIA[categoria]} (${fatias} fatias) - ${nomesSabores}${nomeBorda ? ' + ' + nomeBorda : ''}`,
        _preco: precoPizza + precoBorda
    });

    fecharFichaProduto();
    atualizarBarraCarrinho();
}

function adicionarBebidaRapida(produtoId) {
    const bebida = PRODUTOS.bebidas.find(b => b.id === produtoId);
    const existente = CARRINHO.find(i => i.tipo_item === 'bebida' && i.produto_id === produtoId);
    if (existente) {
        existente.quantidade += 1;
    } else {
        CARRINHO.push({
            tipo_item: 'bebida',
            produto_id: produtoId,
            quantidade: 1,
            _nome: bebida.nome,
            _preco: Number(bebida.preco_base)
        });
    }
    atualizarBarraCarrinho();
}

function adicionarOutroRapido(produtoId) {
    const produto = PRODUTOS.outros.find(o => o.id === produtoId);
    const existente = CARRINHO.find(i => i.tipo_item === 'outros' && i.produto_id === produtoId);
    if (existente) {
        existente.quantidade += 1;
    } else {
        CARRINHO.push({
            tipo_item: 'outros',
            produto_id: produtoId,
            quantidade: 1,
            _nome: produto.nome,
            _preco: Number(produto.preco_base)
        });
    }
    atualizarBarraCarrinho();
}

function removerDoCarrinho(index) {
    CARRINHO.splice(index, 1);
    atualizarBarraCarrinho();
    renderizarCarrinho();
}

function calcularTaxaEntrega() {
    const tipoEntrega = document.getElementById('tipo-entrega').value;
    return tipoEntrega === 'entrega' ? Number(CONFIG_LOJA.taxa_entrega || 0) : 0;
}

function calcularSubtotalCarrinho() {
    return CARRINHO.reduce((soma, item) => soma + item._preco * item.quantidade, 0);
}

// Recalculado a partir do subtotal atual (não guarda um valor fixo), pra
// ficar certo mesmo se o cliente mudar o carrinho depois de aplicar o cupom.
function calcularDesconto() {
    if (!CUPOM_APLICADO) return 0;
    const subtotal = calcularSubtotalCarrinho();
    const desconto = CUPOM_APLICADO.tipo === 'percentual'
        ? subtotal * (CUPOM_APLICADO.valor / 100)
        : CUPOM_APLICADO.valor;
    return Math.min(desconto, subtotal);
}

function calcularTotalCarrinho() {
    const total = calcularSubtotalCarrinho() + calcularTaxaEntrega() - calcularDesconto();
    return Math.max(0, total);
}

function atualizarBarraCarrinho() {
    const barra = document.getElementById('barra-carrinho');
    const totalItens = CARRINHO.reduce((s, i) => s + i.quantidade, 0);

    if (totalItens === 0) {
        barra.classList.add('oculto');
        return;
    }
    barra.classList.remove('oculto');
    document.getElementById('carrinho-resumo').textContent =
        `${totalItens} ${totalItens === 1 ? 'item' : 'itens'} · R$ ${calcularTotalCarrinho().toFixed(2)}`;
}

// ---------- Carrinho / checkout ----------
function abrirCarrinho() {
    renderizarCarrinho();
    controlarInfoPix(document.getElementById('forma-pagamento').value);
    document.getElementById('sheet-fundo-carrinho').classList.remove('oculto');
}

function fecharCarrinho() {
    document.getElementById('sheet-fundo-carrinho').classList.add('oculto');
}

function renderizarCarrinho() {
    const container = document.getElementById('itens-carrinho');
    if (CARRINHO.length === 0) {
        container.innerHTML = '<p class="carregando">Carrinho vazio.</p>';
    } else {
        container.innerHTML = CARRINHO.map((item, i) => `
            <div class="linha-item-carrinho">
                <div>
                    <strong>${item.quantidade}x</strong> ${item._nome}
                    <div class="preco-item">R$ ${(item._preco * item.quantidade).toFixed(2)}</div>
                </div>
                <button class="btn-remover" onclick="removerDoCarrinho(${i})">Remover</button>
            </div>
        `).join('');
    }

    const taxa = calcularTaxaEntrega();
    const linhaTaxa = document.getElementById('linha-taxa-entrega');
    if (taxa > 0) {
        linhaTaxa.classList.remove('oculto');
        document.getElementById('valor-taxa-entrega').textContent = `R$ ${taxa.toFixed(2)}`;
    } else {
        linhaTaxa.classList.add('oculto');
    }

    const desconto = calcularDesconto();
    const linhaDesconto = document.getElementById('linha-desconto');
    if (CUPOM_APLICADO && desconto > 0) {
        linhaDesconto.classList.remove('oculto');
        document.getElementById('codigo-cupom-aplicado').textContent = CUPOM_APLICADO.codigo;
        document.getElementById('valor-desconto').textContent = `-R$ ${desconto.toFixed(2)}`;
    } else {
        linhaDesconto.classList.add('oculto');
    }

    document.getElementById('carrinho-total').textContent = `R$ ${calcularTotalCarrinho().toFixed(2)}`;
}

// Confere o cupom com o servidor e, se válido, guarda em CUPOM_APLICADO pra
// entrar no cálculo do total. O desconto de verdade é revalidado de novo no
// servidor quando o pedido é confirmado - isso aqui é só a prévia pro cliente.
async function aplicarCupom() {
    const input = document.getElementById('input-cupom');
    const codigo = input.value.trim();
    const msg = document.getElementById('mensagem-cupom');

    if (!codigo) return;

    if (CARRINHO.length === 0) {
        return exibirMensagemCupom('Adicione itens ao carrinho antes de aplicar um cupom.', false);
    }

    try {
        const resultado = await apiFetch('/cupons/validar', {
            method: 'POST',
            body: JSON.stringify({ codigo, subtotal: calcularSubtotalCarrinho() })
        });
        CUPOM_APLICADO = resultado;
        exibirMensagemCupom(`Cupom ${resultado.codigo} aplicado! -R$ ${resultado.desconto.toFixed(2)}`, true);
    } catch (err) {
        CUPOM_APLICADO = null;
        exibirMensagemCupom(err.message, false);
    }

    renderizarCarrinho();
    atualizarBarraCarrinho();
}

function exibirMensagemCupom(texto, sucesso) {
    const msg = document.getElementById('mensagem-cupom');
    msg.textContent = texto;
    msg.classList.remove('oculto', 'mensagem-cupom-sucesso', 'mensagem-cupom-erro');
    msg.classList.add(sucesso ? 'mensagem-cupom-sucesso' : 'mensagem-cupom-erro');
}

function controlarCamposEntrega(valor) {
    document.getElementById('campos-entrega').classList.toggle('oculto', valor !== 'entrega');
    renderizarCarrinho(); // a taxa de entrega muda o total, precisa recalcular na hora
}

function controlarTroco(valor) {
    document.getElementById('campo-troco').classList.toggle('oculto', valor !== 'dinheiro');
}

// Mostra a chave Pix + aviso quando o cliente escolhe pagar por Pix
function controlarInfoPix(valor) {
    const caixa = document.getElementById('info-pix');
    if (valor === 'pix') {
        document.getElementById('texto-chave-pix').textContent = CONFIG_LOJA.chave_pix || 'Chave não configurada - fale com a pizzaria';
        caixa.classList.remove('oculto');
    } else {
        caixa.classList.add('oculto');
    }
}

async function confirmarPedido() {
    const aviso = document.getElementById('aviso-carrinho');
    aviso.classList.add('oculto');

    const nome = document.getElementById('nome').value.trim();
    const tipoEntrega = document.getElementById('tipo-entrega').value;
    const telefone = document.getElementById('telefone').value.trim();
    const endereco = document.getElementById('endereco').value.trim();
    const observacoes = document.getElementById('observacoes').value.trim();
    const formaPagamento = document.getElementById('forma-pagamento').value;
    const troco = document.getElementById('troco').value;

    if (CARRINHO.length === 0) return mostrarAvisoCarrinho('Seu carrinho está vazio.');
    if (!nome) return mostrarAvisoCarrinho('Digite seu nome.');
    if (tipoEntrega === 'entrega' && (!telefone || !endereco)) {
        return mostrarAvisoCarrinho('Telefone e endereço são obrigatórios para entrega.');
    }

    const payload = {
        cliente_nome: nome,
        telefone: telefone || null,
        tipo_entrega: tipoEntrega,
        endereco: endereco || null,
        observacoes: observacoes || null,
        forma_pagamento: formaPagamento,
        troco_para: formaPagamento === 'dinheiro' ? Number(troco || 0) : 0,
        cupom_codigo: CUPOM_APLICADO ? CUPOM_APLICADO.codigo : null,
        itens: CARRINHO.map(item => {
            if (item.tipo_item === 'pizza') {
                return {
                    tipo_item: 'pizza',
                    pizza_categoria: item.pizza_categoria,
                    fatias: item.fatias,
                    sabor_ids: item.sabor_ids,
                    borda_id: item.borda_id,
                    quantidade: item.quantidade
                };
            }
            return { tipo_item: item.tipo_item, produto_id: item.produto_id, quantidade: item.quantidade };
        })
    };

    try {
        const resultado = await apiFetch('/pedidos', { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('som-confirmacao').play().catch(() => {});
        mostrarTelaSucesso(resultado, formaPagamento, nome);
    } catch (err) {
        mostrarAvisoCarrinho(err.message);
    }
}

function mostrarTelaSucesso(resultado, formaPagamento, nome) {
    fecharCarrinho();

    document.getElementById('numero-pedido-sucesso').textContent = String(resultado.pedidoId).padStart(4, '0');
    document.getElementById('texto-sucesso').textContent =
        `Obrigado, ${nome}! Total: R$ ${Number(resultado.total).toFixed(2)}.`;

    const blocoWhatsapp = document.getElementById('bloco-whatsapp-pix');
    if (formaPagamento === 'pix' && CONFIG_LOJA.whatsapp_numero) {
        const mensagem = encodeURIComponent(
            `Olá! Segue o comprovante do Pix do meu pedido #${String(resultado.pedidoId).padStart(4, '0')} na Estação da Pizza.`
        );
        document.getElementById('btn-enviar-whatsapp').href =
            `https://wa.me/55${CONFIG_LOJA.whatsapp_numero.replace(/\D/g, '')}?text=${mensagem}`;
        blocoWhatsapp.classList.remove('oculto');
    } else {
        blocoWhatsapp.classList.add('oculto');
    }

    document.getElementById('sheet-fundo-sucesso').classList.remove('oculto');
}

function copiarChavePix() {
    const chave = CONFIG_LOJA.chave_pix;
    if (!chave) return alert('Chave Pix não configurada ainda. Fale com a pizzaria.');

    navigator.clipboard.writeText(chave).then(() => {
        const btn = document.getElementById('btn-copiar-pix');
        const textoOriginal = btn.innerHTML;
        btn.textContent = 'Chave copiada!';
        setTimeout(() => { btn.innerHTML = textoOriginal; }, 2000);
    }).catch(() => {
        alert(`Não foi possível copiar automaticamente. Chave Pix: ${chave}`);
    });
}

function mostrarAvisoCarrinho(msg) {
    const aviso = document.getElementById('aviso-carrinho');
    aviso.textContent = msg;
    aviso.classList.remove('oculto');
}

// ---------- Eventos gerais ----------
function configurarEventos() {
    document.getElementById('fechar-sheet-produto').addEventListener('click', fecharFichaProduto);
    document.getElementById('btn-add-carrinho').addEventListener('click', adicionarAoCarrinho);

    document.getElementById('qtd-menos').addEventListener('click', () => {
        const el = document.getElementById('qtd-valor');
        el.textContent = Math.max(1, Number(el.textContent) - 1);
    });
    document.getElementById('qtd-mais').addEventListener('click', () => {
        const el = document.getElementById('qtd-valor');
        el.textContent = Number(el.textContent) + 1;
    });

    document.getElementById('nav-carrinho').addEventListener('click', abrirCarrinho);
    document.getElementById('barra-carrinho').addEventListener('click', abrirCarrinho);
    document.getElementById('fechar-sheet-carrinho').addEventListener('click', fecharCarrinho);
    document.getElementById('btn-confirmar-pedido').addEventListener('click', confirmarPedido);
    document.getElementById('btn-aplicar-cupom').addEventListener('click', aplicarCupom);

    document.getElementById('btn-copiar-pix').addEventListener('click', copiarChavePix);
    document.getElementById('btn-fechar-sucesso').addEventListener('click', () => window.location.reload());

    document.getElementById('nav-inicio').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    document.getElementById('btn-busca').addEventListener('click', () => {
        document.getElementById('barra-busca').classList.toggle('oculto');
        document.getElementById('input-busca').focus();
    });
    document.getElementById('input-busca').addEventListener('input', filtrarBusca);

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('ativo'));
            chip.classList.add('ativo');
            const secao = document.getElementById(`secao-${chip.dataset.cat}`);
            if (secao) secao.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function filtrarBusca() {
    const termo = document.getElementById('input-busca').value.trim().toLowerCase();
    document.querySelectorAll('.linha-produto').forEach(linha => {
        const nome = linha.querySelector('.linha-produto-nome').textContent.toLowerCase();
        linha.style.display = nome.includes(termo) ? '' : 'none';
    });
}
