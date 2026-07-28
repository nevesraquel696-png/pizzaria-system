const Promocao = require('../models/Promocao');
const Produto = require('../models/Produto');
const cache = require('../utils/cache');

const FATIAS_VALIDAS = [4, 6, 8, 12, 14];

// Confere se os sabores escolhidos pelo admin existem mesmo e são sabor de
// pizza (não deixa cadastrar promoção com bebida/borda por engano).
async function validarDados(body) {
    const { nome, fatias, sabor_ids, preco_de, preco_por } = body;

    if (!nome || !nome.trim()) return 'Informe o nome da promoção.';
    if (!FATIAS_VALIDAS.includes(Number(fatias))) return 'Tamanho (fatias) inválido.';
    if (!Array.isArray(sabor_ids) || sabor_ids.length === 0) return 'Selecione ao menos um sabor para a promoção.';
    if (sabor_ids.length > 3) return 'Selecione no máximo 3 sabores.';
    if (!(Number(preco_de) >= 0) || !(Number(preco_por) >= 0)) return 'Informe preços válidos.';

    const produtos = await Produto.buscarPorIds(sabor_ids);
    const validos = produtos.filter(p => p.tipo === 'sabor_pizza');
    if (validos.length !== sabor_ids.length) return 'Um ou mais sabores selecionados são inválidos.';

    return null;
}

function invalidarCachePromocoes() {
    cache.invalidar('promocoes:ativas');
}

exports.listarAtivas = async (req, res) => {
    const emCache = cache.obter('promocoes:ativas');
    if (emCache) return res.json(emCache);

    try {
        const promocoes = await Promocao.listarAtivas();
        cache.definir('promocoes:ativas', promocoes, 30000);
        res.json(promocoes);
    } catch (err) {
        console.error('Erro ao listar promoções:', err.message);
        res.status(500).json({ erro: 'Erro ao buscar promoções.' });
    }
};

exports.listarTodas = async (req, res) => {
    try {
        const promocoes = await Promocao.listarTodas();
        res.json(promocoes);
    } catch (err) {
        console.error('Erro ao listar promoções (admin):', err.message);
        res.status(500).json({ erro: 'Erro ao buscar promoções.' });
    }
};

exports.criar = async (req, res) => {
    const erro = await validarDados(req.body);
    if (erro) return res.status(400).json({ erro });

    try {
        const id = await Promocao.criar({
            nome: req.body.nome,
            fatias: Number(req.body.fatias),
            sabor_ids: req.body.sabor_ids.map(Number),
            preco_de: Number(req.body.preco_de),
            preco_por: Number(req.body.preco_por)
        });
        invalidarCachePromocoes();
        res.status(201).json({ mensagem: 'Promoção criada com sucesso!', id });
    } catch (err) {
        console.error('Erro ao criar promoção:', err.message);
        res.status(500).json({ erro: 'Erro ao criar promoção: ' + err.message });
    }
};

exports.atualizar = async (req, res) => {
    const erro = await validarDados(req.body);
    if (erro) return res.status(400).json({ erro });

    try {
        await Promocao.atualizar(req.params.id, {
            nome: req.body.nome,
            fatias: Number(req.body.fatias),
            sabor_ids: req.body.sabor_ids.map(Number),
            preco_de: Number(req.body.preco_de),
            preco_por: Number(req.body.preco_por),
            ativo: req.body.ativo !== undefined ? !!req.body.ativo : true
        });
        invalidarCachePromocoes();
        res.json({ mensagem: 'Promoção atualizada com sucesso!' });
    } catch (err) {
        console.error('Erro ao atualizar promoção:', err.message);
        res.status(500).json({ erro: 'Erro ao atualizar promoção.' });
    }
};

exports.alternarAtiva = async (req, res) => {
    try {
        await Promocao.alternarAtiva(req.params.id);
        invalidarCachePromocoes();
        res.json({ mensagem: 'Promoção atualizada.' });
    } catch (err) {
        console.error('Erro ao atualizar promoção:', err.message);
        res.status(500).json({ erro: 'Erro ao atualizar promoção.' });
    }
};

exports.excluir = async (req, res) => {
    try {
        await Promocao.excluir(req.params.id);
        invalidarCachePromocoes();
        res.json({ mensagem: 'Promoção excluída com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir promoção:', err.message);
        res.status(500).json({ erro: 'Erro ao excluir promoção.' });
    }
};
