const db = require('../config/db');

const Configuracao = {
    async obter() {
        const [rows] = await db.query('SELECT * FROM configuracoes LIMIT 1');
        return rows[0];
    },

    async atualizar({ horario_abertura, horario_fechamento }) {
        const atual = await this.obter();
        await db.query(
            'UPDATE configuracoes SET horario_abertura = ?, horario_fechamento = ? WHERE id = ?',
            [horario_abertura, horario_fechamento, atual.id]
        );
    }
};

module.exports = Configuracao;
