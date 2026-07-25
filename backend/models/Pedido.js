const db = require('../config/db');

const Pedido = {
    // Cria o pedido + seus itens dentro de uma transação
    // (se algum item falhar, o pedido inteiro é desfeito)
    async criar({ cliente_nome, telefone, tipo_entrega, endereco, observacoes, forma_pagamento, troco_para, taxa_entrega, cupom_codigo, desconto, total, itens, dia_operacional }) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [resultPedido] = await connection.query(
                `INSERT INTO pedidos (cliente_nome, telefone, tipo_entrega, endereco, observacoes, forma_pagamento, troco_para, taxa_entrega, cupom_codigo, desconto, total, dia_operacional)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [cliente_nome, telefone || null, tipo_entrega, endereco || null, observacoes || null, forma_pagamento, troco_para || 0, taxa_entrega || 0, cupom_codigo || null, desconto || 0, total, dia_operacional]
            );

            const pedidoId = resultPedido.insertId;

            for (const item of itens) {
                await connection.query(
                    `INSERT INTO itens_pedido (pedido_id, tipo_item, pizza_categoria, fatias, sabores, borda, nome_item, quantidade, preco_unitario)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        pedidoId,
                        item.tipo_item,
                        item.pizza_categoria || null,
                        item.fatias || null,
                        item.sabores ? JSON.stringify(item.sabores) : null,
                        item.borda || null,
                        item.nome_item || null,
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

    // Junta os itens de uma lista de pedidos já carregada (1 consulta extra
    // no total, em vez de 1 consulta por pedido) - reaproveitado tanto pelo
    // dia atual quanto pelo histórico de dias anteriores.
    async _comItens(pedidos) {
        if (pedidos.length === 0) return [];

        const ids = pedidos.map(p => p.id);
        const [todosOsItens] = await db.query('SELECT * FROM itens_pedido WHERE pedido_id IN (?)', [ids]);

        const itensPorPedido = new Map();
        todosOsItens.forEach(item => {
            if (!itensPorPedido.has(item.pedido_id)) itensPorPedido.set(item.pedido_id, []);
            itensPorPedido.get(item.pedido_id).push(item);
        });

        return pedidos.map(p => ({ ...p, itens: itensPorPedido.get(p.id) || [] }));
    },

    // Usado pela aba "Pedidos" do painel/cozinha: só o expediente em curso.
    // Reinicia sozinha a cada novo dia operacional, sem precisar de nenhuma
    // ação manual de "fechar o dia".
    async listarPorDiaOperacional(diaOperacional) {
        const [pedidos] = await db.query(
            'SELECT * FROM pedidos WHERE dia_operacional = ? ORDER BY criado_em DESC',
            [diaOperacional]
        );
        return this._comItens(pedidos);
    },

    // Usado pela aba "Histórico": lista os dias com movimento, mais recentes
    // primeiro, já com contagem e total do dia (pra mostrar um resumo antes
    // de abrir os pedidos de um dia específico).
    async listarDiasComPedidos() {
        const [dias] = await db.query(
            `SELECT dia_operacional, COUNT(*) AS total_pedidos, SUM(total) AS total_faturado
             FROM pedidos
             GROUP BY dia_operacional
             ORDER BY dia_operacional DESC`
        );
        return dias;
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
        // O ON DELETE CASCADE na tabela itens_pedido já apaga os itens junto,
        // não precisa de um DELETE separado pra eles.
        await db.query('DELETE FROM pedidos WHERE id = ?', [id]);
    }
};

module.exports = Pedido;
