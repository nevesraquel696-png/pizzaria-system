const Produto = require('../models/Produto');
const cache = require('../utils/cache');

exports.listar = async (req, res) => {
    const chaveCache = `produtos:${req.query.disponiveis === 'true' ? 'disponiveis' : 'todos'}`;
    const emCache = cache.obter(chaveCache);
    if (emCache) return res.json(emCache);

    try {
        const produtos = req.query.disponiveis === 'true'
            ? await Produto.listarDisponiveis()
            : await Produto.listarTodos();
        cache.definir(chaveCache, produtos, 30000); // 30s - card​ápio não muda o tempo todo
        res.json(produtos);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar produtos.' });
    }
};

exports.criar = async (req, res) => {
    const { nome, tipo, categoria, preco_base, descricao, imagem_base64 } = req.body;
    if (!nome || !tipo) return res.status(400).json({ erro: 'Nome e tipo são obrigatórios.' });
    if (tipo === 'sabor_pizza' && !categoria) {
        return res.status(400).json({ erro: 'Sabores de pizza precisam de uma categoria.' });
    }
    if (imagem_base64 && !validarTamanhoImagem(imagem_base64)) {
        return res.status(400).json({ erro: 'Imagem muito grande (máximo ~5MB).' });
    }

    try {
        const id = await Produto.criar({ nome, tipo, categoria, preco_base: preco_base || 0, descricao, imagem_base64 });
        invalidarCacheProdutos();
        res.status(201).json({ mensagem: 'Produto cadastrado com sucesso.', id });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
    }
};

exports.atualizarImagem = async (req, res) => {
    const { imagem_base64 } = req.body;
    if (imagem_base64 && !validarTamanhoImagem(imagem_base64)) {
        return res.status(400).json({ erro: 'Imagem muito grande (máximo ~5MB).' });
    }

    try {
        await Produto.atualizarImagem(req.params.id, imagem_base64 || null);
        invalidarCacheProdutos();
        res.json({ mensagem: 'Foto atualizada com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar foto.' });
    }
};

function validarTamanhoImagem(imagem_base64) {
    const tamanhoAproximadoBytes = imagem_base64.length * 0.75;
    return tamanhoAproximadoBytes <= 6 * 1024 * 1024;
}

exports.atualizar = async (req, res) => {
    try {
        await Produto.atualizar(req.params.id, req.body);
        invalidarCacheProdutos();
        res.json({ mensagem: 'Produto atualizado com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar produto.' });
    }
};

exports.alternarDisponibilidade = async (req, res) => {
    try {
        await Produto.alternarDisponibilidade(req.params.id);
        invalidarCacheProdutos();
        res.json({ mensagem: 'Disponibilidade alterada.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao alterar disponibilidade.' });
    }
};

exports.excluir = async (req, res) => {
    try {
        await Produto.excluir(req.params.id);
        invalidarCacheProdutos();
        res.json({ mensagem: 'Produto excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao excluir produto.' });
    }
};

function invalidarCacheProdutos() {
    cache.invalidar('produtos:disponiveis');
    cache.invalidar('produtos:todos');
}
