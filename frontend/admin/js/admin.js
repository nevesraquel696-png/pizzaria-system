let socket = null;
let PRODUTOS_ADMIN = { sabores: [], bordas: [], bebidas: [] };
let PRECOS_ADMIN = [];

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('btn-salvar-horario').addEventListener('click', salvarHorario);
    document.getElementById('btn-salvar-precos').addEventListener('click', salvarPrecos);
    document.getElementById('btn-lancar-pedido').addEventListener('click', lancarPedidoAdmin);

    document.querySelectorAll('.aba-btn').forEach(btn => {
        btn.addEventListener('click', () => trocarAba(btn.dataset.aba));
    });

    if (getToken()) iniciarPainel();
});

function trocarAba(aba) {
    document.querySelectorAll('.aba-conteudo').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.aba-btn').forEach(el => el.classList.remove('ativa'));
    document.getElementById(`aba-${aba}`).style.display = 'block';
    document.querySelector(`.aba-btn[data-aba="${aba}"]`).classList.add('ativa');
}

// ---------- Login ----------
async function login() {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const erroEl = document.getElementById('login-erro');
    erroEl.style.display = 'none';

    try {
        const resp = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
        localStorage.setItem('pizzaria_token', resp.token);
        iniciarPainel();
    } catch (err) {
        erroEl.textContent = err.message;
        erroEl.style.display = 'block';
    }
}

function logout() {
    localStorage.removeItem('pizzaria_token');
    if (socket) socket.disconnect();
    document.getElementById('painel').style.display = 'none';
    document.getElementById('tela-login').style.display = 'flex';
}

async function iniciarPainel() {
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel').style.display = 'block';

    conectarSocket();
    await carregarProdutosAdmin();
    await carregarPrecosAdmin();
    await carregarHorario();
    await carregarPedidos();
    renderizarCardapio(await apiFetch('/produtos'));
    renderizarTabelaPrecos();
    renderizarBebidasAdmin();
    document.getElementById('adm-borda').innerHTML =
        '<option value="">Sem borda</option>' +
        PRODUTOS_ADMIN.bordas.map(b => `<option value="${b.id}" data-preco="${b.preco_base}">${b.nome} (+R$ ${Number(b.preco_base).toFixed(2)})</option>`).join('');
}

function conectarSocket() {
    socket = io('http://localhost:3000');

    socket.on('novoPedido', (dadosDoPedido) => {
        document.getElementById('som-sino').play().catch(() => {});
        alert(`Novo Pedido de ${dadosDoPedido.cliente_nome}! Tipo: ${dadosDoPedido.tipo_entrega}`);
        executarImpressao(dadosDoPedido);
        carregarPedidos();
    });

    socket.on('statusAtualizado', () => carregarPedidos());
}

function executarImpressao(pedido) {
    const numeroCopias = pedido.tipo_entrega === 'entrega' ? 2 : 1;
    for (let i = 0; i < numeroCopias; i++) {
        console.log(`Imprimindo via ${i + 1} do pedido: ${pedido.pedidoId}`);
    }
}

// ---------- Horário ----------
async function carregarHorario() {
    const config = await apiFetch('/config');
    document.getElementById('abertura').value = config.horario_abertura?.slice(0, 5);
    document.getElementById('fechamento').value = config.horario_fechamento?.slice(0, 5);
}

async function salvarHorario() {
    const horario_abertura = document.getElementById('abertura').value + ':00';
    const horario_fechamento = document.getElementById('fechamento').value + ':00';
    try {
        await apiFetch('/config', { method: 'PUT', body: JSON.stringify({ horario_abertura, horario_fechamento }) });
        alert('Horário atualizado com sucesso!');
    } catch (err) {
        alert('Erro ao salvar horário: ' + err.message);
    }
}

// ---------- Pedidos ----------
async function carregarPedidos() {
    try {
        const pedidos = await apiFetch('/pedidos');
        renderizarPedidos(pedidos);
    } catch (err) {
        document.getElementById('lista-pedidos').innerHTML = `<p class="erro">${err.message}</p>`;
    }
}

