const db = require('../config/db');

// Bloqueia novos pedidos fora do horário de funcionamento da pizzaria.
//
// IMPORTANTE: usamos explicitamente o fuso "America/Sao_Paulo" aqui,
// em vez de confiar no horário do servidor. Isso porque serviços como
// o Render rodam os containers em UTC por padrão - sem isso, a comparação
// ficaria 3 horas errada e a pizzaria pareceria "fechada" quando não está.
const verificarHorarioFuncionamento = async (req, res, next) => {
    try {
        const agora = new Date();
        const horaAtual = agora.toLocaleTimeString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour12: false
        }); // formato "HH:MM:SS"

        const [results] = await db.query(
            'SELECT horario_abertura, horario_fechamento FROM configuracoes LIMIT 1'
        );

        if (results.length === 0) {
            return res.status(500).json({ erro: 'Configuração de horário não encontrada.' });
        }

        const { horario_abertura, horario_fechamento } = results[0];

        console.log('--- Verificação de horário ---');
        console.log('Hora atual (Brasil):', JSON.stringify(horaAtual));
        console.log('Abertura configurada:', JSON.stringify(horario_abertura));
        console.log('Fechamento configurado:', JSON.stringify(horario_fechamento));
        console.log('Resultado: hora < abertura?', horaAtual < horario_abertura, '| hora > fechamento?', horaAtual > horario_fechamento);

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
