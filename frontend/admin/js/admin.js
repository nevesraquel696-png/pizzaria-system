let socket = null;
let PRODUTOS_ADMIN = { sabores: [], bordas: [], bebidas: [] };
let PRECOS_ADMIN = [];

// Preenche todo elemento <span class="icone" data-icone="NOME"> com o SVG
// correspondente definido em icones.js. Usado pra ícones fixos no HTML;
// conteúdo gerado dinamicamente (cards de pedido, etc) injeta o SVG direto.
function aplicarIcones() {
    document.querySelectorAll('[data-icone]').forEach(el => {
        el.innerHTML = ICONES[el.dataset.icone] || '';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    aplicarIcones();

    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('btn-salvar-config').addEventListener('click', salvarConfiguracoes);
    document.getElementById('btn-salvar-precos').addEventListener('click', salvarPrecos);
    document.getElementById('btn-lancar-pedido').addEventListener('click', lancarPedidoAdmin);
    document.getElementById('btn-ativar-som').addEventListener('click', ativarSom);

    document.querySelectorAll('.aba-btn').forEach(btn => {
        btn.addEventListener('click', () => trocarAba(btn.dataset.aba));
    });

    document.querySelectorAll('.chip-admin').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip-admin').forEach(c => c.classList.remove('ativo'));
            chip.classList.add('ativo');
            FILTRO_CARDAPIO_ATUAL = chip.dataset.filtro;
            aplicarFiltroCardapio();
        });
    });
    document.getElementById('busca-cardapio-admin').addEventListener('input', aplicarFiltroCardapio);

    if (getToken()) iniciarPainel();
});

// O navegador bloqueia som tocado automaticamente (ex: quando chega um pedido
// novo via socket, sem nenhum clique). Esse botão "destrava" o áudio: ao ser
// clicado (uma ação real do usuário), tocamos e pausamos imediatamente, o que
// libera esse elemento de áudio pra tocar sozinho pelo resto da sessão.
function ativarSom() {
    const audio = document.getElementById('som-sino');
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        localStorage.setItem('pizzaria_som_ativado', 'true'); // lembra pra próxima vez
        marcarBotaoSomAtivado();
    }).catch(err => {
        alert('Não foi possível ativar o som: ' + err.message);
    });
}

function marcarBotaoSomAtivado() {
    const btn = document.getElementById('btn-ativar-som');
    btn.innerHTML = `<span class="icone">${ICONES.sino}</span> Som Ativado ✓`;
    btn.disabled = true;
}

// Ao recarregar a página, se você já ativou o som antes nesse navegador,
// tentamos religar sozinho. Isso funciona na maioria das vezes depois de
// algumas visitas (o navegador aprende a confiar no site), mas não é 100%
// garantido - é uma proteção de segurança do próprio navegador, não do
// nosso site. Se falhar, o botão continua disponível pra clicar de novo.
function tentarAutoativarSom() {
    if (localStorage.getItem('pizzaria_som_ativado') !== 'true') return;

    const audio = document.getElementById('som-sino');
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        marcarBotaoSomAtivado();
    }).catch(() => {
        // Navegador ainda bloqueou dessa vez - botão continua ativo pra clicar manualmente.
    });
}

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
    document.getElementById('painel').style.display = 'flex';

    conectarSocket();
    tentarAutoativarSom();
    configurarImpressaoAutomatica();

    // Antes cada informação era buscada em sequência (uma esperando a outra
    // terminar). Como são chamadas independentes, agora buscamos tudo ao
    // mesmo tempo - o painel carrega no tempo da requisição mais lenta,
    // não na soma de todas.
    await Promise.all([
        tentarCarregar(carregarProdutosAdmin, 'produtos'),
        tentarCarregar(carregarPrecosAdmin, 'preços'),
        tentarCarregar(carregarConfiguracoes, 'configurações'),
        tentarCarregar(carregarImagensCategoria, 'imagens'),
        tentarCarregar(carregarPedidos, 'pedidos'),
        tentarCarregar(async () => {
            renderizarCardapio(await apiFetch('/produtos'));
        }, 'cardápio')
    ]);

    renderizarTabelaPrecos();
    renderizarBebidasAdmin();
    document.getElementById('adm-borda').innerHTML =
        '<option value="">Sem borda</option>' +
        PRODUTOS_ADMIN.bordas.map(b => `<option value="${b.id}" data-preco="${b.preco_base}">${b.nome} (+R$ ${Number(b.preco_base).toFixed(2)})</option>`).join('');
}