function renderizarPedidos(pedidos) {
    const container = document.getElementById('lista-pedidos');
    if (pedidos.length === 0) {
        container.innerHTML = '<p>Nenhum pedido ainda.</p>';
        return;
    }

    container.innerHTML = pedidos.map(p => `
        <div class="card-pedido">
            <h4>Pedido #${String(p.id).padStart(4, '0')} - Cliente: ${p.cliente_nome}</h4>
            <p><strong>Tipo:</strong> ${p.tipo_entrega} | <strong>Pagamento:</strong> ${p.forma_pagamento}
               ${p.troco_para > 0 ? ` (Troco para R$${Number(p.troco_para).toFixed(2)})` : ''}</p>
            <p><strong>Total:</strong> R$ ${Number(p.total).toFixed(2)}</p>

            <div class="acoes-pedido">
                <label>Status:
                    <select onchange="mudarStatus(${p.id}, this.value)">
                        <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="preparo" ${p.status === 'preparo' ? 'selected' : ''}>Em Preparo</option>
                        <option value="saiu_entrega" ${p.status === 'saiu_entrega' ? 'selected' : ''}>Saiu para Entrega</option>
                        <option value="entregue" ${p.status === 'entregue' ? 'selected' : ''}>Já foi Entregue</option>
                    </select>
                </label>
                <button onclick="reimprimirComanda(${p.id})">🖨️ Reimprimir Comanda</button>
            </div>
        </div>
    `).join('');
}

