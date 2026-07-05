const Produto = require('../models/Produto');

exports.listar = async (req, res) => {
    try {
        const produtos = req.query.disponiveis === 'true'
            ? await Produto.listarDisponiveis()
            : await Produto.listarTodos();
        res.json(produtos);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar produtos.' });
    }
};

exports.criar = async (req, res) => {
    const { nome, tipo, categoria, preco_base } = req.body;
    if (!nome || !tipo) return res.status(400).json({ erro: 'Nome e tipo são obrigatórios.' });
    if (tipo === 'sabor_pizza' && !categoria) {
        return res.status(400).json({ erro: 'Sabores de pizza precisam de uma categoria.' });
    }

    try {
        const id = await Produto.criar({ nome, tipo, categoria, preco_base: preco_base || 0 });
        res.status(201).json({ mensagem: 'Produto cadastrado com sucesso.', id });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
    }
};

exports.atualizar = async (req, res) => {
    try {
        await Produto.atualizar(req.params.id, req.body);
        res.json({ mensagem: 'Produto atualizado com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar produto.' });
    }
};

exports.alternarDisponibilidade = async (req, res) => {
    try {
        await Produto.alternarDisponibilidade(req.params.id);
        res.json({ mensagem: 'Disponibilidade alterada.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao alterar disponibilidade.' });
    }
};

exports.excluir = async (req, res) => {
    try {
        await Produto.excluir(req.params.id);
        res.json({ mensagem: 'Produto excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao excluir produto.' });
    }
};