async function tentarCarregar(fn, nomeParaErro) {
    try {
        await fn();
    } catch (err) {
        console.error(`Erro ao carregar ${nomeParaErro}:`, err.message);
    }
}

function conectarSocket() {
    socket = io(SOCKET_URL);

    socket.on('novoPedido', (dadosDoPedido) => {
        document.getElementById('som-sino').play().catch(() => {});
        mostrarToast(`Novo pedido de ${dadosDoPedido.cliente_nome} (${dadosDoPedido.tipo_entrega})`);
        carregarPedidos();

        // Impressão automática: busca o pedido completo (com itens) e manda pra
        // impressora padrão do computador. Só acontece se a opção estiver ligada.
        if (document.getElementById('chk-impressao-automatica').checked) {
            apiFetch(`/pedidos/${dadosDoPedido.pedidoId}`)
                .then(pedidoCompleto => imprimirComanda(pedidoCompleto))
                .catch(err => console.error('Erro ao buscar pedido para impressão automática:', err.message));
        }
    });

    socket.on('statusAtualizado', () => carregarPedidos());
}

// Lembra a preferência de impressão automática entre sessões
function configurarImpressaoAutomatica() {
    const chk = document.getElementById('chk-impressao-automatica');
    chk.checked = localStorage.getItem('pizzaria_impressao_automatica') === 'true';
    chk.addEventListener('change', () => {
        localStorage.setItem('pizzaria_impressao_automatica', chk.checked);
    });
}

// Aviso visual que desaparece sozinho, sem travar a tela como o alert() fazia
// (o alert() trava a aba inteira até alguém clicar OK - se chegassem vários
// pedidos seguidos, dava a impressão de o computador ter travado).
function mostrarToast(mensagem) {
    const toast = document.createElement('div');
    toast.className = 'toast-notificacao';
    toast.textContent = mensagem;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-saindo'), 4000);
    setTimeout(() => toast.remove(), 4500);
}

// ---------- Horário ----------
async function carregarConfiguracoes() {
    const config = await apiFetch('/config');
    document.getElementById('abertura').value = config.horario_abertura?.slice(0, 5);
    document.getElementById('fechamento').value = config.horario_fechamento?.slice(0, 5);
    document.getElementById('config-taxa-entrega').value = Number(config.taxa_entrega || 0).toFixed(2);
    document.getElementById('config-chave-pix').value = config.chave_pix || '';
    document.getElementById('config-whatsapp').value = config.whatsapp_numero || '';
}

async function salvarConfiguracoes() {
    const horario_abertura = document.getElementById('abertura').value + ':00';
    const horario_fechamento = document.getElementById('fechamento').value + ':00';
    const taxa_entrega = Number(document.getElementById('config-taxa-entrega').value || 0);
    const chave_pix = document.getElementById('config-chave-pix').value.trim();
    const whatsapp_numero = document.getElementById('config-whatsapp').value.trim();

    try {
        await apiFetch('/config', {
            method: 'PUT',
            body: JSON.stringify({ horario_abertura, horario_fechamento, taxa_entrega, chave_pix, whatsapp_numero })
        });
        mostrarToast('Configurações atualizadas com sucesso!');
    } catch (err) {
        alert('Erro ao salvar configurações: ' + err.message);
    }
}

// ---------- Imagens por categoria (substituem o ícone padrão no cliente) ----------
const NOMES_CATEGORIA_ADMIN = { tradicional: 'Tradicional', especial: 'Especial', doce: 'Doce', promocao: 'Promoção' };

async function carregarImagensCategoria() {
    const imagens = await apiFetch('/imagens-categoria');
    renderizarImagensCategoria(imagens);
}

