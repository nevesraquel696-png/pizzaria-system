// Módulo de impressão - por enquanto só simula no console.
// Quando for integrar com impressora térmica real, o mais comum é usar
// a lib "node-thermal-printer" (protocolo ESC/POS) - deixamos a função
// pronta pra ser trocada por chamadas reais depois.

function imprimirComanda(pedido) {
    const numeroCopias = pedido.tipo_entrega === 'entrega' ? 2 : 1;

    for (let i = 0; i < numeroCopias; i++) {
        console.log('--------------------------------');
        console.log(`COMANDA - via ${i + 1}/${numeroCopias}`);
        console.log(`Pedido #${pedido.pedidoId ?? pedido.id}`);
        console.log(`Cliente: ${pedido.cliente_nome}`);
        console.log(`Tipo: ${pedido.tipo_entrega}`);
        console.log(`Total: R$ ${Number(pedido.total).toFixed(2)}`);
        console.log('--------------------------------');
    }
}

module.exports = { imprimirComanda };
