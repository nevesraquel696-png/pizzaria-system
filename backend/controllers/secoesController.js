const SecaoCardapio = require('../models/SecaoCardapio');
const cache = require('../utils/cache');

function invalidarCaches() {
    cache.invalidar('secoes-cardapio');
    cache.invalidar('produtos:disponiveis');
    cache.invalidar('produtos:todos');
    cache.invalidar('precos-pizza');
}

exports.listar = async (req, res) => {
    const emCache = cache.obter('secoes-cardapio');
    if (emCache) return res.json(emCache);

    try {
        const secoes = await SecaoCardapio.listarTodas();
        cache.definir('secoes-cardapio', secoes, 30000);
        res.json(secoes);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar seções do cardápio.' });
    }
};

exports.criar = async (req, res) => {
    const nome = (req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ erro: 'Informe o nome da seção.' });
    if (nome.length > 100) return res.status(400).json({ erro: 'Nome muito longo (máximo 100 caracteres).' });

    try {
        const id = await SecaoCardapio.criar(nome);
        invalidarCaches();
        res.status(201).json({ mensagem: 'Seção criada com sucesso.', id });
    } catch (err) {
        console.error('Erro ao criar seção:', err.message);
        res.status(500).json({ erro: 'Erro ao criar seção.' });
    }
};

exports.renomear = async (req, res) => {
    const nome = (req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ erro: 'Informe o nome da seção.' });
    if (nome.length > 100) return res.status(400).json({ erro: 'Nome muito longo (máximo 100 caracteres).' });

    try {
        const secao = await SecaoCardapio.buscarPorId(req.params.id);
        if (!secao) return res.status(404).json({ erro: 'Seção não encontrada.' });

        await SecaoCardapio.renomear(req.params.id, nome);
        invalidarCaches();
        res.json({ mensagem: 'Seção renomeada com sucesso.' });
    } catch (err) {
        console.error('Erro ao renomear seção:', err.message);
        res.status(500).json({ erro: 'Erro ao renomear seção.' });
    }
};

// Body esperado: { ids: [3, 1, 2, 4] } - na ordem em que devem aparecer
exports.reordenar = async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ erro: 'Envie a lista de ids na nova ordem.' });
    }

    try {
        await SecaoCardapio.reordenar(ids);
        invalidarCaches();
        res.json({ mensagem: 'Ordem das seções atualizada.' });
    } catch (err) {
        console.error('Erro ao reordenar seções:', err.message);
        res.status(500).json({ erro: 'Erro ao reordenar seções.' });
    }
};

exports.excluir = async (req, res) => {
    try {
        const secao = await SecaoCardapio.buscarPorId(req.params.id);
        if (!secao) return res.status(404).json({ erro: 'Seção não encontrada.' });

        // Não deixa apagar uma seção que ainda tem sabor de pizza vinculado -
        // o admin precisa mover ou excluir esses itens primeiro, senão eles
        // ficariam "órfãos" no cardápio sem seção nenhuma.
        const totalProdutos = await SecaoCardapio.contarProdutosVinculados(req.params.id);
        if (totalProdutos > 0) {
            return res.status(400).json({
                erro: `Essa seção ainda tem ${totalProdutos} item(ns) do cardápio vinculado(s). Mova ou exclua esses itens antes de apagar a seção.`
            });
        }

        await SecaoCardapio.excluir(req.params.id);
        invalidarCaches();
        res.json({ mensagem: 'Seção excluída com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir seção:', err.message);
        res.status(500).json({ erro: 'Erro ao excluir seção.' });
    }
};
