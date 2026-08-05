const db = require('../config/db');

const Configuracao = {
    async obter() {
        const [rows] = await db.query('SELECT * FROM configuracoes LIMIT 1');
        const config = rows[0];
        if (config && typeof config.tema_cores === 'string') {
            // O driver às vezes devolve o JSON como string crua - normaliza
            // pra sempre entregar objeto (ou null) pro resto do código.
            try { config.tema_cores = JSON.parse(config.tema_cores); } catch { config.tema_cores = null; }
        }
        return config;
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
            promocao_texto: campos.promocao_texto ?? atual.promocao_texto
        };

        await db.query(
            `UPDATE configuracoes SET horario_abertura = ?, horario_fechamento = ?,
             taxa_entrega = ?, chave_pix = ?, whatsapp_numero = ?,
             promocao_ativa = ?, promocao_texto = ? WHERE id = ?`,
            [dados.horario_abertura, dados.horario_fechamento, dados.taxa_entrega, dados.chave_pix, dados.whatsapp_numero,
             dados.promocao_ativa, dados.promocao_texto, atual.id]
        );
    },

    // Cores do tema (JSON) - separado do atualizar() geral porque tem sua
    // própria tela ("Aparência") e regra de validação de tamanho.
    async atualizarCores(tema_cores) {
        const atual = await this.obter();
        await db.query('UPDATE configuracoes SET tema_cores = ? WHERE id = ?', [JSON.stringify(tema_cores), atual.id]);
    },

    // Logotipo - mesmo esquema em base64 usado pelas fotos de produto/tamanho:
    // direto no banco, nunca em arquivo no servidor (que some a cada reinício
    // em serviços como o Render).
    async atualizarLogo(logo_base64) {
        const atual = await this.obter();
        await db.query('UPDATE configuracoes SET logo_base64 = ? WHERE id = ?', [logo_base64, atual.id]);
    }
};

module.exports = Configuracao;
