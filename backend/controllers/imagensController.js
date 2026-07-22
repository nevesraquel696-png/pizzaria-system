const ImagemCategoria = require('../models/ImagemCategoria');
const cloudinary = require('../config/cloudinary');

const CATEGORIAS_VALIDAS = ['tradicional', 'especial', 'doce', 'promocao'];

// Precisa rodar ANTES do multer (que já usa req.params.categoria pra montar
// o nome do arquivo). Se a validação ficasse só dentro do
// controller, o arquivo já teria sido enviado com um valor não confiável
// antes de chegarmos até aqui.
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
        // req.file.path já vem preenchido pelo multer-storage-cloudinary com
        // a URL pública e permanente da imagem no Cloudinary.
        const imagemUrl = req.file.path;
        const imagemPublicId = req.file.filename; // usado depois pra poder apagar
        await ImagemCategoria.atualizar(categoria, imagemUrl, imagemPublicId);
        res.json({ mensagem: 'Imagem atualizada com sucesso.', imagem_url: imagemUrl });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao salvar imagem.' });
    }
};

exports.remover = async (req, res) => {
    const { categoria } = req.params;
    try {
        const atual = await ImagemCategoria.buscarPorCategoria(categoria);
        if (atual && atual.imagem_public_id) {
            // Apaga o arquivo no Cloudinary também, pra não acumular lixo
            // na conta gratuita. Se der erro (ex: já tinha sido apagado
            // manualmente lá), seguimos em frente e limpamos o banco mesmo assim.
            await cloudinary.uploader.destroy(atual.imagem_public_id).catch(() => {});
        }
        await ImagemCategoria.atualizar(categoria, null, null);
        res.json({ mensagem: 'Imagem removida, voltando ao ícone padrão.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover imagem.' });
    }
};
