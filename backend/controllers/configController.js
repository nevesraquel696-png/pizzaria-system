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

// Toda cor do tema que pode ser sobrescrita pelo admin. Uma lista fechada
// evita que qualquer texto arbitrário vire propriedade CSS no navegador
// de quem acessa o site.
const VARIAVEIS_COR_PERMITIDAS = [
    '--cor-verde', '--cor-verde-escuro',
    '--cor-vermelho', '--cor-vermelho-escuro',
    '--cor-terracota', '--cor-dourado',
    '--cor-creme', '--cor-papel',
    '--cor-texto', '--cor-branco',
    '--cor-marcador', '--cor-superficie', '--cor-borda-suave'
];

// Mesma lógica de tamanho aproximado usada pra fotos: base64 é ~33% maior
// que o arquivo original, então o limite aqui já é generoso o bastante.
function tamanhoAproximadoBytes(base64) {
    return base64.length * 0.75;
}

exports.atualizar = async (req, res) => {
    const { logo_base64, sino_base64, cores_json } = req.body;

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

    if (cores_json) {
        let cores;
        try {
            cores = JSON.parse(cores_json);
        } catch (err) {
            return res.status(400).json({ erro: 'Cores em formato inválido.' });
        }
        if (typeof cores !== 'object' || cores === null || Array.isArray(cores)) {
            return res.status(400).json({ erro: 'Cores em formato inválido.' });
        }
        for (const [chave, valor] of Object.entries(cores)) {
            if (!VARIAVEIS_COR_PERMITIDAS.includes(chave)) {
                return res.status(400).json({ erro: `Cor desconhecida: ${chave}` });
            }
            if (!HEX_VALIDO.test(valor)) {
                return res.status(400).json({ erro: `Cor inválida para ${chave}.` });
            }
        }
    }

    try {
        await Configuracao.atualizar(req.body);
        res.json({ mensagem: 'Configurações atualizadas com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar configurações.' });
    }
};
