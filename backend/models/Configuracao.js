const db = require('../config/db');

const Configuracao = {
    async obter() {
        const [rows] = await db.query('SELECT * FROM configuracoes LIMIT 1');
        return rows[0];
    },

    // Aceita atualização parcial: só muda os campos que vierem preenchidos,
    // mantendo os demais como estavam (evita apagar a taxa/pix sem querer
    // quando só o horário é salvo, por exemplo).
    async atualizar(campos) {
        const atual = await this.obter();
        const dados = {
            horario_abertura: campos.horario_abertura ?? atual.horario_abertura,
            horario_fechamento: campos.horario_fechamento ?? atual.horario_fechamento,
            taxa_entrega: campos.taxa_entrega ?? atual.taxa_entrega,
            chave_pix: campos.chave_pix ?? atual.chave_pix,
            whatsapp_numero: campos.whatsapp_numero ?? atual.whatsapp_numero
        };

        await db.query(
            `UPDATE configuracoes SET horario_abertura = ?, horario_fechamento = ?,
             taxa_entrega = ?, chave_pix = ?, whatsapp_numero = ? WHERE id = ?`,
            [dados.horario_abertura, dados.horario_fechamento, dados.taxa_entrega, dados.chave_pix, dados.whatsapp_numero, atual.id]
        );
    }
};

module.exports = Configuracao;
