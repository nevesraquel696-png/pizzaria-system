// OBS: esta tela usa o mesmo login do admin (token salvo no localStorage).
// Se quiser um login separado só para a cozinha, crie uma tela de login
// própria aqui, igual à do admin, e use um usuário com nivel = 'cozinha'.

document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        document.getElementById('lista-cozinha').innerHTML =
            '<p class="erro">Faça login no painel administrativo primeiro.</p>';
        return;
    }

    conectarSocketCozinha();
    carregarPedidosCozinha();
});

function conectarSocketCozinha() {
    const socket = io('http://localhost:3000');

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

function renderizar(pedidos) {
    const container = document.getElementById('lista-cozinha');
    if (pedidos.length === 0) {
        container.innerHTML = '<p>Nenhum pedido em preparo agora.</p>';
        return;
    }

    container.innerHTML = pedidos.map(p => `
        <div class="card-cozinha">
            <h3>Pedido #${String(p.id).padStart(4, '0')}</h3>
            <p><strong>Cliente:</strong> ${p.cliente_nome}</p>
            <p><strong>Tipo:</strong> ${p.tipo_entrega}</p>
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
