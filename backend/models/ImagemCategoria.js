const db = require('../config/db');

const ImagemCategoria = {
    async listarTodas() {
        const [rows] = await db.query('SELECT * FROM imagens_categoria');
        return rows;
    },

    async atualizar(categoria, imagem_url) {
        await db.query(
            'UPDATE imagens_categoria SET imagem_url = ? WHERE categoria = ?',
            [imagem_url, categoria]
        );
    }
};

module.exports = ImagemCategoria;
