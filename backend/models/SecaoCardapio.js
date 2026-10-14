const db = require('../config/db');

const SecaoCardapio = {
    async listarTodas() {
        const [rows] = await db.query('SELECT * FROM secoes_cardapio ORDER BY ordem, id');
        return rows;
    },

    async buscarPorId(id) {
        const [rows] = await db.query('SELECT * FROM secoes_cardapio WHERE id = ?', [id]);
        return rows[0] || null;
    },

    // Nova seção entra sempre no fim da lista (maior ordem + 1), pra não
    // precisar o admin reordenar toda vez que cria uma.
    async criar(nome) {
        const [[{ maxOrdem }]] = await db.query('SELECT COALESCE(MAX(ordem), 0) AS maxOrdem FROM secoes_cardapio');
        const [resultado] = await db.query(
            'INSERT INTO secoes_cardapio (nome, ordem) VALUES (?, ?)',
            [nome, maxOrdem + 1]
        );
        // Junto com a seção, já cria as 5 linhas de preço (uma por tamanho)
        // zeradas, pra aparecer pronta pra editar na aba Preços.
        const fatiasPadrao = [4, 6, 8, 12, 14];
        await Promise.all(fatiasPadrao.map(fatias =>
            db.query('INSERT INTO precos_pizza (secao_id, fatias, preco) VALUES (?, ?, 0)', [resultado.insertId, fatias])
        ));
        return resultado.insertId;
    },

    async renomear(id, nome) {
        await db.query('UPDATE secoes_cardapio SET nome = ? WHERE id = ?', [nome, id]);
    },

    // Recebe a lista de ids na nova ordem desejada e grava 1, 2, 3... nela
    async reordenar(idsOrdenados) {
        await Promise.all(idsOrdenados.map((id, indice) =>
            db.query('UPDATE secoes_cardapio SET ordem = ? WHERE id = ?', [indice + 1, id])
        ));
    },

    async contarProdutosVinculados(id) {
        const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM produtos WHERE secao_id = ?', [id]);
        return total;
    },

    // precos_pizza é apagado junto (ON DELETE CASCADE) - não faz sentido
    // manter preço de uma seção que não existe mais.
    async excluir(id) {
        await db.query('DELETE FROM secoes_cardapio WHERE id = ?', [id]);
    }
};

module.exports = SecaoCardapio;
