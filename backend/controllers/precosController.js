const { PrecoPizza, FATIAS_VALIDAS } = require('../models/PrecoPizza');
const cache = require('../utils/cache');

exports.listar = async (req, res) => {
    const emCache = cache.obter('precos-pizza');
    if (emCache) return res.json(emCache);

    try {
        const precos = await PrecoPizza.listarTodos();
        cache.definir('precos-pizza', precos, 30000);
        res.json(precos);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar preços.' });
    }
};

// Atualiza várias combinações seção/fatias de uma vez.
// Body esperado: { precos: [{ secao_id, fatias, preco }, ...] }
exports.atualizarEmLote = async (req, res) => {
    const { precos } = req.body;
    if (!Array.isArray(precos) || precos.length === 0) {
        return res.status(400).json({ erro: 'Envie uma lista de preços.' });
    }

    try {
        // Todas as atualizações em paralelo, em vez de uma esperando a outra
        await Promise.all(precos.map(item => PrecoPizza.atualizarPreco(item.secao_id, item.fatias, item.preco)));
        cache.invalidar('precos-pizza');
        res.json({ mensagem: 'Preços atualizados com sucesso.' });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
};

exports.fatiasValidas = (req, res) => {
    res.json({ fatias: FATIAS_VALIDAS });
};
