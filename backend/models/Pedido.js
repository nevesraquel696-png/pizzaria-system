const db = require('../config/db');

const Pedido = {
    // Cria o pedido + seus itens dentro de uma transação
    // (se algum item falhar, o pedido inteiro é desfeito)
    async criar({ cliente_nome, telefone, tipo_entrega, endereco, forma_pagamento, troco_para, total, itens }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [resultPedido] = await connection.query(
                `INSERT INTO pedidos (cliente_nome, telefone, tipo_entrega, endereco, forma_pagamento, troco_para, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [cliente_nome, telefone || null, tipo_entrega, endereco || null, forma_pagamento, troco_para || 0, total]
            );

            const pedidoId = resultPedido.insertId;

            for (const item of itens) {
                await connection.query(
                    `INSERT INTO itens_pedido (pedido_id, tipo_item, pizza_categoria, fatias, sabores, borda, quantidade, preco_unitario)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        pedidoId,
                        item.tipo_item,
                        item.pizza_categoria || null,
                        item.fatias || null,
                        item.sabores ? JSON.stringify(item.sabores) : null,
                        item.borda || null,
                        item.quantidade || 1,
                        item.preco_unitario
                    ]
                );
            }

            await connection.commit();
            return pedidoId;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    async listarTodos() {
        const [pedidos] = await db.query('SELECT * FROM pedidos ORDER BY criado_em DESC');
        return pedidos;
    },

    async buscarPorId(id) {
        const [pedidos] = await db.query('SELECT * FROM pedidos WHERE id = ?', [id]);
        if (pedidos.length === 0) return null;

        const [itens] = await db.query('SELECT * FROM itens_pedido WHERE pedido_id = ?', [id]);
        return { ...pedidos[0], itens };
    },

    async atualizarStatus(id, status) {
        const statusValidos = ['pendente', 'preparo', 'saiu_entrega', 'entregue'];
        if (!statusValidos.includes(status)) {
            throw new Error('Status inválido');
        }
        await db.query('UPDATE pedidos SET status = ? WHERE id = ?', [status, id]);
    },

    async incrementarImpressao(id) {
        await db.query('UPDATE pedidos SET vezes_impresso = vezes_impresso + 1 WHERE id = ?', [id]);
    },

    async excluir(id) {
    await db.query('DELETE FROM pedidos WHERE id = ?', [id]);
    }
    
    

};

module.exports = Pedido;
