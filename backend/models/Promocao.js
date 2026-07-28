const db = require('../config/db');

// Deixa sabor_ids sempre como array de números no JS, seja lá como o driver
// devolver a coluna JSON (alguns setups devolvem string, outros já parseado).
function mapear(linha) {
    if (!linha) return null;
    const sabor_ids = typeof linha.sabor_ids === 'string' ? JSON.parse(linha.sabor_ids) : linha.sabor_ids;
    return { ...linha, sabor_ids };
}

const Promocao = {
    // Público - só as promoções ligadas, pro cardápio do cliente
    async listarAtivas() {
        const [linhas] = await db.query('SELECT * FROM promocoes WHERE ativo = TRUE ORDER BY criado_em DESC');
        return linhas.map(mapear);
    },

    // Admin - todas, ligadas ou não
    async listarTodas() {
        const [linhas] = await db.query('SELECT * FROM promocoes ORDER BY criado_em DESC');
        return linhas.map(mapear);
    },

    async buscarPorId(id) {
        const [linhas] = await db.query('SELECT * FROM promocoes WHERE id = ?', [id]);
        return mapear(linhas[0]);
    },

    async buscarPorIds(ids) {
        if (!ids || ids.length === 0) return [];
        const [linhas] = await db.query('SELECT * FROM promocoes WHERE id IN (?)', [ids]);
        return linhas.map(mapear);
    },

    async criar({ nome, fatias, sabor_ids, preco_de, preco_por }) {
        const [resultado] = await db.query(
            `INSERT INTO promocoes (nome, fatias, sabor_ids, preco_de, preco_por) VALUES (?, ?, ?, ?, ?)`,
            [nome.trim(), fatias, JSON.stringify(sabor_ids), preco_de, preco_por]
        );
        return resultado.insertId;
    },

    async atualizar(id, { nome, fatias, sabor_ids, preco_de, preco_por, ativo }) {
        await db.query(
            `UPDATE promocoes SET nome = ?, fatias = ?, sabor_ids = ?, preco_de = ?, preco_por = ?, ativo = ? WHERE id = ?`,
            [nome.trim(), fatias, JSON.stringify(sabor_ids), preco_de, preco_por, ativo ? 1 : 0, id]
        );
    },

    async alternarAtiva(id) {
        await db.query('UPDATE promocoes SET ativo = NOT ativo WHERE id = ?', [id]);
    },

    async excluir(id) {
        await db.query('DELETE FROM promocoes WHERE id = ?', [id]);
    }
};

module.exports = Promocao;
