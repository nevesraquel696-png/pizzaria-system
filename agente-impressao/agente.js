// ============================================
// AGENTE DE IMPRESSÃO DIRETA
//
// Roda no computador da pizzaria (onde a impressora está ligada). Fica
// conectado ao servidor e, a cada pedido novo, imprime a comanda direto na
// impressora térmica - sem navegador e sem janela de impressão.
//
// Uso:  node agente.js            (fica rodando e imprime os pedidos novos)
//       node agente.js --teste    (imprime só uma comanda de teste e sai)
// ============================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const iconv = require('iconv-lite');
const { io } = require('socket.io-client');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));
const API = config.api_url.replace(/\/$/, '');

// ---------- ESC/POS ----------
const ESC = 0x1b, GS = 0x1d, LF = 0x0a;
const COLUNAS = config.largura_papel_mm === 58 ? 32 : 48;
const TABELAS = { 850: 2, 860: 3, 437: 0, 858: 19 }; // comando "ESC t n"

function textoParaBytes(texto) {
    let t = String(texto ?? '');
    if (config.remover_acentos) t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return iconv.encode(t, 'cp' + (config.tabela_caracteres || 850));
}

class Comanda {
    constructor() {
        this.partes = [Buffer.from([ESC, 0x40]), Buffer.from([ESC, 0x74, TABELAS[config.tabela_caracteres] ?? 2])];
    }
    cru(...bytes) { this.partes.push(Buffer.from(bytes)); return this; }
    texto(t) { this.partes.push(textoParaBytes(t), Buffer.from([LF])); return this; }
    centro() { return this.cru(ESC, 0x61, 1); }
    esquerda() { return this.cru(ESC, 0x61, 0); }
    negrito(ligado) { return this.cru(ESC, 0x45, ligado ? 1 : 0); }
    dobrado(ligado) { return this.cru(GS, 0x21, ligado ? 0x11 : 0x00); }
    // texto em tamanho dobrado só se couber (dobrado ocupa 2 colunas por letra);
    // senão sai em tamanho normal, pra nunca cortar na lateral
    destaque(t) {
        const cabe = String(t).length <= Math.floor(COLUNAS / 2);
        return this.negrito(true).dobrado(cabe).texto(t).dobrado(false).negrito(false);
    }
    linha() { return this.texto('-'.repeat(COLUNAS)); }
    // quebra o texto em linhas da largura do papel, com recuo opcional
    paragrafo(t, recuo = '') {
        const largura = COLUNAS - recuo.length;
        const palavras = String(t ?? '').split(/\s+/).filter(Boolean);
        let atual = '';
        for (const p of palavras) {
            let palavra = p;
            while (palavra.length > largura) { // palavra maior que a linha: quebra
                if (atual) { this.texto(recuo + atual); atual = ''; }
                this.texto(recuo + palavra.slice(0, largura));
                palavra = palavra.slice(largura);
            }
            if ((atual + ' ' + palavra).trim().length > largura) { this.texto(recuo + atual); atual = palavra; }
            else atual = (atual + ' ' + palavra).trim();
        }
        if (atual) this.texto(recuo + atual);
        return this;
    }
    finalizar() {
        // avança o papel e corta (se a guilhotina existir; senão é ignorado)
        this.cru(LF, LF, LF, LF, GS, 0x56, 0x42, 0x00);
        return Buffer.concat(this.partes);
    }
}

function dinheiro(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }

function descreverItem(item) {
    if (item.tipo_item === 'pizza') {
        const sabores = Array.isArray(item.sabores) ? item.sabores : (item.sabores ? JSON.parse(item.sabores) : []);
        return {
            titulo: `${item.quantidade}x ${item.nome_item ? '[' + item.nome_item + '] ' : ''}Pizza ${item.pizza_categoria ? item.pizza_categoria + ' ' : ''}(${item.fatias} fatias)`,
            detalhes: [sabores.join(', '), item.borda ? '+ borda ' + item.borda : null].filter(Boolean)
        };
    }
    return { titulo: `${item.quantidade}x ${item.nome_item || 'Item'} - ${dinheiro(item.preco_unitario)} cada`, detalhes: [] };
}

