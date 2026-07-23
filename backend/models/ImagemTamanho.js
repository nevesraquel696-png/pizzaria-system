const db = require('../config/db');

const ImagemTamanho = {
    async listarTodas() {
        const [rows] = await db.query('SELECT * FROM imagens_tamanho ORDER BY fatias');
        return rows;
    },

    async atualizar(fatias, imagem_base64) {
        await db.query(
            'UPDATE imagens_tamanho SET imagem_base64 = ? WHERE fatias = ?',
            [imagem_base64, fatias]
        );
    }
};

module.exports = ImagemTamanho;
