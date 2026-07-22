const db = require('../config/db');

const ImagemCategoria = {
    async listarTodas() {
        const [rows] = await db.query('SELECT * FROM imagens_categoria');
        return rows;
    },

    async buscarPorCategoria(categoria) {
        const [rows] = await db.query('SELECT * FROM imagens_categoria WHERE categoria = ?', [categoria]);
        return rows[0] || null;
    },

    async atualizar(categoria, imagem_url, imagem_public_id) {
        await db.query(
            'UPDATE imagens_categoria SET imagem_url = ?, imagem_public_id = ? WHERE categoria = ?',
            [imagem_url, imagem_public_id, categoria]
        );
    }
};

module.exports = ImagemCategoria;
