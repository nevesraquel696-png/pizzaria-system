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
        console.error('Erro ao listar imagens de categoria:', err);
        res.status(500).json({ erro: 'Erro ao buscar imagens.' });
    }
};

exports.upload = async (req, res) => {
    const { categoria } = req.params;

    if (!req.file) {
        return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });
    }

    try {
        // Sobe o arquivo (que está só na memória, em req.file.buffer) direto
        // pro Cloudinary via stream, sem precisar salvar em disco antes.
        const resultado = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'pizzaria/categorias',
                    public_id: `categoria-${categoria}-${Date.now()}`,
                },
                (err, result) => (err ? reject(err) : resolve(result))
            );
            stream.end(req.file.buffer);
        });

        await ImagemCategoria.atualizar(categoria, resultado.secure_url, resultado.public_id);
        res.json({ mensagem: 'Imagem atualizada com sucesso.', imagem_url: resultado.secure_url });
    } catch (err) {
        // Log detalhado: sem isso, o erro real nunca aparecia nos Logs do
        // Render, só a mensagem genérica que volta pro navegador.
        console.error('Erro ao subir imagem para o Cloudinary:', err);
        res.status(500).json({ erro: 'Erro ao salvar imagem: ' + (err.message || 'erro desconhecido') });
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
            await cloudinary.uploader.destroy(atual.imagem_public_id).catch((err) => {
                console.error('Aviso: não foi possível apagar a imagem antiga no Cloudinary:', err);
            });
        }
        await ImagemCategoria.atualizar(categoria, null, null);
        res.json({ mensagem: 'Imagem removida, voltando ao ícone padrão.' });
    } catch (err) {
        console.error('Erro ao remover imagem de categoria:', err);
        res.status(500).json({ erro: 'Erro ao remover imagem.' });
    }
};