function renderizarImagensCategoria(imagens) {
    const container = document.getElementById('lista-imagens-categoria');
    container.innerHTML = imagens.map(img => `
        <div class="card-imagem-categoria">
            <strong>${NOMES_CATEGORIA_ADMIN[img.categoria]}</strong>
            <div class="preview-imagem-categoria">
                ${img.imagem_url
                    ? `<img src="${API_URL.replace('/api', '')}${img.imagem_url}" alt="${img.categoria}">`
                    : `<span class="icone">${ICONES.pizza}</span>`}
            </div>
            <input type="file" accept="image/*" id="arquivo-${img.categoria}">
            <div class="acoes-imagem-categoria">
                <button onclick="enviarImagemCategoria('${img.categoria}')">Enviar</button>
                ${img.imagem_url ? `<button onclick="removerImagemCategoria('${img.categoria}')" class="btn-secundario-admin">Remover</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function enviarImagemCategoria(categoria) {
    const input = document.getElementById(`arquivo-${categoria}`);
    if (!input.files[0]) return alert('Escolha um arquivo primeiro.');

    const formData = new FormData();
    formData.append('imagem', input.files[0]);

    try {
        const resp = await fetch(`${API_URL}/imagens-categoria/${categoria}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData
        });
        if (!resp.ok) throw new Error((await resp.json()).erro || 'Erro ao enviar imagem.');
        mostrarToast('Imagem atualizada!');
        carregarImagensCategoria();
    } catch (err) {
        alert('Erro ao enviar imagem: ' + err.message);
    }
}

async function removerImagemCategoria(categoria) {
    if (!confirm('Remover essa imagem e voltar ao ícone padrão?')) return;
    try {
        await apiFetch(`/imagens-categoria/${categoria}`, { method: 'DELETE' });
        carregarImagensCategoria();
    } catch (err) {
        alert('Erro ao remover imagem: ' + err.message);
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

// Monta a descrição legível de cada item, no lugar do que sairia impresso na
// comanda (enquanto não tem impressora, o atendente lê direto daqui).
function descreverItem(item) {
    if (item.tipo_item === 'pizza') {
        const nomesCategoria = { tradicional: 'Tradicional', especial: 'Especial', doce: 'Doce', promocao: 'Promoção' };
        const sabores = Array.isArray(item.sabores) ? item.sabores : (item.sabores ? JSON.parse(item.sabores) : []);
        return `${item.quantidade}x Pizza ${nomesCategoria[item.pizza_categoria] || ''} (${item.fatias} fatias) - ${escapeHtml(sabores.join(', '))}${item.borda ? ' + borda ' + escapeHtml(item.borda) : ''}`;
    }
    const nome = item.nome_item ? escapeHtml(item.nome_item) : (item.tipo_item === 'bebida' ? 'Bebida (pedido antigo)' : 'Item (pedido antigo)');
    return `${item.quantidade}x ${nome} (R$ ${Number(item.preco_unitario).toFixed(2)} cada)`;
}

// Textos e classes usados no "carimbo" de status de cada pedido
const STATUS_PEDIDO = {
    pendente: { texto: 'Pendente', classe: 'status-pendente' },
    preparo: { texto: 'Em Preparo', classe: 'status-preparo' },
    saiu_entrega: { texto: 'Saiu p/ Entrega', classe: 'status-saiu' },
    entregue: { texto: 'Entregue', classe: 'status-entregue' },
};

let PEDIDOS_ATUAIS = [];

function renderizarPedidos(pedidos) {
    PEDIDOS_ATUAIS = pedidos;
    const container = document.getElementById('lista-pedidos');
    if (pedidos.length === 0) {
        container.innerHTML = '<p class="vazio-lista">Nenhum pedido ainda. Assim que um cliente finalizar a compra (ou você lançar um manualmente), ele aparece aqui.</p>';
        return;
    }

    container.innerHTML = pedidos.map(p => {
        const status = STATUS_PEDIDO[p.status] || { texto: p.status, classe: '' };
        return `
        <div class="card-pedido">
            <div class="cabecalho-card-pedido">
                <h4>Pedido #${String(p.id).padStart(4, '0')} - ${escapeHtml(p.cliente_nome)}</h4>
                <span class="carimbo-status ${status.classe}">${status.texto}</span>
            </div>
            <p><strong>Tipo:</strong> ${escapeHtml(p.tipo_entrega)} | <strong>Pagamento:</strong> ${escapeHtml(p.forma_pagamento)}
               ${p.troco_para > 0 ? ` (Troco para R$${Number(p.troco_para).toFixed(2)})` : ''}</p>
            ${p.tipo_entrega === 'entrega' ? `<p><strong>Endereço:</strong> ${escapeHtml(p.endereco) || '-'} | <strong>Tel:</strong> ${escapeHtml(p.telefone) || '-'}</p>` : ''}
            ${p.observacoes ? `<p class="observacoes-pedido"><strong>Observações:</strong> ${escapeHtml(p.observacoes)}</p>` : ''}

            <div class="itens-pedido-detalhe">
                ${(p.itens || []).map(item => `<p class="linha-item-pedido">${descreverItem(item)}</p>`).join('')}
            </div>

            <p><strong>Total:</strong> R$ ${Number(p.total).toFixed(2)}${p.taxa_entrega > 0 ? ` <small>(inclui taxa de entrega R$ ${Number(p.taxa_entrega).toFixed(2)})</small>` : ''}</p>

            <div class="acoes-pedido">
                <label>Status:
                    <select onchange="mudarStatus(${p.id}, this.value)">
                        <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="preparo" ${p.status === 'preparo' ? 'selected' : ''}>Em Preparo</option>
                        <option value="saiu_entrega" ${p.status === 'saiu_entrega' ? 'selected' : ''}>Saiu para Entrega</option>
                        <option value="entregue" ${p.status === 'entregue' ? 'selected' : ''}>Já foi Entregue</option>
                    </select>
                </label>
                <button onclick="imprimirComandaPorId(${p.id})" class="btn-imprimir-pedido"><span class="icone">${ICONES.impressora}</span> Imprimir</button>
                <button onclick="excluirPedido(${p.id})" class="btn-excluir-pedido"><span class="icone">${ICONES.lixeira}</span> Excluir</button>
            </div>
        </div>
    `;
    }).join('');
}

async function excluirPedido(id) {
    const confirmou = confirm(`Tem certeza que quer excluir o pedido #${id}? Essa ação não pode ser desfeita.`);
    if (!confirmou) return;

    try {
        await apiFetch(`/pedidos/${id}`, { method: 'DELETE' });
        carregarPedidos();
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    }
}

async function mudarStatus(id, status) {
    try {
        await apiFetch(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } catch (err) {
        alert('Erro ao atualizar status: ' + err.message);
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

    container.innerHTML = '<p class="rotulo-grupo-selecao">Sabores (até 3):</p><div class="grade-selecao-itens">' + sabores.map(s => `
        <label class="opcao-selecao-item"><input type="checkbox" name="adm-sabores" value="${s.id}"> ${escapeHtml(s.nome)}</label>
    `).join('') + '</div>';

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
    container.innerHTML = '<p class="rotulo-grupo-selecao">Bebidas:</p><div class="grade-selecao-itens">' + PRODUTOS_ADMIN.bebidas.map(b => `
        <label class="opcao-selecao-item"><input type="checkbox" name="adm-bebidas" value="${b.id}" data-preco="${b.preco_base}"> ${escapeHtml(b.nome)} (R$ ${Number(b.preco_base).toFixed(2)})</label>
    `).join('') + '</div>';
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
    document.getElementById('campo-descricao-produto').style.display = tipo === 'sabor_pizza' ? 'block' : 'none';
    document.getElementById('campo-preco-produto').style.display = tipo === 'sabor_pizza' ? 'none' : 'block';
}

let CARDAPIO_ADMIN_TODOS = [];
let FILTRO_CARDAPIO_ATUAL = 'tradicional';

function renderizarCardapio(produtos) {
    CARDAPIO_ADMIN_TODOS = produtos;
    aplicarFiltroCardapio();
}

function aplicarFiltroCardapio() {
    const termo = document.getElementById('busca-cardapio-admin').value.trim().toLowerCase();

    const filtrados = CARDAPIO_ADMIN_TODOS.filter(p => {
        const bateCategoria = ['tradicional', 'especial', 'doce', 'promocao'].includes(FILTRO_CARDAPIO_ATUAL)
            ? p.tipo === 'sabor_pizza' && p.categoria === FILTRO_CARDAPIO_ATUAL
            : p.tipo === FILTRO_CARDAPIO_ATUAL;
        const bateBusca = !termo || p.nome.toLowerCase().includes(termo);
        return bateCategoria && bateBusca;
    });

    const lista = document.getElementById('lista-produtos-cardapio');
    if (filtrados.length === 0) {
        lista.innerHTML = '<li>Nenhum item nessa categoria ainda.</li>';
        return;
    }

    lista.innerHTML = filtrados.map(p => `
        <li class="item-cardapio">
            <div>
                <span>${escapeHtml(p.nome)}</span>
                ${p.descricao ? `<div class="descricao-produto">${escapeHtml(p.descricao)}</div>` : ''}
            </div>
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
    const descricao = document.getElementById('prod-descricao').value.trim();
    const preco_base = document.getElementById('prod-preco').value;

    if (!nome) return alert('Digite o nome do produto.');

    try {
        await apiFetch('/produtos', {
            method: 'POST',
            body: JSON.stringify({ nome, tipo, categoria, descricao, preco_base: Number(preco_base || 0) })
        });
        document.getElementById('prod-nome').value = '';
        document.getElementById('prod-descricao').value = '';
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
