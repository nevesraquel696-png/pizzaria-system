const db = require('../config/db');

const Usuario = {
    async buscarPorEmail(email) {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
        return rows[0] || null;
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
