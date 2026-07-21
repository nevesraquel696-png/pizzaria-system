const ImagemCategoria = require('../models/ImagemCategoria');
const fs = require('fs');
const path = require('path');

const CATEGORIAS_VALIDAS = ['tradicional', 'especial', 'doce', 'promocao'];

// Precisa rodar ANTES do multer (que já usa req.params.categoria pra montar
// o nome do arquivo no disco). Se a validação ficasse só dentro do
// controller, o arquivo já teria sido salvo com um valor não confiável
// antes de chegarmos até aqui - abrindo brecha pra path traversal
// (ex: categoria = "../../server").
exports.validarCategoria = (req, res, next) => {
    if (!CATEGORIAS_VALIDAS.includes(req.params.categoria)) {
        return res.status(400).json({ erro: 'Categoria inválida.' });
    }
    next();
};

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
