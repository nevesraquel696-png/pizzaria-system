// OBS: esta tela usa o mesmo login do admin (token salvo no localStorage).
// Se quiser um login separado só para a cozinha, crie uma tela de login
// própria aqui, igual à do admin, e use um usuário com nivel = 'cozinha'.

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-ativar-som').addEventListener('click', ativarSom);
    tentarAutoativarSom();

    if (!getToken()) {
        document.getElementById('lista-cozinha').innerHTML =
            '<p class="erro">Faça login no painel administrativo primeiro.</p>';
        return;
    }

    conectarSocketCozinha();
    carregarPedidosCozinha();
});

// Mesmo destravamento de áudio usado no admin: sem isso, o navegador
// bloqueia o som que toca automaticamente quando chega um pedido novo.
function ativarSom() {
    const audio = document.getElementById('som-sino');
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        localStorage.setItem('pizzaria_som_ativado', 'true');
        marcarBotaoSomAtivado();
    }).catch(err => {
        alert('Não foi possível ativar o som: ' + err.message);
    });
}

function marcarBotaoSomAtivado() {
    const btn = document.getElementById('btn-ativar-som');
    btn.textContent = '🔔 Som Ativado ✓';
    btn.disabled = true;
}

// Tenta religar o som sozinho se você já ativou antes nesse navegador.
// Não é 100% garantido (é uma proteção do navegador), mas funciona na
// maioria das vezes depois de algumas visitas ao site.
function tentarAutoativarSom() {
    if (localStorage.getItem('pizzaria_som_ativado') !== 'true') return;

    const audio = document.getElementById('som-sino');
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        marcarBotaoSomAtivado();
    }).catch(() => {});
}

function conectarSocketCozinha() {
    const socket = io(SOCKET_URL);

    socket.on('novoPedido', () => {
        document.getElementById('som-sino').play().catch(() => {});
        carregarPedidosCozinha();
    });

    socket.on('statusAtualizado', () => carregarPedidosCozinha());
}

async function carregarPedidosCozinha() {
    try {
        const pedidos = await apiFetch('/pedidos');
        // A cozinha só precisa ver o que está pendente ou em preparo
        const relevantes = pedidos.filter(p => ['pendente', 'preparo'].includes(p.status));
        renderizar(relevantes);
    } catch (err) {
        document.getElementById('lista-cozinha').innerHTML = `<p class="erro">${err.message}</p>`;
    }
}

// Monta a descrição legível de cada item, no lugar do que sairia impresso na
// comanda (enquanto não tem impressora, a cozinha lê direto daqui).
function descreverItem(item) {
    if (item.tipo_item === 'pizza') {
        const nomesCategoria = { tradicional: 'Tradicional', especial: 'Especial', doce: 'Doce', promocao: 'Promoção' };
        const sabores = Array.isArray(item.sabores) ? item.sabores : (item.sabores ? JSON.parse(item.sabores) : []);
        return `${item.quantidade}x Pizza ${nomesCategoria[item.pizza_categoria] || ''} (${item.fatias} fatias) - ${escapeHtml(sabores.join(', '))}${item.borda ? ' + borda ' + escapeHtml(item.borda) : ''}`;
    }
    const nome = item.nome_item ? escapeHtml(item.nome_item) : (item.tipo_item === 'bebida' ? 'Bebida (pedido antigo)' : 'Item (pedido antigo)');
    return `${item.quantidade}x ${nome}`;
}

function renderizar(pedidos) {
    const container = document.getElementById('lista-cozinha');
    if (pedidos.length === 0) {
        container.innerHTML = '<p>Nenhum pedido em preparo agora.</p>';
        return;
    }

    container.innerHTML = pedidos.map(p => `
        <div class="card-cozinha">
            <h3>Pedido #${String(p.id).padStart(4, '0')}</h3>
            <p><strong>Cliente:</strong> ${escapeHtml(p.cliente_nome)}</p>
            <p><strong>Tipo:</strong> ${escapeHtml(p.tipo_entrega)}</p>
            ${p.observacoes ? `<p class="observacoes-pedido"><strong>Obs:</strong> ${escapeHtml(p.observacoes)}</p>` : ''}
            <div class="itens-pedido-detalhe">
                ${(p.itens || []).map(item => `<p class="linha-item-pedido">${descreverItem(item)}</p>`).join('')}
            </div>
            <button onclick="marcarEmPreparo(${p.id})">Iniciar Preparo</button>
            <button onclick="marcarSaiuEntrega(${p.id})">Concluído / Saiu</button>
        </div>
    `).join('');
}

async function marcarEmPreparo(id) {
    await apiFetch(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'preparo' }) });
    carregarPedidosCozinha();
}

async function marcarSaiuEntrega(id) {
    await apiFetch(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'saiu_entrega' }) });
    carregarPedidosCozinha();
}
