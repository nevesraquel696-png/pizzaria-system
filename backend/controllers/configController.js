const Configuracao = require('../models/Configuracao');

exports.obter = async (req, res) => {
    try {
        const config = await Configuracao.obter();
        res.json(config);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar configuração.' });
    }
};

const HEX_VALIDO = /^#[0-9A-Fa-f]{6}$/;

// Mesma lógica de tamanho aproximado usada pra fotos: base64 é ~33% maior
// que o arquivo original, então o limite aqui já é generoso o bastante.
function tamanhoAproximadoBytes(base64) {
    return base64.length * 0.75;
}

exports.atualizar = async (req, res) => {
    const { logo_base64, sino_base64, cor_primaria, cor_destaque } = req.body;

    if (logo_base64) {
        if (!logo_base64.startsWith('data:image/')) {
            return res.status(400).json({ erro: 'Logo inválida.' });
        }
        if (tamanhoAproximadoBytes(logo_base64) > 3 * 1024 * 1024) {
            return res.status(400).json({ erro: 'Logo muito grande (máximo ~2MB).' });
        }
    }

    if (sino_base64) {
        if (!sino_base64.startsWith('data:audio/')) {
            return res.status(400).json({ erro: 'Arquivo de som inválido.' });
        }
        if (tamanhoAproximadoBytes(sino_base64) > 5 * 1024 * 1024) {
            return res.status(400).json({ erro: 'Som muito grande (máximo ~3.5MB).' });
        }
    }

    if (cor_primaria && !HEX_VALIDO.test(cor_primaria)) {
        return res.status(400).json({ erro: 'Cor principal inválida.' });
    }
    if (cor_destaque && !HEX_VALIDO.test(cor_destaque)) {
        return res.status(400).json({ erro: 'Cor de destaque inválida.' });
    }

    try {
        await Configuracao.atualizar(req.body);
        res.json({ mensagem: 'Configurações atualizadas com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar configurações.' });
    }
};
