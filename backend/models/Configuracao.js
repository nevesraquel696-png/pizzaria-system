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
            whatsapp_numero: campos.whatsapp_numero ?? atual.whatsapp_numero,
            promocao_ativa: campos.promocao_ativa ?? atual.promocao_ativa,
            promocao_texto: campos.promocao_texto ?? atual.promocao_texto,
            logo_base64: campos.logo_base64 !== undefined ? campos.logo_base64 : atual.logo_base64,
            sino_base64: campos.sino_base64 !== undefined ? campos.sino_base64 : atual.sino_base64,
            cor_primaria: campos.cor_primaria !== undefined ? campos.cor_primaria : atual.cor_primaria,
            cor_destaque: campos.cor_destaque !== undefined ? campos.cor_destaque : atual.cor_destaque
        };

        await db.query(
            `UPDATE configuracoes SET horario_abertura = ?, horario_fechamento = ?,
             taxa_entrega = ?, chave_pix = ?, whatsapp_numero = ?,
             promocao_ativa = ?, promocao_texto = ?, logo_base64 = ?, sino_base64 = ?,
             cor_primaria = ?, cor_destaque = ? WHERE id = ?`,
            [dados.horario_abertura, dados.horario_fechamento, dados.taxa_entrega, dados.chave_pix, dados.whatsapp_numero,
             dados.promocao_ativa, dados.promocao_texto, dados.logo_base64, dados.sino_base64,
             dados.cor_primaria, dados.cor_destaque, atual.id]
        );
    }
};

module.exports = Configuracao;
