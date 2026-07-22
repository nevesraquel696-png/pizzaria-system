const db = require('../config/db');

const Cupom = {
    async listarTodos() {
        const [rows] = await db.query('SELECT * FROM cupons ORDER BY criado_em DESC');
        return rows;
    },

    async buscarPorCodigo(codigo) {
        const [rows] = await db.query('SELECT * FROM cupons WHERE codigo = ?', [codigo]);
        return rows[0] || null;
    },

    async criar({ codigo, tipo, valor, validade, limite_uso }) {
        const [resultado] = await db.query(
            `INSERT INTO cupons (codigo, tipo, valor, validade, limite_uso)
             VALUES (?, ?, ?, ?, ?)`,
            [codigo.trim().toUpperCase(), tipo, valor, validade || null, limite_uso || null]
        );
        return resultado.insertId;
    },

    async atualizar(id, { tipo, valor, validade, limite_uso, ativo }) {
        await db.query(
            `UPDATE cupons SET tipo = ?, valor = ?, validade = ?, limite_uso = ?, ativo = ? WHERE id = ?`,
            [tipo, valor, validade || null, limite_uso || null, ativo ? 1 : 0, id]
        );
    },

    async incrementarUso(id) {
        await db.query('UPDATE cupons SET usos_atuais = usos_atuais + 1 WHERE id = ?', [id]);
    },

    async excluir(id) {
        await db.query('DELETE FROM cupons WHERE id = ?', [id]);
    }
};

module.exports = Cupom;
