// ============================================
// IMPRESSÃO DE COMANDA
//
// Como o backend roda na nuvem (Render) e a impressora fica fisicamente na
// pizzaria, quem imprime é o NAVEGADOR do computador da pizzaria - usando a
// impressora configurada como padrão no Windows (funciona com impressora
// térmica normalmente, já que ela aparece como impressora comum pro sistema
// depois de instalada). Por isso a impressão só funciona com o painel admin
// aberto naquele computador.
// ============================================


// Largura do papel da impressora DESTE computador (58 ou 80mm). Fica salva no
// navegador - a impressora é local, então cada computador tem a sua.
function larguraPapelMm() {
    const salva = Number(localStorage.getItem('pizzaria_largura_papel'));
    return salva === 48 ? 48 : 70;
}

function descreverItemComanda(item) {
    if (item.tipo_item === 'pizza') {
        const sabores = Array.isArray(item.sabores) ? item.sabores : (item.sabores ? JSON.parse(item.sabores) : []);
        const rotuloPromocao = item.nome_item ? `[${escapeHtml(item.nome_item)}]<br>&nbsp;&nbsp;` : '';
        return `${rotuloPromocao}${item.quantidade}x Pizza ${item.pizza_categoria ? escapeHtml(item.pizza_categoria) + ' ' : ''}(${item.fatias} fatias)<br>&nbsp;&nbsp;${escapeHtml(sabores.join(', '))}${item.borda ? '<br>&nbsp;&nbsp;+ borda ' + escapeHtml(item.borda) : ''}`;
    }
    const nome = item.nome_item ? escapeHtml(item.nome_item) : (item.tipo_item === 'bebida' ? 'Bebida (pedido antigo)' : 'Item (pedido antigo)');
    return `${item.quantidade}x ${nome} - R$ ${Number(item.preco_unitario).toFixed(2)} cada`;
}

// Monta o HTML de UMA via da comanda
function construirViaComanda(pedido) {
    const data = new Date(pedido.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    return `
        <div class="via-comanda">
            <div class="comanda-cabecalho">
                <strong>ESTAÇÃO DA PIZZA</strong>
                <div>Pedido #${String(pedido.numero_pedido_dia).padStart(4, '0')}</div>
                <div>${data}</div>
            </div>
            <hr>
            <div><strong>Cliente:</strong> ${escapeHtml(pedido.cliente_nome)}</div>
            <div><strong>Tipo:</strong> ${escapeHtml(pedido.tipo_entrega)}</div>
            ${pedido.tipo_entrega === 'entrega' ? `
                <div><strong>Endereço:</strong> ${escapeHtml(pedido.endereco) || '-'}</div>
                <div><strong>Telefone:</strong> ${escapeHtml(pedido.telefone) || '-'}</div>
            ` : ''}
            <hr>
            <div class="comanda-itens">
                ${(pedido.itens || []).map(item => `<div class="comanda-item">${descreverItemComanda(item)}</div>`).join('')}
            </div>
            <hr>
            ${pedido.observacoes ? `<div><strong>Observações:</strong> ${escapeHtml(pedido.observacoes)}</div><hr>` : ''}
            <div><strong>Pagamento:</strong> ${escapeHtml(pedido.forma_pagamento)}${pedido.troco_para > 0 ? ` (troco p/ R$ ${Number(pedido.troco_para).toFixed(2)})` : ''}</div>
            ${pedido.taxa_entrega > 0 ? `<div><strong>Taxa de entrega:</strong> R$ ${Number(pedido.taxa_entrega).toFixed(2)}</div>` : ''}
            <div class="comanda-total"><strong>TOTAL: R$ ${Number(pedido.total).toFixed(2)}</strong></div>
            <hr>
            <div style="text-align:center;">Obrigado pela preferência!</div>
        </div>
    `;
}

// Envia a comanda pra impressão. Se for entrega, imprime 2 vias no mesmo
// trabalho de impressão (like o sistema original pedia: 2 vias quando entrega).
function imprimirComanda(pedido) {
    const numeroVias = pedido.tipo_entrega === 'entrega' ? 2 : 1;
    const htmlVias = Array.from({ length: numeroVias }, () => construirViaComanda(pedido)).join('<div class="quebra-pagina"></div>');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                @page { size: ${larguraPapelMm()}mm auto; margin: ${larguraPapelMm() === 58 ? 2 : 4}mm; }
                body { font-family: 'Courier New', monospace; font-size: ${larguraPapelMm() === 58 ? 11 : 12}px; color: #000; margin: 0; }
                hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
                .comanda-cabecalho { text-align: center; }
                .comanda-item { margin: 4px 0; }
                .comanda-total { margin-top: 6px; font-size: 14px; }
                .quebra-pagina { page-break-after: always; }
            </style>
        </head>
        <body>${htmlVias}</body>
        </html>
    `);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 1000);
    }, 250);
}

// Comanda de teste, pra conferir se a MTI-773 está imprimindo certo (largura,
// corte e se sai sem abrir a janela de impressão).
function imprimirTeste() {
    imprimirComanda({
        numero_pedido_dia: 0,
        criado_em: new Date().toISOString(),
        cliente_nome: 'TESTE DE IMPRESSÃO',
        tipo_entrega: 'local',
        itens: [{ tipo_item: 'pizza', quantidade: 1, fatias: 8, sabores: ['Sabor de teste'], pizza_categoria: 'Teste', preco_unitario: 0 }],
        forma_pagamento: 'pix',
        total: 0
    });
}

// Usado pelo botão manual de cada pedido - reaproveita os dados já carregados
// na tela (sem precisar buscar de novo no servidor)
function imprimirComandaPorId(id) {
    const pedido = PEDIDOS_ATUAIS.find(p => p.id === id);
    if (!pedido) return alert('Pedido não encontrado na lista atual. Atualize a página e tente de novo.');
    imprimirComanda(pedido);
}