function montarVia(pedido) {
    const c = new Comanda();
    c.centro().destaque(config.nome_pizzaria || 'PIZZARIA');
    c.texto('Pedido #' + String(pedido.numero_pedido_dia ?? 0).padStart(4, '0'));
    c.texto(new Date(pedido.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    c.esquerda().linha();
    c.paragrafo('Cliente: ' + pedido.cliente_nome);
    c.paragrafo('Tipo: ' + pedido.tipo_entrega);
    if (pedido.tipo_entrega === 'entrega') {
        c.paragrafo('Endereco: ' + (pedido.endereco || '-'));
        c.paragrafo('Telefone: ' + (pedido.telefone || '-'));
    }
    c.linha();
    for (const item of pedido.itens || []) {
        const { titulo, detalhes } = descreverItem(item);
        c.negrito(true).paragrafo(titulo).negrito(false);
        detalhes.forEach(d => c.paragrafo(d, '  '));
        c.texto('');
    }
    c.linha();
    if (pedido.observacoes) { c.negrito(true).paragrafo('OBS: ' + pedido.observacoes).negrito(false); c.linha(); }
    c.paragrafo('Pagamento: ' + pedido.forma_pagamento + (Number(pedido.troco_para) > 0 ? ` (troco p/ ${dinheiro(pedido.troco_para)})` : ''));
    if (Number(pedido.taxa_entrega) > 0) c.paragrafo('Taxa de entrega: ' + dinheiro(pedido.taxa_entrega));
    c.destaque('TOTAL ' + dinheiro(pedido.total));
    c.linha().centro().texto('Obrigado pela preferencia!');
    return c.finalizar();
}

function montarComanda(pedido) {
    const vias = pedido.tipo_entrega === 'entrega' ? (config.vias_entrega || 2) : 1;
    return Buffer.concat(Array.from({ length: vias }, () => montarVia(pedido)));
}

// ---------- Envio pra impressora ----------
function enviarParaImpressora(bytes) {
    return new Promise((resolve, reject) => {
        const arquivo = path.join(os.tmpdir(), `comanda-${Date.now()}.bin`);
        fs.writeFileSync(arquivo, bytes);

        if (process.platform !== 'win32') {
            // fora do Windows (só pra testar o conteúdo): guarda o arquivo
            const saida = path.join(__dirname, 'ultima-comanda.bin');
            fs.copyFileSync(arquivo, saida);
            fs.unlinkSync(arquivo);
            console.log(`(Não é Windows) Comanda salva em ${saida} em vez de imprimir.`);
            return resolve();
        }

        execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'imprimir-raw.ps1'),
            '-Impressora', config.nome_impressora_windows, '-Arquivo', arquivo],
            (erro, _stdout, stderr) => {
                fs.unlink(arquivo, () => {});
                if (erro) return reject(new Error((stderr || erro.message).trim()));
                resolve();
            });
    });
}

// Fila: imprime um pedido por vez, na ordem em que chegaram
let fila = Promise.resolve();
function imprimirPedido(pedido) {
    fila = fila.then(() => enviarParaImpressora(montarComanda(pedido)))
        .then(() => console.log(`✔ Pedido #${pedido.numero_pedido_dia} impresso.`))
        .catch(err => console.error(`✖ Erro ao imprimir pedido #${pedido.numero_pedido_dia}: ${err.message}`));
    return fila;
}

// ---------- Servidor ----------
let token = null;

async function entrar() {
    const resp = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.email, senha: config.senha })
    });
    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(dados.erro || `Login recusado (${resp.status}). Confira email e senha no config.json.`);
    token = dados.token;
    console.log('Login ok como', dados.nome);
}

async function buscarPedido(id) {
    const resp = await fetch(`${API}/api/pedidos/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (resp.status === 401 || resp.status === 403) { await entrar(); return buscarPedido(id); }
    if (!resp.ok) throw new Error(`Não consegui buscar o pedido ${id} (${resp.status}).`);
    return resp.json();
}

async function iniciar() {
    if (process.argv.includes('--teste')) {
        await enviarParaImpressora(montarComanda({
            numero_pedido_dia: 0, criado_em: new Date().toISOString(), cliente_nome: 'TESTE DE IMPRESSAO',
            tipo_entrega: 'local', forma_pagamento: 'pix', total: 0,
            itens: [{ tipo_item: 'pizza', quantidade: 1, fatias: 8, sabores: ['Calabresa', 'Mussarela'], pizza_categoria: 'Tradicional', preco_unitario: 0 }]
        }));
        console.log('Comanda de teste enviada.');
        return;
    }

    while (true) {
        try { await entrar(); break; }
        catch (err) { console.error('Não consegui entrar:', err.message, '- tentando de novo em 15s...'); await new Promise(r => setTimeout(r, 15000)); }
    }

    const socket = io(API, { auth: (cb) => cb({ token }), reconnection: true, reconnectionDelay: 3000 });
    socket.on('connect', () => console.log('Conectado ao servidor. Aguardando pedidos...'));
    socket.on('disconnect', () => console.log('Desconectado - tentando reconectar...'));
    socket.on('connect_error', async (err) => {
        console.error('Erro de conexão:', err.message);
        if (/token/i.test(err.message)) { try { await entrar(); } catch (e) { console.error(e.message); } }
    });
    socket.on('novoPedido', async (dados) => {
        try { imprimirPedido(await buscarPedido(dados.pedidoId)); }
        catch (err) { console.error('Erro no pedido novo:', err.message); }
    });
}

iniciar().catch(err => { console.error(err.message); process.exit(1); });
