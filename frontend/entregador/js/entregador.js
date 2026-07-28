// OBS: assim como a cozinha, esta tela usa o mesmo login do admin (token
// salvo no localStorage). Se quiser um login separado só pro entregador,
// crie uma tela de login própria aqui, igual à do admin, e use um usuário
// com nivel = 'entregador'.

document.addEventListener('DOMContentLoaded', () => {
    aplicarTemaSalvoEntregador();
    document.getElementById('btn-tema-claro').addEventListener('click', alternarTemaClaro);
    document.getElementById('btn-ativar-som').addEventListener('click', ativarSom);
    tentarAutoativarSom();

    if (!getToken()) {
        const msg = '<p class="erro">Faça login no painel administrativo primeiro.</p>';
        document.getElementById('lista-para-retirar').innerHTML = msg;
        document.getElementById('lista-em-rota').innerHTML = '';
        return;
    }

    conectarSocketEntregador();
    carregarPedidosEntregador();
});

// Modo claro - lembrado entre visitas via localStorage, igual à cozinha.
function aplicarTemaSalvoEntregador() {
    const claro = localStorage.getItem('pizzaria_entregador_tema_claro') === 'true';
    document.body.classList.toggle('tema-claro', claro);
    atualizarBotaoTemaEntregador(claro);
}

function alternarTemaClaro() {
    const claro = document.body.classList.toggle('tema-claro');
    localStorage.setItem('pizzaria_entregador_tema_claro', claro);
    atualizarBotaoTemaEntregador(claro);
}

function atualizarBotaoTemaEntregador(claro) {
    const btn = document.getElementById('btn-tema-claro');
    btn.querySelector('.icone').innerHTML = claro ? ICONES.lua : ICONES.sol;
    btn.lastChild.textContent = claro ? ' Modo Escuro' : ' Modo Claro';
}

// Mesmo destravamento de áudio usado na cozinha: sem isso, o navegador
// bloqueia o som que toca automaticamente quando um pedido fica pronto
// pra retirada.
function ativarSom() {
    const audio = document.getElementById('som-sino');
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        localStorage.setItem('pizzaria_entregador_som_ativado', 'true');
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

function tentarAutoativarSom() {
    if (localStorage.getItem('pizzaria_entregador_som_ativado') !== 'true') return;

    const audio = document.getElementById('som-sino');
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        marcarBotaoSomAtivado();
    }).catch(() => {});
}

function conectarSocketEntregador() {
    const socket = io(SOCKET_URL, { auth: { token: getToken() } });

    // Um pedido novo pode já nascer relevante (raro), mas o que importa
    // mesmo pro entregador é quando o status muda pra "saiu_entrega"
    // (cozinha terminou) - por isso escutamos os dois eventos.
    socket.on('novoPedido', () => carregarPedidosEntregador());
    socket.on('statusAtualizado', () => {
        document.getElementById('som-sino').play().catch(() => {});
        carregarPedidosEntregador();
    });
}

async function carregarPedidosEntregador() {
    try {
        const pedidos = await apiFetch('/pedidos');
        // O entregador só lida com pedidos do tipo "entrega" (não faz
        // sentido aparecer pedido pra retirar no balcão ou consumir no local)
        const relevantes = pedidos.filter(p => p.tipo_entrega === 'entrega' && ['saiu_entrega', 'retirado'].includes(p.status));
        renderizar(relevantes);
    } catch (err) {
        document.getElementById('lista-para-retirar').innerHTML = `<p class="erro">${err.message}</p>`;
        document.getElementById('lista-em-rota').innerHTML = '';
    }
}

function descreverItem(item) {
    if (item.tipo_item === 'pizza') {
        const nomesCategoria = { tradicional: 'Tradicional', especial: 'Especial', doce: 'Doce', promocao: 'Promoção' };
        const sabores = Array.isArray(item.sabores) ? item.sabores : (item.sabores ? JSON.parse(item.sabores) : []);
        return `${item.quantidade}x Pizza ${nomesCategoria[item.pizza_categoria] || ''} (${item.fatias} fatias) - ${escapeHtml(sabores.join(', '))}${item.borda ? ' + borda ' + escapeHtml(item.borda) : ''}`;
    }
    const nome = item.nome_item ? escapeHtml(item.nome_item) : (item.tipo_item === 'bebida' ? 'Bebida (pedido antigo)' : 'Item (pedido antigo)');
    return `${item.quantidade}x ${nome}`;
}

function montarCard(p, { emRota }) {
    const enderecoCodificado = encodeURIComponent(p.endereco || '');
    const telefoneDigitos = String(p.telefone || '').replace(/\D/g, '');

    return `
        <div class="card-entregador ${emRota ? 'em-rota' : ''}">
            <h3>Pedido #${String(p.numero_pedido_dia).padStart(4, '0')}</h3>
            <p><strong>Cliente:</strong> ${escapeHtml(p.cliente_nome)}</p>
            <p><strong>Endereço:</strong> ${escapeHtml(p.endereco) || '-'}</p>
            <p><strong>Pagamento:</strong> ${escapeHtml(p.forma_pagamento)}${p.troco_para > 0 ? ` (troco para R$ ${Number(p.troco_para).toFixed(2)})` : ''}</p>
            <p><strong>Total:</strong> R$ ${Number(p.total).toFixed(2)}</p>
            ${p.observacoes ? `<p class="observacoes-pedido"><strong>Obs:</strong> ${escapeHtml(p.observacoes)}</p>` : ''}
            <div class="itens-pedido-detalhe">
                ${(p.itens || []).map(item => `<p class="linha-item-pedido">${descreverItem(item)}</p>`).join('')}
            </div>
            <div class="linha-contato-entrega">
                ${p.endereco ? `<a href="https://www.google.com/maps/search/?api=1&query=${enderecoCodificado}" target="_blank" rel="noopener">📍 Ver rota</a>` : ''}
                ${telefoneDigitos ? `<a href="tel:${telefoneDigitos}">📞 Ligar</a>` : ''}
            </div>
            ${emRota
                ? `<button onclick="marcarEntregue(${p.id})">Entreguei</button>`
                : `<button onclick="marcarRetirado(${p.id})">Retirei</button>`}
        </div>
    `;
}

function renderizar(pedidos) {
    const paraRetirar = pedidos.filter(p => p.status === 'saiu_entrega');
    const emRota = pedidos.filter(p => p.status === 'retirado');

    const containerRetirar = document.getElementById('lista-para-retirar');
    const containerRota = document.getElementById('lista-em-rota');

    containerRetirar.innerHTML = paraRetirar.length
        ? paraRetirar.map(p => montarCard(p, { emRota: false })).join('')
        : '<p class="vazio-coluna">Nenhum pedido pronto pra retirar agora.</p>';

    containerRota.innerHTML = emRota.length
        ? emRota.map(p => montarCard(p, { emRota: true })).join('')
        : '<p class="vazio-coluna">Nenhum pedido em rota no momento.</p>';
}

// Entregador pegou o pedido na loja: sai de "Prontos para Retirar" e vai
// pra "Em Rota". Ainda não finaliza o pedido.
async function marcarRetirado(id) {
    await apiFetch(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'retirado' }) });
    carregarPedidosEntregador();
}

// Entregador entregou ao cliente: finaliza o pedido.
async function marcarEntregue(id) {
    await apiFetch(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'entregue' }) });
    carregarPedidosEntregador();
}
