let PRODUTOS = { sabores: [], bordas: [], bebidas: [] };
let PRECOS_PIZZA = []; // [{ categoria, fatias, preco }]
let carrinho = null;

const ESTACOES = [...document.querySelectorAll('.passo[data-estacao]')];

document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([carregarProdutos(), carregarPrecos()]);
    renderizarBordas();
    renderizarBebidas();
    configurarTrilhoDeProgresso();

    document.getElementById('fatias').addEventListener('change', atualizarPrecoTamanho);
    document.getElementById('btn-adicionar-carrinho').addEventListener('click', revisarPedido);
    document.getElementById('btn-confirmar-pedido').addEventListener('click', confirmarPedido);
    document.getElementById('btn-editar-pedido').addEventListener('click', voltarParaEdicao);
});

// Trilho de progresso: observa qual "estação" (seção) está visível na tela
// e move a locomotiva + o texto "Estação X de Y" de acordo.
function configurarTrilhoDeProgresso() {
    const total = ESTACOES.length;
    const pontosContainer = document.getElementById('pontos-estacao');
    pontosContainer.innerHTML = ESTACOES.map((_, i) => {
        const pct = total > 1 ? (i / (total - 1)) * 96 + 2 : 50;
        return `<span class="ponto" style="left:${pct}%"></span>`;
    }).join('');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const index = ESTACOES.indexOf(entry.target);
                moverTrilho(index, total);
            }
        });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

    ESTACOES.forEach(secao => observer.observe(secao));
    moverTrilho(0, total);
}

function moverTrilho(index, total) {
    const pct = total > 1 ? (index / (total - 1)) * 96 + 2 : 2;
    document.getElementById('trilho-percorrido').setAttribute('x2', pct);
    document.getElementById('locomotiva').style.left = pct + '%';
    document.getElementById('estacao-atual').textContent =
        `Estação ${index + 1} de ${total} · ${ESTACOES[index].dataset.nome}`;
}

async function carregarProdutos() {
    try {
        const produtos = await apiFetch('/produtos?disponiveis=true');
        PRODUTOS.sabores = produtos.filter(p => p.tipo === 'sabor_pizza');
        PRODUTOS.bordas = produtos.filter(p => p.tipo === 'borda');
        PRODUTOS.bebidas = produtos.filter(p => p.tipo === 'bebida');
    } catch (err) {
        console.error(err);
        document.getElementById('container-sabores').innerHTML =
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

function obterPreco(categoria, fatias) {
    const item = PRECOS_PIZZA.find(p => p.categoria === categoria && Number(p.fatias) === Number(fatias));
    return item ? Number(item.preco) : null;
}

// Chamado quando o cliente escolhe a categoria (onchange no HTML)
function carregarSaboresDaCategoria() {
    const categoria = document.getElementById('categoria').value;
    const container = document.getElementById('container-sabores');

    if (!categoria) {
        container.innerHTML = '<p class="carregando">Selecione a categoria primeiro.</p>';
        return;
    }

    const saboresFiltrados = PRODUTOS.sabores.filter(s => s.categoria === categoria);
    if (saboresFiltrados.length === 0) {
        container.innerHTML = '<p class="erro">Nenhum sabor cadastrado nessa categoria ainda.</p>';
        return;
    }

    container.innerHTML = saboresFiltrados.map(s => `
        <label>
            <input type="checkbox" name="sabores" value="${s.id}" data-nome="${s.nome}">
            ${s.nome}
        </label><br>
    `).join('');

    container.onchange = () => {
        const marcados = container.querySelectorAll('input[name="sabores"]:checked');
        if (marcados.length > 3) {
            event.target.checked = false;
            alert('Máximo de 3 sabores por pizza.');
        }
    };

    atualizarPrecoTamanho();
}

function atualizarPrecoTamanho() {
    const categoria = document.getElementById('categoria').value;
    const fatias = document.getElementById('fatias').value;
    const info = document.getElementById('preco-tamanho');

    if (!categoria || !fatias) {
        info.textContent = '';
        return;
    }

    const preco = obterPreco(categoria, fatias);
    info.innerHTML = preco !== null
        ? `<span class="etiqueta-preco">R$ ${preco.toFixed(2)}</span>`
        : '<span class="erro">Preço não configurado para essa combinação. Fale com a pizzaria.</span>';
}

function renderizarBordas() {
    const select = document.getElementById('borda');
    PRODUTOS.bordas.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.dataset.nome = b.nome;
        opt.dataset.preco = b.preco_base;
        opt.textContent = `Sim - ${b.nome} (+R$ ${Number(b.preco_base).toFixed(2)})`;
        select.appendChild(opt);
    });
}

function renderizarBebidas() {
    const container = document.getElementById('container-bebidas');
    if (PRODUTOS.bebidas.length === 0) {
        container.innerHTML = '<p>Nenhuma bebida disponível no momento.</p>';
        return;
    }
    container.innerHTML = PRODUTOS.bebidas.map(b => `
        <label>
            <input type="checkbox" name="bebidas" value="${b.id}" data-nome="${b.nome}" data-preco="${b.preco_base}">
            ${b.nome} (R$ ${Number(b.preco_base).toFixed(2)})
        </label><br>
    `).join('');
}

function controlarCamposEntrega(valor) {
    const campos = document.getElementById('campos-entrega');
    const inputTelefone = document.getElementById('telefone');
    const inputEndereco = document.getElementById('endereco');

    const ehEntrega = valor === 'entrega';
    campos.style.display = ehEntrega ? 'block' : 'none';
    inputTelefone.required = ehEntrega;
    inputEndereco.required = ehEntrega;
}

