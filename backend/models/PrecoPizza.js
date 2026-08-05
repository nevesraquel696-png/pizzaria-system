const db = require('../config/db');

const FATIAS_VALIDAS = [4, 6, 8, 12, 14];

const PrecoPizza = {
    async listarTodos() {
        const [rows] = await db.query('SELECT * FROM precos_pizza ORDER BY secao_id, fatias');
        return rows;
    },

    async obterPreco(secao_id, fatias) {
        const [rows] = await db.query(
            'SELECT preco FROM precos_pizza WHERE secao_id = ? AND fatias = ?',
            [secao_id, fatias]
        );
        return rows[0] ? Number(rows[0].preco) : null;
    },

    // A seção precisa existir de verdade (é validada contra o banco, nunca
    // confiamos só no id que chegou do formulário) - assim não dá pra criar
    // uma linha de preço "órfã", apontando pra uma seção inexistente.
    async atualizarPreco(secao_id, fatias, preco) {
        if (!FATIAS_VALIDAS.includes(Number(fatias))) throw new Error('Número de fatias inválido.');

        const [secoes] = await db.query('SELECT id FROM secoes_cardapio WHERE id = ?', [secao_id]);
        if (secoes.length === 0) throw new Error('Seção do cardápio inválida.');

        await db.query(
            `INSERT INTO precos_pizza (secao_id, fatias, preco) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE preco = ?`,
            [secao_id, fatias, preco, preco]
        );
    }
};

module.exports = { PrecoPizza, FATIAS_VALIDAS };
