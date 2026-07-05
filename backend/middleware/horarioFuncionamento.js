const db = require('../config/db');

// Bloqueia novos pedidos fora do horário de funcionamento da pizzaria
const verificarHorarioFuncionamento = async (req, res, next) => {
    try {
        const agora = new Date();
        const horaAtual = agora.toTimeString().split(' ')[0]; // HH:MM:SS

        const [results] = await db.query(
            'SELECT horario_abertura, horario_fechamento FROM configuracoes LIMIT 1'
        );

        if (results.length === 0) {
            return res.status(500).json({ erro: 'Configuração de horário não encontrada.' });
        }

        const { horario_abertura, horario_fechamento } = results[0];

        if (horaAtual < horario_abertura || horaAtual > horario_fechamento) {
            return res.status(403).json({
                fechado: true,
                mensagem: `Pizzaria fechada! Horário de funcionamento: ${horario_abertura} às ${horario_fechamento}.`
            });
        }

        next();
    } catch (err) {
        console.error('Erro ao verificar horário:', err.message);
        res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
};

module.exports = verificarHorarioFuncionamento;
