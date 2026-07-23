const ImagemTamanho = require('../models/ImagemTamanho');

const FATIAS_VALIDAS = [4, 6, 8, 12, 14];

// Precisa rodar ANTES do controller salvar, pra não aceitar um valor de
// fatias fora da lista esperada.
exports.validarFatias = (req, res, next) => {
    if (!FATIAS_VALIDAS.includes(Number(req.params.fatias))) {
        return res.status(400).json({ erro: 'Tamanho (número de fatias) inválido.' });
    }
    next();
};

exports.listar = async (req, res) => {
    try {
        const imagens = await ImagemTamanho.listarTodas();
        res.json(imagens);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar imagens.' });
    }
};

// A imagem chega já em base64 (data URL) no corpo da requisição, montada no
// navegador com FileReader - nada de arquivo em disco. Isso é o que garante
// que a foto nunca some: fica gravada direto no banco, que é persistente,
// diferente do disco do servidor (que se perde a cada reinício no Render).
exports.salvar = async (req, res) => {
    const { fatias } = req.params;
    const { imagem_base64 } = req.body;

    if (!imagem_base64 || !imagem_base64.startsWith('data:image/')) {
        return res.status(400).json({ erro: 'Imagem inválida.' });
    }

    // ~5MB de imagem original vira ~6.7MB em base64 - limite generoso mas
    // que evita alguém mandar um arquivo gigante sem querer.
    const tamanhoAproximadoBytes = imagem_base64.length * 0.75;
    if (tamanhoAproximadoBytes > 6 * 1024 * 1024) {
        return res.status(400).json({ erro: 'Imagem muito grande (máximo ~5MB).' });
    }

    try {
        await ImagemTamanho.atualizar(Number(fatias), imagem_base64);
        res.json({ mensagem: 'Imagem atualizada com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao salvar imagem.' });
    }
};

exports.remover = async (req, res) => {
    const { fatias } = req.params;
    try {
        await ImagemTamanho.atualizar(Number(fatias), null);
        res.json({ mensagem: 'Imagem removida, voltando ao ícone padrão.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao remover imagem.' });
    }
};