async function mudarStatus(id, status) {
    try {
        await apiFetch(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } catch (err) {
        alert('Erro ao atualizar status: ' + err.message);
    }
}

async function reimprimirComanda(id) {
    try {
        const resultado = await apiFetch(`/pedidos/${id}/reimprimir`, { method: 'POST' });
        executarImpressao({ ...resultado.pedido, pedidoId: id });
        alert('Comanda enviada para reimpressão.');
    } catch (err) {
        alert('Erro ao reimprimir: ' + err.message);
    }
}

// ---------- Criar pedido pelo admin ----------
async function carregarProdutosAdmin() {
    const produtos = await apiFetch('/produtos?disponiveis=true');
    PRODUTOS_ADMIN.sabores = produtos.filter(p => p.tipo === 'sabor_pizza');
    PRODUTOS_ADMIN.bordas = produtos.filter(p => p.tipo === 'borda');
    PRODUTOS_ADMIN.bebidas = produtos.filter(p => p.tipo === 'bebida');
}

async function carregarPrecosAdmin() {
    PRECOS_ADMIN = await apiFetch('/precos-pizza');
}

function obterPrecoAdmin(categoria, fatias) {
    const item = PRECOS_ADMIN.find(p => p.categoria === categoria && Number(p.fatias) === Number(fatias));
    return item ? Number(item.preco) : null;
}

function carregarSaboresAdmin() {
    const categoria = document.getElementById('adm-categoria').value;
    const container = document.getElementById('adm-container-sabores');

    if (!categoria) {
        container.innerHTML = '<p class="carregando">Selecione a categoria primeiro.</p>';
        return;
    }

    const sabores = PRODUTOS_ADMIN.sabores.filter(s => s.categoria === categoria);
    if (sabores.length === 0) {
        container.innerHTML = '<p class="erro">Nenhum sabor cadastrado nessa categoria.</p>';
        return;
    }

    container.innerHTML = '<p><strong>Sabores (até 3):</strong></p>' + sabores.map(s => `
        <label><input type="checkbox" name="adm-sabores" value="${s.id}"> ${s.nome}</label><br>
    `).join('');

    container.onchange = () => {
        const marcados = container.querySelectorAll('input[name="adm-sabores"]:checked');
        if (marcados.length > 3) {
            event.target.checked = false;
            alert('Máximo de 3 sabores por pizza.');
        }
    };

    atualizarPrecoAdmin();
}

function atualizarPrecoAdmin() {
    const categoria = document.getElementById('adm-categoria').value;
    const fatias = document.getElementById('adm-fatias').value;
    const info = document.getElementById('adm-preco-tamanho');
    if (!categoria || !fatias) { info.textContent = ''; return; }

    const preco = obterPrecoAdmin(categoria, fatias);
    info.textContent = preco !== null ? `Preço da pizza: R$ ${preco.toFixed(2)}` : 'Preço não configurado.';
}

function renderizarBebidasAdmin() {
    const container = document.getElementById('adm-container-bebidas');
    if (PRODUTOS_ADMIN.bebidas.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = '<p><strong>Bebidas:</strong></p>' + PRODUTOS_ADMIN.bebidas.map(b => `
        <label><input type="checkbox" name="adm-bebidas" value="${b.id}" data-preco="${b.preco_base}"> ${b.nome} (R$ ${Number(b.preco_base).toFixed(2)})</label><br>
    `).join('');
}

function controlarCamposEntregaAdmin(valor) {
    document.getElementById('adm-campos-entrega').style.display = valor === 'entrega' ? 'block' : 'none';
}

function controlarTrocoAdmin(valor) {
    document.getElementById('adm-campo-troco').style.display = valor === 'dinheiro' ? 'block' : 'none';
}

async function lancarPedidoAdmin() {
    const nome = document.getElementById('adm-nome').value.trim();
    const categoria = document.getElementById('adm-categoria').value;
    const fatias = document.getElementById('adm-fatias').value;
    const saboresMarcados = [...document.querySelectorAll('input[name="adm-sabores"]:checked')];
    const bordaSelect = document.getElementById('adm-borda');
    const bebidasMarcadas = [...document.querySelectorAll('input[name="adm-bebidas"]:checked')];
    const tipoEntrega = document.getElementById('adm-tipo-entrega').value;
    const telefone = document.getElementById('adm-telefone').value.trim();
    const endereco = document.getElementById('adm-endereco').value.trim();
    const formaPagamento = document.getElementById('adm-forma-pagamento').value;
    const troco = document.getElementById('adm-troco').value;

    if (!nome) return alert('Digite o nome do cliente.');
    if (!categoria || !fatias) return alert('Escolha categoria e tamanho da pizza.');
    if (saboresMarcados.length === 0) return alert('Escolha ao menos um sabor.');
    if (tipoEntrega === 'entrega' && (!telefone || !endereco)) return alert('Telefone e endereço são obrigatórios para entrega.');

    const payload = {
        cliente_nome: nome,
        telefone: telefone || null,
        tipo_entrega: tipoEntrega,
        endereco: endereco || null,
        forma_pagamento: formaPagamento,
        troco_para: formaPagamento === 'dinheiro' ? Number(troco || 0) : 0,
        itens: [
            {
                tipo_item: 'pizza',
                pizza_categoria: categoria,
                fatias: Number(fatias),
                sabor_ids: saboresMarcados.map(s => Number(s.value)),
                borda_id: bordaSelect.value ? Number(bordaSelect.value) : null,
                quantidade: 1
            },
            ...bebidasMarcadas.map(b => ({ tipo_item: 'bebida', produto_id: Number(b.value), quantidade: 1 }))
        ]
    };

    try {
        const resultado = await apiFetch('/pedidos/admin', { method: 'POST', body: JSON.stringify(payload) });
        alert(`Pedido #${resultado.pedidoId} lançado com sucesso! Total: R$ ${Number(resultado.total).toFixed(2)}`);
        document.getElementById('form-pedido-admin').reset();
        document.getElementById('adm-container-sabores').innerHTML = '<p class="carregando">Selecione a categoria primeiro.</p>';
        carregarPedidos();
        trocarAba('pedidos');
    } catch (err) {
        alert('Erro ao lançar pedido: ' + err.message);
    }
}

// ---------- Cardápio ----------
function alternarCampoCategoria() {
    const tipo = document.getElementById('prod-tipo').value;
    document.getElementById('campo-categoria-produto').style.display = tipo === 'sabor_pizza' ? 'block' : 'none';
    document.getElementById('campo-preco-produto').style.display = tipo === 'sabor_pizza' ? 'none' : 'block';
}

function renderizarCardapio(produtos) {
    const lista = document.getElementById('lista-produtos-cardapio');
    if (produtos.length === 0) {
        lista.innerHTML = '<li>Nenhum produto cadastrado.</li>';
        return;
    }

    lista.innerHTML = produtos.map(p => `
        <li class="item-cardapio">
            <span>${p.nome} (${p.tipo}${p.categoria ? ' - ' + p.categoria : ''})</span>
            <div>
                <label>
                    <input type="checkbox" ${p.disponivel ? 'checked' : ''} onchange="alternarDisponibilidade(${p.id})">
                    Disponível
                </label>
                <button onclick="excluirProduto(${p.id})" class="btn-excluir">X</button>
            </div>
        </li>
    `).join('');
}

async function adicionarProduto() {
    const nome = document.getElementById('prod-nome').value.trim();
    const tipo = document.getElementById('prod-tipo').value;
    const categoria = document.getElementById('prod-categoria').value;
    const preco_base = document.getElementById('prod-preco').value;

    if (!nome) return alert('Digite o nome do produto.');

    try {
        await apiFetch('/produtos', {
            method: 'POST',
            body: JSON.stringify({ nome, tipo, categoria, preco_base: Number(preco_base || 0) })
        });
        document.getElementById('prod-nome').value = '';
        document.getElementById('prod-preco').value = '';
        renderizarCardapio(await apiFetch('/produtos'));
        await carregarProdutosAdmin(); // atualiza cache usado no "criar pedido"
    } catch (err) {
        alert('Erro ao cadastrar produto: ' + err.message);
    }
}

async function alternarDisponibilidade(id) {
    try {
        await apiFetch(`/produtos/${id}/disponibilidade`, { method: 'PATCH' });
        await carregarProdutosAdmin();
    } catch (err) {
        alert('Erro ao alterar disponibilidade: ' + err.message);
    }
}

async function excluirProduto(id) {
    if (!confirm('Deseja realmente excluir este item do cardápio?')) return;
    try {
        await apiFetch(`/produtos/${id}`, { method: 'DELETE' });
        renderizarCardapio(await apiFetch('/produtos'));
        await carregarProdutosAdmin();
    } catch (err) {
        alert('Erro ao excluir produto: ' + err.message);
    }
}

// ---------- Grade de preços ----------
function renderizarTabelaPrecos() {
    const categorias = [
        { chave: 'tradicional', nome: 'Tradicional' },
        { chave: 'especial', nome: 'Especial' },
        { chave: 'doce', nome: 'Doce' },
        { chave: 'promocao', nome: 'Promoção' }
    ];
    const fatiasList = [4, 6, 8, 12, 14];

    const corpo = document.getElementById('corpo-tabela-precos');
    corpo.innerHTML = categorias.map(cat => `
        <tr>
            <td>${cat.nome}</td>
            ${fatiasList.map(f => {
                const preco = obterPrecoAdmin(cat.chave, f);
                return `<td><input type="number" step="0.01" data-categoria="${cat.chave}" data-fatias="${f}" value="${preco !== null ? preco : 0}"></td>`;
            }).join('')}
        </tr>
    `).join('');
}

async function salvarPrecos() {
    const inputs = document.querySelectorAll('#corpo-tabela-precos input');
    const precos = [...inputs].map(input => ({
        categoria: input.dataset.categoria,
        fatias: Number(input.dataset.fatias),
        preco: Number(input.value)
    }));

    try {
        await apiFetch('/precos-pizza', { method: 'PUT', body: JSON.stringify({ precos }) });
        alert('Preços atualizados com sucesso!');
        await carregarPrecosAdmin();
    } catch (err) {
        alert('Erro ao salvar preços: ' + err.message);
    }
}
