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
    try {
        await Configuracao.atualizar(req.body);
        res.json({ mensagem: 'Configurações atualizadas com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar configurações.' });
    }
};
