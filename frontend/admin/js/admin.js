let socket = null;
let PRODUTOS_ADMIN = { sabores: [], bordas: [], bebidas: [] };
let PRECOS_ADMIN = [];
let SECOES_ADMIN = []; // seções do cardápio (ex: Tradicional/Especial/Doce/Promoção), criadas livremente pelo admin

// Preenche todo elemento <span class="icone" data-icone="NOME"> com o SVG
// correspondente definido em icones.js. Usado pra ícones fixos no HTML;
// conteúdo gerado dinamicamente (cards de pedido, etc) injeta o SVG direto.
function aplicarIcones() {
    document.querySelectorAll('[data-icone]').forEach(el => {
        el.innerHTML = ICONES[el.dataset.icone] || '';
    });
}

// Modo escuro - lembrado entre visitas via localStorage, independente de
// login (é só preferência visual, não precisa de conta pra isso).
function aplicarTemaSalvo() {
    const ativo = localStorage.getItem('pizzaria_tema_escuro') === 'true';
    document.body.classList.toggle('tema-escuro', ativo);
    atualizarBotaoTema(ativo);
}

function alternarTemaEscuro() {
    const ativo = document.body.classList.toggle('tema-escuro');
    localStorage.setItem('pizzaria_tema_escuro', ativo);
    atualizarBotaoTema(ativo);
}

function atualizarBotaoTema(ativo) {
    const btn = document.getElementById('btn-tema-escuro');
    btn.querySelector('.icone').innerHTML = ativo ? ICONES.sol : ICONES.lua;
    btn.querySelector('.texto-acao').textContent = ativo ? 'Modo Claro' : 'Modo Escuro';
}

