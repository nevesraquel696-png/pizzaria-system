const ImagemCategoria = require('../models/ImagemCategoria');
const fs = require('fs');
const path = require('path');

exports.listar = async (req, res) => {
    try {
        const imagens = await ImagemCategoria.listarTodas();
        res.json(imagens);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar imagens.' });
    }
};

exports.upload = async (req, res) => {
    const { categoria } = req.params;
    const CATEGORIAS_VALIDAS = ['tradicional', 'especial', 'doce', 'promocao'];

    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
        return res.status(400).json({ erro: 'Categoria inválida.' });
    }
    if (!req.file) {
        return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });
    }

    try {
        const imagemUrl = `/uploads/${req.file.filename}`;
        await ImagemCategoria.atualizar(categoria, imagemUrl);
        res.json({ mensagem: 'Imagem atualizada com sucesso.', imagem_url: imagemUrl });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao salvar imagem.' });
    }
};

exports.remover = async (req, res) => {
    const { categoria } = req.params;
    try {
        await ImagemCategoria.atualizar(categoria, null);
        res.json({ mensagem: 'Imagem removida, voltando ao ícone padrão.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover imagem.' });
    }
};