function controlarTroco(valor) {
    document.getElementById('campo-troco').style.display = valor === 'dinheiro' ? 'block' : 'none';
}

function revisarPedido() {
    const nome = document.getElementById('nome').value.trim();
    const categoria = document.getElementById('categoria').value;
    const fatias = document.getElementById('fatias').value;
    const saboresMarcados = [...document.querySelectorAll('input[name="sabores"]:checked')];
    const bordaSelect = document.getElementById('borda');
    const bebidasMarcadas = [...document.querySelectorAll('input[name="bebidas"]:checked')];
    const tipoEntrega = document.getElementById('tipo-entrega').value;
    const telefone = document.getElementById('telefone').value.trim();
    const endereco = document.getElementById('endereco').value.trim();
    const formaPagamento = document.getElementById('forma-pagamento').value;
    const troco = document.getElementById('troco').value;

    if (!nome) return alert('Digite seu nome.');
    if (!categoria) return alert('Escolha a categoria da pizza.');
    if (!fatias) return alert('Escolha o tamanho da pizza.');
    if (saboresMarcados.length === 0) return alert('Escolha ao menos um sabor.');
    if (saboresMarcados.length > 3) return alert('Máximo de 3 sabores.');
    if (tipoEntrega === 'entrega' && (!telefone || !endereco)) {
        return alert('Telefone e endereço são obrigatórios para entrega.');
    }

    const precoPizza = obterPreco(categoria, fatias);
    if (precoPizza === null) return alert('Preço não configurado para essa combinação. Fale com a pizzaria.');

    const bordaId = bordaSelect.value || null;
    const precoBorda = bordaId ? Number(bordaSelect.selectedOptions[0].dataset.preco) : 0;

    const itemPizza = {
        tipo_item: 'pizza',
        pizza_categoria: categoria,
        fatias: Number(fatias),
        sabor_ids: saboresMarcados.map(s => Number(s.value)),
        borda_id: bordaId ? Number(bordaId) : null,
        quantidade: 1
    };

    const itensBebida = bebidasMarcadas.map(b => ({
        tipo_item: 'bebida',
        produto_id: Number(b.value),
        quantidade: 1
    }));

    const totalEstimado = precoPizza + precoBorda +
        bebidasMarcadas.reduce((soma, b) => soma + Number(b.dataset.preco), 0);

    carrinho = {
        cliente_nome: nome,
        telefone: tipoEntrega === 'entrega' ? telefone : (telefone || null),
        tipo_entrega: tipoEntrega,
        endereco: tipoEntrega === 'entrega' ? endereco : null,
        forma_pagamento: formaPagamento,
        troco_para: formaPagamento === 'dinheiro' ? Number(troco || 0) : 0,
        itens: [itemPizza, ...itensBebida]
    };

    mostrarResumo(totalEstimado, categoria, fatias, saboresMarcados, bordaSelect, bebidasMarcadas);
}

function mostrarResumo(total, categoria, fatias, sabores, bordaSelect, bebidas) {
    const nomesCategoria = { tradicional: 'Tradicional', especial: 'Especial', doce: 'Doce', promocao: 'Promoção' };
    const resumo = document.getElementById('resumo-conteudo');
    resumo.innerHTML = `
        <p><strong>Cliente:</strong> ${carrinho.cliente_nome}</p>
        <p><strong>Pizza:</strong> ${nomesCategoria[categoria]} - ${fatias} fatias</p>
        <p><strong>Sabores:</strong> ${sabores.map(s => s.dataset.nome).join(', ')}</p>
        <p><strong>Borda:</strong> ${bordaSelect.value ? bordaSelect.selectedOptions[0].dataset.nome : 'Sem borda'}</p>
        <p><strong>Bebidas:</strong> ${bebidas.length ? bebidas.map(b => b.dataset.nome).join(', ') : 'Nenhuma'}</p>
        <p><strong>Entrega:</strong> ${carrinho.tipo_entrega}</p>
        <p><strong>Pagamento:</strong> ${carrinho.forma_pagamento}${carrinho.troco_para > 0 ? ` (troco para R$ ${carrinho.troco_para.toFixed(2)})` : ''}</p>
    `;
    document.getElementById('resumo-total').textContent = `R$ ${total.toFixed(2)}`;

    document.getElementById('form-pedido').style.display = 'none';
    document.getElementById('resumo-pedido').style.display = 'block';
}

function voltarParaEdicao() {
    document.getElementById('form-pedido').style.display = 'block';
    document.getElementById('resumo-pedido').style.display = 'none';
}

async function confirmarPedido() {
    if (!carrinho) return;

    try {
        const resultado = await apiFetch('/pedidos', {
            method: 'POST',
            body: JSON.stringify(carrinho)
        });

        document.getElementById('som-confirmacao').play().catch(() => {
            console.log('Navegador bloqueou o autoplay do som até haver interação do usuário.');
        });

        alert(`Pedido #${resultado.pedidoId} confirmado! Total: R$ ${Number(resultado.total).toFixed(2)}. Obrigado, ${carrinho.cliente_nome}.`);
        window.location.reload();
    } catch (err) {
        const avisoFechado = document.getElementById('aviso-fechado');
        avisoFechado.style.display = 'block';
        avisoFechado.textContent = err.message.includes('Fechada')
            ? err.message
            : `Não foi possível enviar o pedido: ${err.message}`;
    }
}
