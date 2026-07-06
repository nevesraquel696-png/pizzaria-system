let PRODUTOS = { sabores: [], bordas: [], bebidas: [] };
let PRECOS_PIZZA = [];
let CARRINHO = []; // itens acumulados: { tipo_item, pizza_categoria, fatias, sabor_ids, borda_id, quantidade, _nome, _preco }
let SABOR_ATUAL = null; // sabor que abriu a ficha de produto no momento

const NOMES_CATEGORIA = { tradicional: 'Tradicional', especial: 'Especial', doce: 'Doce', promocao: 'Promoção' };
const ICONES_CATEGORIA = { tradicional: '🍕', especial: '✨', doce: '🍫', promocao: '🔥' };

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([carregarProdutos(), carregarPrecos(), carregarStatusLoja()]);
    renderizarCardapio();
    configurarEventos();
});

async function carregarProdutos() {
    try {
        const produtos = await apiFetch('/produtos?disponiveis=true');
        PRODUTOS.sabores = produtos.filter(p => p.tipo === 'sabor_pizza');
        PRODUTOS.bordas = produtos.filter(p => p.tipo === 'borda');
        PRODUTOS.bebidas = produtos.filter(p => p.tipo === 'bebida');
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
    } catch (err) {
        faixa.style.display = 'none';
    }
}

function obterPreco(categoria, fatias) {
    const item = PRECOS_PIZZA.find(p => p.categoria === categoria && Number(p.fatias) === Number(fatias));
    return item ? Number(item.preco) : null;
}

// ---------- Renderização do cardápio (catálogo por categoria -> tamanho) ----------
const FATIAS_OPCOES = [4, 6, 8, 12, 14];

function renderizarCardapio() {
    const main = document.getElementById('secoes-cardapio');
    const categorias = ['tradicional', 'especial', 'doce', 'promocao'];
    let html = '';

    categorias.forEach(cat => {
        const sabores = PRODUTOS.sabores.filter(s => s.categoria === cat);
        if (sabores.length === 0) return; // sem sabores cadastrados nessa categoria ainda

        html += `
            <section class="secao-categoria" id="secao-${cat}">
                <h2>${ICONES_CATEGORIA[cat]} ${NOMES_CATEGORIA[cat]}</h2>
                <div class="trilho-cards">
                    ${FATIAS_OPCOES.map(fatias => {
                        const preco = obterPreco(cat, fatias);
                        return `
                            <button class="card-produto" data-categoria="${cat}" data-fatias="${fatias}">
                                <div class="card-imagem">${ICONES_CATEGORIA[cat]}</div>
                                <div class="card-nome">${fatias} fatias</div>
                                ${preco !== null ? `<div class="card-preco">R$ ${preco.toFixed(2)}</div>` : ''}
                            </button>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    });

    if (PRODUTOS.bebidas.length > 0) {
        html += `
            <section class="secao-categoria" id="secao-bebidas">
                <h2>🥤 Bebidas</h2>
                <div class="trilho-cards">
                    ${PRODUTOS.bebidas.map(b => `
                        <div class="card-produto card-bebida">
                            <div class="card-imagem">🥤</div>
                            <div class="card-nome">${b.nome}</div>
                            <div class="card-preco">R$ ${Number(b.preco_base).toFixed(2)}</div>
                            <button class="btn-add-rapido" data-bebida-id="${b.id}">+ Adicionar</button>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }

    main.innerHTML = html || '<p class="erro">Nenhum item disponível no cardápio ainda.</p>';

    main.querySelectorAll('.card-produto[data-categoria]').forEach(card => {
        card.addEventListener('click', () => abrirFichaProduto(card.dataset.categoria, Number(card.dataset.fatias)));
    });
    main.querySelectorAll('.btn-add-rapido').forEach(btn => {
        btn.addEventListener('click', () => adicionarBebidaRapida(Number(btn.dataset.bebidaId)));
    });
}

// ---------- Ficha do produto (sheet) ----------
function abrirFichaProduto(categoria, fatias) {
    SABOR_ATUAL = { categoria, fatias };

    document.getElementById('sheet-imagem').textContent = ICONES_CATEGORIA[categoria];
    document.getElementById('sheet-titulo').textContent = `Pizza ${NOMES_CATEGORIA[categoria]} - ${fatias} fatias`;
    document.getElementById('qtd-valor').textContent = '1';
    atualizarPrecoSheet();

    const sabores = PRODUTOS.sabores.filter(s => s.categoria === categoria);
    const container = document.getElementById('sheet-sabores-extra');
    container.innerHTML = sabores.map((s, i) => `
        <label><input type="checkbox" name="sheet-sabor" value="${s.id}" ${i === 0 ? 'checked' : ''}> ${s.nome}</label>
    `).join('');
    container.onchange = () => {
        const marcados = container.querySelectorAll('input:checked');
        if (marcados.length > 3) {
            event.target.checked = false;
            alert('Máximo de 3 sabores por pizza.');
        }
    };

    const selectBorda = document.getElementById('sheet-borda');
    selectBorda.innerHTML = '<option value="">Sem borda</option>' + PRODUTOS.bordas.map(b =>
        `<option value="${b.id}" data-preco="${b.preco_base}">${b.nome} (+R$ ${Number(b.preco_base).toFixed(2)})</option>`
    ).join('');

    document.getElementById('sheet-fundo-produto').classList.remove('oculto');
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

function removerDoCarrinho(index) {
    CARRINHO.splice(index, 1);
    atualizarBarraCarrinho();
    renderizarCarrinho();
}

function calcularTotalCarrinho() {
    return CARRINHO.reduce((soma, item) => soma + item._preco * item.quantidade, 0);
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
    document.getElementById('carrinho-total').textContent = `R$ ${calcularTotalCarrinho().toFixed(2)}`;
}

function controlarCamposEntrega(valor) {
    document.getElementById('campos-entrega').classList.toggle('oculto', valor !== 'entrega');
}

function controlarTroco(valor) {
    document.getElementById('campo-troco').classList.toggle('oculto', valor !== 'dinheiro');
}

async function confirmarPedido() {
    const aviso = document.getElementById('aviso-carrinho');
    aviso.classList.add('oculto');

    const nome = document.getElementById('nome').value.trim();
    const tipoEntrega = document.getElementById('tipo-entrega').value;
    const telefone = document.getElementById('telefone').value.trim();
    const endereco = document.getElementById('endereco').value.trim();
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
        forma_pagamento: formaPagamento,
        troco_para: formaPagamento === 'dinheiro' ? Number(troco || 0) : 0,
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
            return { tipo_item: 'bebida', produto_id: item.produto_id, quantidade: item.quantidade };
        })
    };

    try {
        const resultado = await apiFetch('/pedidos', { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('som-confirmacao').play().catch(() => {});
        alert(`Pedido #${resultado.pedidoId} confirmado! Total: R$ ${Number(resultado.total).toFixed(2)}. Obrigado, ${nome}!`);
        window.location.reload();
    } catch (err) {
        mostrarAvisoCarrinho(err.message);
    }
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
    document.querySelectorAll('.card-produto').forEach(card => {
        const nome = card.querySelector('.card-nome').textContent.toLowerCase();
        card.style.display = nome.includes(termo) ? '' : 'none';
    });
}
