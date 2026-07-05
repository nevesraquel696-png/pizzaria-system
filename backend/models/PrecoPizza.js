const db = require('../config/db');

const CATEGORIAS_VALIDAS = ['tradicional', 'especial', 'doce', 'promocao'];
const FATIAS_VALIDAS = [4, 6, 8, 12, 14];

const PrecoPizza = {
    async listarTodos() {
        const [rows] = await db.query('SELECT * FROM precos_pizza ORDER BY categoria, fatias');
        return rows;
    },

    async obterPreco(categoria, fatias) {
        const [rows] = await db.query(
            'SELECT preco FROM precos_pizza WHERE categoria = ? AND fatias = ?',
            [categoria, fatias]
        );
        return rows[0] ? Number(rows[0].preco) : null;
    },

    async atualizarPreco(categoria, fatias, preco) {
        if (!CATEGORIAS_VALIDAS.includes(categoria)) throw new Error('Categoria inválida.');
        if (!FATIAS_VALIDAS.includes(Number(fatias))) throw new Error('Número de fatias inválido.');

        await db.query(
            `INSERT INTO precos_pizza (categoria, fatias, preco) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE preco = ?`,
            [categoria, fatias, preco, preco]
        );
    }
};

module.exports = { PrecoPizza, CATEGORIAS_VALIDAS, FATIAS_VALIDAS };
