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

        // Quando o fechamento passa da meia-noite (ex: abre 17:30, fecha
        // 01:00), o horário de fechamento em número é "menor" que o de
        // abertura. Nesse caso a lógica de comparação precisa ser invertida:
        // a loja está aberta se a hora atual for >= abertura OU <= fechamento
        // (em vez de "entre" abertura e fechamento, como no caso normal).
        const cruzaMeiaNoite = horario_fechamento < horario_abertura;
        const aberto = cruzaMeiaNoite
            ? (horaAtual >= horario_abertura || horaAtual <= horario_fechamento)
            : (horaAtual >= horario_abertura && horaAtual <= horario_fechamento);

        if (!aberto) {
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
