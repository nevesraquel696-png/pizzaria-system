const db = require('../config/db');

const Produto = {
    async listarTodos() {
        const [produtos] = await db.query('SELECT * FROM produtos ORDER BY tipo, nome');
        return produtos;
    },

    async listarDisponiveis() {
        const [produtos] = await db.query('SELECT * FROM produtos WHERE disponivel = TRUE ORDER BY tipo, nome');
        return produtos;
    },

    async criar({ nome, tipo, categoria, preco_base, descricao, imagem_base64 }) {
        const [result] = await db.query(
            'INSERT INTO produtos (nome, tipo, categoria, preco_base, descricao, imagem_base64) VALUES (?, ?, ?, ?, ?, ?)',
            [nome, tipo, tipo === 'sabor_pizza' ? categoria : null, tipo === 'sabor_pizza' ? 0 : (preco_base || 0), descricao || null, imagem_base64 || null]
        );
        return result.insertId;
    },

    async atualizar(id, { nome, tipo, categoria, preco_base, descricao }) {
        await db.query(
            'UPDATE produtos SET nome = ?, tipo = ?, categoria = ?, preco_base = ?, descricao = ? WHERE id = ?',
            [nome, tipo, tipo === 'sabor_pizza' ? categoria : null, tipo === 'sabor_pizza' ? 0 : (preco_base || 0), descricao || null, id]
        );
    },

    // Só a foto - separado do atualizar() geral pra não arriscar sobrescrever
    // o resto do produto sem querer.
    async atualizarImagem(id, imagem_base64) {
        await db.query('UPDATE produtos SET imagem_base64 = ? WHERE id = ?', [imagem_base64, id]);
    },

    async buscarPorIds(ids) {
        if (!ids || ids.length === 0) return [];
        const [rows] = await db.query('SELECT * FROM produtos WHERE id IN (?)', [ids]);
        return rows;
    },

    async alternarDisponibilidade(id) {
        await db.query('UPDATE produtos SET disponivel = NOT disponivel WHERE id = ?', [id]);
    },

    async excluir(id) {
        await db.query('DELETE FROM produtos WHERE id = ?', [id]);
    }
};

module.exports = Produto;
