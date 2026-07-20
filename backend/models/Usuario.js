const db = require('../config/db');

const Usuario = {
    async buscarPorEmail(email) {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        return rows[0] || null;
    },

    async contar() {
        const [rows] = await db.query('SELECT COUNT(*) AS total FROM usuarios');
        return rows[0].total;
    },

    async criar({ nome, email, senha_hash, nivel }) {
        const [result] = await db.query(
            'INSERT INTO usuarios (nome, email, senha_hash, nivel) VALUES (?, ?, ?, ?)',
            [nome, email, senha_hash, nivel || 'admin']
        );
        return result.insertId;
    }
};

module.exports = Usuario;
