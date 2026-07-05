const { PrecoPizza, CATEGORIAS_VALIDAS, FATIAS_VALIDAS } = require('../models/PrecoPizza');

exports.listar = async (req, res) => {
    try {
        const precos = await PrecoPizza.listarTodos();
        res.json(precos);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar preços.' });
    }
};

// Atualiza várias combinações categoria/fatias de uma vez.
// Body esperado: { precos: [{ categoria, fatias, preco }, ...] }
exports.atualizarEmLote = async (req, res) => {
    const { precos } = req.body;
    if (!Array.isArray(precos) || precos.length === 0) {
        return res.status(400).json({ erro: 'Envie uma lista de preços.' });
    }

    try {
        for (const item of precos) {
            await PrecoPizza.atualizarPreco(item.categoria, item.fatias, item.preco);
        }
        res.json({ mensagem: 'Preços atualizados com sucesso.' });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
};

exports.categoriasEFatiasValidas = (req, res) => {
    res.json({ categorias: CATEGORIAS_VALIDAS, fatias: FATIAS_VALIDAS });
};