document.addEventListener('DOMContentLoaded', () => {
    aplicarIcones();
    aplicarTemaSalvo();

    document.getElementById('btn-login').addEventListener('click', login);
    document.getElementById('btn-logout').addEventListener('click', logout);
    document.getElementById('btn-tema-escuro').addEventListener('click', alternarTemaEscuro);
    document.getElementById('btn-salvar-config').addEventListener('click', salvarConfiguracoes);
    document.getElementById('btn-salvar-precos').addEventListener('click', salvarPrecos);
    document.getElementById('btn-lancar-pedido').addEventListener('click', lancarPedidoAdmin);
    document.getElementById('btn-ativar-som').addEventListener('click', ativarSom);
    document.getElementById('btn-criar-cupom').addEventListener('click', criarCupom);
    document.getElementById('btn-criar-promocao').addEventListener('click', criarPromocao);

    document.querySelectorAll('.aba-btn').forEach(btn => {
        btn.addEventListener('click', () => trocarAba(btn.dataset.aba));
    });

    // Delegação de evento: os chips de seção são gerados dinamicamente (a
    // partir de /secoes) depois que o painel carrega, então não existem
    // ainda no momento do DOMContentLoaded - por isso escutamos no
    // container, que já existe no HTML, em vez de nos botões diretamente.
    document.getElementById('chips-categoria-admin').addEventListener('click', (evento) => {
        const chip = evento.target.closest('.chip-admin');
        if (!chip) return;
        document.querySelectorAll('.chip-admin').forEach(c => c.classList.remove('ativo'));
        chip.classList.add('ativo');
        FILTRO_CARDAPIO_ATUAL = chip.dataset.filtro;
        aplicarFiltroCardapio();
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

    if (aba === 'historico' && !HISTORICO_DIAS_CARREGADO) {
        HISTORICO_DIAS_CARREGADO = true;
        carregarHistoricoDias();
    }
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

    // Seções do cardápio precisam vir ANTES do resto: o cardápio, a grade de
    // preços, o formulário de pedido manual e a lista de sabores da promoção
    // dependem todos de saber quais seções existem pra se montar direito.
    await tentarCarregar(carregarSecoesAdmin, 'seções do cardápio');
    renderizarChipsCardapio();
    preencherSelectsDeSecao();

    // Antes cada informação era buscada em sequência (uma esperando a outra
    // terminar). Como são chamadas independentes, agora buscamos tudo ao
    // mesmo tempo - o painel carrega no tempo da requisição mais lenta,
    // não na soma de todas.
    await Promise.all([
        tentarCarregar(carregarProdutosAdmin, 'produtos'),
        tentarCarregar(carregarPrecosAdmin, 'preços'),
        tentarCarregar(carregarConfiguracoes, 'configurações'),
        tentarCarregar(carregarImagensTamanho, 'imagens'),
        tentarCarregar(carregarCupons, 'cupons'),
        tentarCarregar(carregarPromocoes, 'promoções'),
        tentarCarregar(carregarPedidos, 'pedidos'),
        tentarCarregar(async () => {
            renderizarCardapio(await apiFetch('/produtos'));
        }, 'cardápio')
    ]);

    renderizarTabelaPrecos();
    renderizarBebidasAdmin();
    renderizarSaboresPromocao();
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
    socket = io(SOCKET_URL, { auth: { token: getToken() } });

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
    document.getElementById('config-promocao-ativa').checked = !!config.promocao_ativa;
    document.getElementById('config-promocao-texto').value = config.promocao_texto || '';
}

async function salvarConfiguracoes() {
    const horario_abertura = document.getElementById('abertura').value + ':00';
    const horario_fechamento = document.getElementById('fechamento').value + ':00';
    const taxa_entrega = Number(document.getElementById('config-taxa-entrega').value || 0);
    const chave_pix = document.getElementById('config-chave-pix').value.trim();
    const whatsapp_numero = document.getElementById('config-whatsapp').value.trim();
    const promocao_ativa = document.getElementById('config-promocao-ativa').checked;
    const promocao_texto = document.getElementById('config-promocao-texto').value.trim();

    try {
        await apiFetch('/config', {
            method: 'PUT',
            body: JSON.stringify({ horario_abertura, horario_fechamento, taxa_entrega, chave_pix, whatsapp_numero, promocao_ativa, promocao_texto })
        });
        mostrarToast('Configurações atualizadas com sucesso!');
    } catch (err) {
        alert('Erro ao salvar configurações: ' + err.message);
    }
}

// ---------- Fotos por tamanho (substituem o ícone padrão no cliente) ----------
// Guardadas em base64 direto no banco de dados - não em arquivo no servidor,
// que se perde toda vez que o serviço reinicia em plataformas como o Render.
const FATIAS_COM_FOTO = [4, 6, 8, 12, 14];

async function carregarImagensTamanho() {
    const imagens = await apiFetch('/imagens-tamanho');
    renderizarImagensTamanho(imagens);
}

function renderizarImagensTamanho(imagens) {
    const container = document.getElementById('lista-imagens-tamanho');
    container.innerHTML = imagens.map(img => `
        <div class="card-imagem-categoria">
            <strong>${img.fatias} fatias</strong>
            <div class="preview-imagem-categoria">
                ${img.imagem_base64
                    ? `<img src="${img.imagem_base64}" alt="${img.fatias} fatias">`
                    : `<span class="icone">${ICONES.pizza}</span>`}
            </div>
            <input type="file" accept="image/*" id="arquivo-tamanho-${img.fatias}">
            <div class="acoes-imagem-categoria">
                <button onclick="enviarImagemTamanho(${img.fatias})">Enviar</button>
                ${img.imagem_base64 ? `<button onclick="removerImagemTamanho(${img.fatias})" class="btn-secundario-admin">Remover</button>` : ''}
            </div>
        </div>
    `).join('');
}

function lerArquivoComoBase64(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        leitor.readAsDataURL(arquivo);
    });
}

async function enviarImagemTamanho(fatias) {
    const input = document.getElementById(`arquivo-tamanho-${fatias}`);
    const arquivo = input.files[0];
    if (!arquivo) return alert('Escolha um arquivo primeiro.');

    if (arquivo.size > 5 * 1024 * 1024) {
        return alert('Imagem muito grande. Escolha uma de até 5MB.');
    }

    try {
        const imagem_base64 = await lerArquivoComoBase64(arquivo);
        await apiFetch(`/imagens-tamanho/${fatias}`, {
            method: 'PUT',
            body: JSON.stringify({ imagem_base64 })
        });
        mostrarToast('Foto atualizada!');
        carregarImagensTamanho();
    } catch (err) {
        alert('Erro ao enviar imagem: ' + err.message);
    }
}

async function removerImagemTamanho(fatias) {
    if (!confirm('Remover essa foto e voltar ao ícone padrão?')) return;
    try {
        await apiFetch(`/imagens-tamanho/${fatias}`, { method: 'DELETE' });
        carregarImagensTamanho();
    } catch (err) {
        alert('Erro ao remover imagem: ' + err.message);
    }
}

// ---------- Cupons de desconto ----------
async function carregarCupons() {
    const cupons = await apiFetch('/cupons');
    renderizarCupons(cupons);
}

function formatarValorCupom(cupom) {
    return cupom.tipo === 'percentual' ? `${Number(cupom.valor)}%` : `R$ ${Number(cupom.valor).toFixed(2)}`;
}

function renderizarCupons(cupons) {
    const lista = document.getElementById('lista-cupons');
    if (cupons.length === 0) {
        lista.innerHTML = '<li class="carregando">Nenhum cupom cadastrado ainda.</li>';
        return;
    }

    lista.innerHTML = cupons.map(c => {
        const usos = c.limite_uso ? `${c.usos_atuais}/${c.limite_uso} usos` : `${c.usos_atuais} usos (sem limite)`;
        const validade = c.validade ? `válido até ${new Date(c.validade).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}` : 'sem validade';
        return `
            <li class="item-cupom">
                <div>
                    <strong>${c.codigo}</strong> - ${formatarValorCupom(c)} de desconto
                    <div class="descricao-produto">${validade} · ${usos}</div>
                </div>
                <div class="acoes-item-cupom">
                    <label class="opcao-checkbox-inline">
                        <input type="checkbox" ${c.ativo ? 'checked' : ''} onchange="alternarCupomAtivo(${c.id}, this.checked, '${c.tipo}', ${c.valor}, '${c.validade || ''}', ${c.limite_uso || 'null'})">
                        Ativo
                    </label>
                    <button class="btn-excluir" onclick="excluirCupom(${c.id})">Excluir</button>
                </div>
            </li>
        `;
    }).join('');
}

async function criarCupom() {
    const codigo = document.getElementById('cupom-codigo').value.trim();
    const tipo = document.getElementById('cupom-tipo').value;
    const valor = Number(document.getElementById('cupom-valor').value);
    const validade = document.getElementById('cupom-validade').value || null;
    const limite_uso = document.getElementById('cupom-limite').value || null;

    if (!codigo) return alert('Informe o código do cupom.');
    if (!(valor > 0)) return alert('Informe um valor de desconto maior que zero.');

    try {
        await apiFetch('/cupons', {
            method: 'POST',
            body: JSON.stringify({ codigo, tipo, valor, validade, limite_uso })
        });
        mostrarToast('Cupom criado com sucesso!');
        document.getElementById('cupom-codigo').value = '';
        document.getElementById('cupom-valor').value = '';
        document.getElementById('cupom-validade').value = '';
        document.getElementById('cupom-limite').value = '';
        carregarCupons();
    } catch (err) {
        alert('Erro ao criar cupom: ' + err.message);
    }
}

async function alternarCupomAtivo(id, ativo, tipo, valor, validade, limite_uso) {
    try {
        await apiFetch(`/cupons/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ tipo, valor, validade: validade || null, limite_uso, ativo })
        });
        mostrarToast(ativo ? 'Cupom ativado.' : 'Cupom desativado.');
        carregarCupons();
    } catch (err) {
        alert('Erro ao atualizar cupom: ' + err.message);
    }
}

async function excluirCupom(id) {
    if (!confirm('Excluir esse cupom? Não afeta pedidos já feitos com ele.')) return;
    try {
        await apiFetch(`/cupons/${id}`, { method: 'DELETE' });
        carregarCupons();
    } catch (err) {
        alert('Erro ao excluir cupom: ' + err.message);
    }
}

// ---------- Promoções ----------
// Lista de sabores marcáveis no formulário de criação (todas as categorias,
// já que uma promoção pode combinar sabores de categorias diferentes).
function renderizarSaboresPromocao() {
    const container = document.getElementById('promo-container-sabores');
    if (!PRODUTOS_ADMIN.sabores || PRODUTOS_ADMIN.sabores.length === 0) {
        container.innerHTML = '<p class="erro">Nenhum sabor cadastrado no cardápio ainda.</p>';
        return;
    }

    const nomeSecaoPorId = new Map(SECOES_ADMIN.map(s => [s.id, s.nome]));
    container.innerHTML = '<div class="grade-selecao-itens">' + PRODUTOS_ADMIN.sabores.map(s => `
        <label class="opcao-selecao-item"><input type="checkbox" name="promo-sabores" value="${s.id}"> ${escapeHtml(s.nome)} <small>(${escapeHtml(nomeSecaoPorId.get(s.secao_id) || '')})</small></label>
    `).join('') + '</div>';

    container.onchange = () => {
        const marcados = container.querySelectorAll('input[name="promo-sabores"]:checked');
        if (marcados.length > 12) {
            event.target.checked = false;
            alert('Máximo de 12 sabores por promoção.');
        }
    };
}

async function carregarPromocoes() {
    const promocoes = await apiFetch('/promocoes/todas');
    renderizarPromocoes(promocoes);
}

function renderizarPromocoes(promocoes) {
    const lista = document.getElementById('lista-promocoes');
    if (promocoes.length === 0) {
        lista.innerHTML = '<li class="carregando">Nenhuma promoção cadastrada ainda.</li>';
        return;
    }

    lista.innerHTML = promocoes.map(p => {
        const nomesSabores = p.sabor_ids
            .map(id => PRODUTOS_ADMIN.sabores.find(s => s.id === id)?.nome)
            .filter(Boolean)
            .join(', ');
        return `
            <li class="item-cupom">
                <div>
                    <strong>${escapeHtml(p.nome)}</strong> - ${p.fatias} fatias
                    <div class="descricao-produto">${escapeHtml(nomesSabores)}</div>
                    <div class="descricao-produto">De R$ ${Number(p.preco_de).toFixed(2)} por R$ ${Number(p.preco_por).toFixed(2)}</div>
                </div>
                <div class="acoes-item-cupom">
                    <label class="opcao-checkbox-inline">
                        <input type="checkbox" ${p.ativo ? 'checked' : ''} onchange="alternarPromocaoAtiva(${p.id})">
                        Ativa
                    </label>
                    <button class="btn-excluir" onclick="excluirPromocao(${p.id})">Excluir</button>
                </div>
            </li>
        `;
    }).join('');
}

async function criarPromocao() {
    const nome = document.getElementById('promo-nome').value.trim();
    const fatias = Number(document.getElementById('promo-fatias').value);
    const preco_de = Number(document.getElementById('promo-preco-de').value);
    const preco_por = Number(document.getElementById('promo-preco-por').value);
    const sabor_ids = [...document.querySelectorAll('input[name="promo-sabores"]:checked')].map(el => Number(el.value));

    if (!nome) return alert('Informe o nome da promoção.');
    if (sabor_ids.length === 0) return alert('Marque ao menos 1 sabor para a promoção.');
    if (!(preco_de >= 0) || !(preco_por >= 0)) return alert('Informe os preços "de" e "por".');

    try {
        await apiFetch('/promocoes', {
            method: 'POST',
            body: JSON.stringify({ nome, fatias, sabor_ids, preco_de, preco_por })
        });
        mostrarToast('Promoção criada com sucesso!');
        document.getElementById('promo-nome').value = '';
        document.getElementById('promo-preco-de').value = '';
        document.getElementById('promo-preco-por').value = '';
        document.querySelectorAll('input[name="promo-sabores"]:checked').forEach(el => el.checked = false);
        carregarPromocoes();
    } catch (err) {
        alert('Erro ao criar promoção: ' + err.message);
    }
}

async function alternarPromocaoAtiva(id) {
    try {
        await apiFetch(`/promocoes/${id}/ativa`, { method: 'PATCH' });
        carregarPromocoes();
    } catch (err) {
        alert('Erro ao atualizar promoção: ' + err.message);
    }
}

async function excluirPromocao(id) {
    if (!confirm('Excluir essa promoção? Ela deixa de aparecer no cardápio do cliente.')) return;
    try {
        await apiFetch(`/promocoes/${id}`, { method: 'DELETE' });
        carregarPromocoes();
    } catch (err) {
        alert('Erro ao excluir promoção: ' + err.message);
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
        // pizza_categoria já vem do servidor como o NOME da seção (ex:
        // "Tradicional", ou qualquer nome que o admin tiver criado) - não
        // precisa mais traduzir de um ENUM fixo. Pizzas de promoção não têm
        // seção (pizza_categoria vem null do servidor); usamos nome_item,
        // que só vem preenchido nesses casos, pra saber que é promoção.
        const sabores = Array.isArray(item.sabores) ? item.sabores : (item.sabores ? JSON.parse(item.sabores) : []);
        const rotuloPromocao = item.nome_item ? `[${escapeHtml(item.nome_item)}] ` : '';
        const nomeSecao = item.pizza_categoria ? `${escapeHtml(item.pizza_categoria)} ` : '';
        return `${rotuloPromocao}${item.quantidade}x Pizza ${nomeSecao}(${item.fatias} fatias) - ${escapeHtml(sabores.join(', '))}${item.borda ? ' + borda ' + escapeHtml(item.borda) : ''}`;
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
                <h4>Pedido #${String(p.numero_pedido_dia).padStart(4, '0')} - ${escapeHtml(p.cliente_nome)}</h4>
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

// ---------- Histórico ----------
let HISTORICO_DIAS_CARREGADO = false;
let DIAS_HISTORICO = [];

function formatarDiaOperacionalBr(diaISO) {
    // Evita usar `new Date('YYYY-MM-DD')` direto (interpreta como UTC e pode
    // voltar um dia no fuso de Brasília) - monta a data local a partir das
    // partes do próprio texto.
    const [ano, mes, dia] = diaISO.split('-').map(Number);
    return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function carregarHistoricoDias() {
    const select = document.getElementById('select-dia-historico');
    try {
        DIAS_HISTORICO = await apiFetch('/pedidos/historico/dias');

        if (DIAS_HISTORICO.length === 0) {
            select.innerHTML = '<option value="">Nenhum dia com pedidos ainda</option>';
            document.getElementById('lista-historico-pedidos').innerHTML = '';
            return;
        }

        select.innerHTML = DIAS_HISTORICO.map(d =>
            `<option value="${d.dia_operacional}">${formatarDiaOperacionalBr(d.dia_operacional)} - ${d.total_pedidos} pedido(s)</option>`
        ).join('');

        select.onchange = () => selecionarDiaHistorico(select.value);
        selecionarDiaHistorico(select.value); // já abre o dia mais recente (primeira opção)
    } catch (err) {
        select.innerHTML = '<option value="">Erro ao carregar</option>';
        document.getElementById('lista-historico-pedidos').innerHTML = `<p class="erro">${err.message}</p>`;
    }
}

async function selecionarDiaHistorico(dia) {
    if (!dia) return;

    const resumoEl = document.getElementById('resumo-dia-historico');
    const infoDia = DIAS_HISTORICO.find(d => d.dia_operacional === dia);
    if (infoDia) {
        resumoEl.innerHTML = `<p class="dica"><strong>${infoDia.total_pedidos}</strong> pedido(s) - <strong>Total faturado: R$ ${Number(infoDia.total_faturado).toFixed(2)}</strong></p>`;
    }

    const container = document.getElementById('lista-historico-pedidos');
    container.innerHTML = '<p>Carregando pedidos do dia...</p>';
    try {
        const pedidos = await apiFetch(`/pedidos/historico/${dia}`);
        renderizarHistoricoPedidos(pedidos);
    } catch (err) {
        container.innerHTML = `<p class="erro">${err.message}</p>`;
    }
}

// Igual ao card de pedido normal, mas sem os controles de status/exclusão -
// pedido de um dia já encerrado não deve ser alterado por engano. Mantém só
// o botão de reimprimir, útil se o cliente perder a comanda física.
function renderizarHistoricoPedidos(pedidos) {
    const container = document.getElementById('lista-historico-pedidos');
    if (pedidos.length === 0) {
        container.innerHTML = '<p class="vazio-lista">Nenhum pedido nesse dia.</p>';
        return;
    }

    container.innerHTML = pedidos.map(p => {
        const status = STATUS_PEDIDO[p.status] || { texto: p.status, classe: '' };
        return `
        <div class="card-pedido">
            <div class="cabecalho-card-pedido">
                <h4>Pedido #${String(p.numero_pedido_dia).padStart(4, '0')} - ${escapeHtml(p.cliente_nome)}</h4>
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
                <button onclick="imprimirComandaPorId(${p.id})" class="btn-imprimir-pedido"><span class="icone">${ICONES.impressora}</span> Reimprimir</button>
            </div>
        </div>
    `;
    }).join('');
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

function obterPrecoAdmin(secaoId, fatias) {
    const item = PRECOS_ADMIN.find(p => p.secao_id === Number(secaoId) && Number(p.fatias) === Number(fatias));
    return item ? Number(item.preco) : null;
}

function carregarSaboresAdmin() {
    const secaoId = document.getElementById('adm-categoria').value;
    const container = document.getElementById('adm-container-sabores');

    if (!secaoId) {
        container.innerHTML = '<p class="carregando">Selecione a seção primeiro.</p>';
        return;
    }

    const sabores = PRODUTOS_ADMIN.sabores.filter(s => s.secao_id === Number(secaoId));
    if (sabores.length === 0) {
        container.innerHTML = '<p class="erro">Nenhum sabor cadastrado nessa seção.</p>';
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
    const secaoId = document.getElementById('adm-categoria').value;
    const fatias = document.getElementById('adm-fatias').value;
    const info = document.getElementById('adm-preco-tamanho');
    if (!secaoId || !fatias) { info.textContent = ''; return; }

    const preco = obterPrecoAdmin(secaoId, fatias);
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
    const secaoId = document.getElementById('adm-categoria').value;
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
    if (!secaoId || !fatias) return alert('Escolha a seção e o tamanho da pizza.');
    if (saboresMarcados.length === 0) return alert('Escolha ao menos um sabor.');
    if (tipoEntrega === 'entrega' && (!telefone || !endereco)) return alert('Telefone e endereço são obrigatórios para entrega.');

    // Não mandamos a seção no item: o servidor SEMPRE deriva a seção (e o
    // preço) a partir dos sabor_ids escolhidos, nunca confia no que o
    // cliente/admin envia - então esse campo aqui não seria usado mesmo.
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
        document.getElementById('adm-container-sabores').innerHTML = '<p class="carregando">Selecione a seção primeiro.</p>';
        carregarPedidos();
        trocarAba('pedidos');
    } catch (err) {
        alert('Erro ao lançar pedido: ' + err.message);
    }
}

// ---------- Seções do cardápio ----------
// Seções não são mais um ENUM fixo (tradicional/especial/doce/promocao) -
// o admin cria/renomeia/apaga livremente, e o front busca a lista atual em
// /secoes pra montar selects, chips e a grade de preços dinamicamente.
async function carregarSecoesAdmin() {
    SECOES_ADMIN = await apiFetch('/secoes');
}

// Preenche os dois <select> que dependem da lista de seções: o de cadastro
// de produto (só usado quando tipo = sabor de pizza) e o de criação manual
// de pedido.
function preencherSelectsDeSecao() {
    const opcoes = '<option value="">Selecione...</option>' +
        SECOES_ADMIN.map(s => `<option value="${s.id}">${escapeHtml(s.nome)}</option>`).join('');
    document.getElementById('prod-categoria').innerHTML = opcoes;
    document.getElementById('adm-categoria').innerHTML = opcoes;
}

// Um chip por seção existente + os 3 tipos fixos que não são "sabor de
// pizza" (borda/bebida/outros não têm seção, então não fazem parte de
// /secoes). Prefixamos "secao-" no data-filtro pra diferenciar dos tipos
// fixos na hora de filtrar em aplicarFiltroCardapio().
function renderizarChipsCardapio() {
    const container = document.getElementById('chips-categoria-admin');
    const chipsSecoes = SECOES_ADMIN.map(s =>
        `<button class="chip-admin" data-filtro="secao-${s.id}">${escapeHtml(s.nome)}</button>`
    ).join('');
    const chipsFixos = `
        <button class="chip-admin" data-filtro="borda">Bordas</button>
        <button class="chip-admin" data-filtro="bebida">Bebidas</button>
        <button class="chip-admin" data-filtro="outros">Outros</button>
    `;
    container.innerHTML = chipsSecoes + chipsFixos;

    const primeiroChip = container.querySelector('.chip-admin');
    if (primeiroChip) {
        primeiroChip.classList.add('ativo');
        FILTRO_CARDAPIO_ATUAL = primeiroChip.dataset.filtro;
    }
}

// ---------- Cardápio ----------
function alternarCampoCategoria() {
    const tipo = document.getElementById('prod-tipo').value;
    document.getElementById('campo-categoria-produto').style.display = tipo === 'sabor_pizza' ? 'block' : 'none';
    document.getElementById('campo-descricao-produto').style.display = tipo === 'sabor_pizza' ? 'block' : 'none';
    document.getElementById('campo-preco-produto').style.display = tipo === 'sabor_pizza' ? 'none' : 'block';
    document.getElementById('campo-imagem-produto').style.display = (tipo === 'bebida' || tipo === 'outros') ? 'block' : 'none';
}

let CARDAPIO_ADMIN_TODOS = [];
// Preenchido de verdade em renderizarChipsCardapio(), assim que as seções
// carregam - o valor aqui é só um placeholder até lá.
let FILTRO_CARDAPIO_ATUAL = '';

function renderizarCardapio(produtos) {
    CARDAPIO_ADMIN_TODOS = produtos;
    aplicarFiltroCardapio();
}

function aplicarFiltroCardapio() {
    const termo = document.getElementById('busca-cardapio-admin').value.trim().toLowerCase();

    const filtrados = CARDAPIO_ADMIN_TODOS.filter(p => {
        const bateCategoria = FILTRO_CARDAPIO_ATUAL.startsWith('secao-')
            ? p.tipo === 'sabor_pizza' && p.secao_id === Number(FILTRO_CARDAPIO_ATUAL.slice('secao-'.length))
            : p.tipo === FILTRO_CARDAPIO_ATUAL;
        const bateBusca = !termo || p.nome.toLowerCase().includes(termo);
        return bateCategoria && bateBusca;
    });

    const lista = document.getElementById('lista-produtos-cardapio');
    if (filtrados.length === 0) {
        lista.innerHTML = '<li>Nenhum item nessa categoria ainda.</li>';
        return;
    }

    lista.innerHTML = filtrados.map(p => {
        const permiteFoto = p.tipo === 'bebida' || p.tipo === 'outros';
        return `
        <li class="item-cardapio">
            <div class="linha-item-com-foto">
                ${permiteFoto ? `
                    <div class="miniatura-produto">
                        ${p.imagem_base64 ? `<img src="${p.imagem_base64}" alt="${escapeHtml(p.nome)}">` : `<span class="icone">${ICONES.imagem}</span>`}
                    </div>
                ` : ''}
                <div>
                    <span>${escapeHtml(p.nome)}</span>
                    ${p.descricao ? `<div class="descricao-produto">${escapeHtml(p.descricao)}</div>` : ''}
                </div>
            </div>
            <div>
                <label>
                    <input type="checkbox" ${p.disponivel ? 'checked' : ''} onchange="alternarDisponibilidade(${p.id})">
                    Disponível
                </label>
                ${permiteFoto ? `
                    <label class="btn-trocar-foto">
                        Foto
                        <input type="file" accept="image/*" style="display:none;" onchange="trocarFotoProduto(${p.id}, this)">
                    </label>
                ` : ''}
                <button onclick="excluirProduto(${p.id})" class="btn-excluir">X</button>
            </div>
        </li>
    `;
    }).join('');
}

async function trocarFotoProduto(id, input) {
    const arquivo = input.files[0];
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) return alert('Imagem muito grande. Escolha uma de até 5MB.');

    try {
        const imagem_base64 = await lerArquivoComoBase64(arquivo);
        await apiFetch(`/produtos/${id}/imagem`, { method: 'PUT', body: JSON.stringify({ imagem_base64 }) });
        mostrarToast('Foto atualizada!');
        renderizarCardapio(await apiFetch('/produtos'));
        await carregarProdutosAdmin();
    } catch (err) {
        alert('Erro ao atualizar foto: ' + err.message);
    }
}

async function adicionarProduto() {
    const nome = document.getElementById('prod-nome').value.trim();
    const tipo = document.getElementById('prod-tipo').value;
    const secaoIdSelecionado = document.getElementById('prod-categoria').value;
    const descricao = document.getElementById('prod-descricao').value.trim();
    const preco_base = document.getElementById('prod-preco').value;
    const arquivoImagem = document.getElementById('prod-imagem').files[0];

    if (!nome) return alert('Digite o nome do produto.');
    if (tipo === 'sabor_pizza' && !secaoIdSelecionado) {
        return alert('Escolha a seção do cardápio para esse sabor.');
    }
    if (arquivoImagem && arquivoImagem.size > 5 * 1024 * 1024) {
        return alert('Imagem muito grande. Escolha uma de até 5MB.');
    }

    try {
        const imagem_base64 = arquivoImagem ? await lerArquivoComoBase64(arquivoImagem) : null;
        await apiFetch('/produtos', {
            method: 'POST',
            body: JSON.stringify({
                nome,
                tipo,
                secao_id: secaoIdSelecionado ? Number(secaoIdSelecionado) : null,
                descricao,
                preco_base: Number(preco_base || 0),
                imagem_base64
            })
        });
        document.getElementById('prod-nome').value = '';
        document.getElementById('prod-descricao').value = '';
        document.getElementById('prod-preco').value = '';
        document.getElementById('prod-imagem').value = '';
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
// As seções agora vêm de SECOES_ADMIN (dinâmicas), não de uma lista fixa -
// cada linha da tabela é uma seção existente no momento.
function renderizarTabelaPrecos() {
    const fatiasList = [4, 6, 8, 12, 14];

    const corpo = document.getElementById('corpo-tabela-precos');
    corpo.innerHTML = SECOES_ADMIN.map(secao => `
        <tr>
            <td>${escapeHtml(secao.nome)}</td>
            ${fatiasList.map(f => {
                const preco = obterPrecoAdmin(secao.id, f);
                return `<td><input type="number" step="0.01" data-secao-id="${secao.id}" data-fatias="${f}" value="${preco !== null ? preco : 0}"></td>`;
            }).join('')}
        </tr>
    `).join('');
}

async function salvarPrecos() {
    const inputs = document.querySelectorAll('#corpo-tabela-precos input');
    const precos = [...inputs].map(input => ({
        secao_id: Number(input.dataset.secaoId),
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
