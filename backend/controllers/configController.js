const Configuracao = require('../models/Configuracao');

exports.obter = async (req, res) => {
    try {
        const config = await Configuracao.obter();
        res.json(config);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar configuração.' });
    }
};

exports.atualizar = async (req, res) => {
    const { horario_abertura, horario_fechamento } = req.body;
    if (!horario_abertura || !horario_fechamento) {
        return res.status(400).json({ erro: 'Informe abertura e fechamento.' });
    }

    try {
        await Configuracao.atualizar({ horario_abertura, horario_fechamento });
        res.json({ mensagem: 'Horário atualizado com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar horário.' });
    }
};
