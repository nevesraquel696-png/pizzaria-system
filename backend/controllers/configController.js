const Configuracao = require('../models/Configuracao');

// Mesmas chaves usadas pelas variáveis CSS em frontend/css/theme.css (sem o
// prefixo "--cor-"). Lista fechada de propósito: impede que o corpo da
// requisição grave uma chave qualquer que não vá corresponder a nada no CSS.
const CHAVES_TEMA_VALIDAS = ['verde', 'verde-escuro', 'vermelho', 'vermelho-escuro', 'terracota', 'dourado', 'creme', 'texto'];
const REGEX_COR_HEX = /^#[0-9a-fA-F]{6}$/;

exports.obter = async (req, res) => {
    try {
        const config = await Configuracao.obter();
        res.json(config);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar configuração.' });
    }
};

exports.atualizar = async (req, res) => {
    try {
        await Configuracao.atualizar(req.body);
        res.json({ mensagem: 'Configurações atualizadas com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar configurações.' });
    }
};

// Body esperado: { tema_cores: { verde: '#0A6C40', vermelho: '#A5273A', ... } }
// Só precisa mandar as chaves que quer trocar - o resto some do JSON salvo e
// o frontend volta a usar a cor padrão do theme.css pra elas.
exports.atualizarCores = async (req, res) => {
    const { tema_cores } = req.body;
    if (!tema_cores || typeof tema_cores !== 'object' || Array.isArray(tema_cores)) {
        return res.status(400).json({ erro: 'Envie um objeto com as cores do tema.' });
    }

    const chavesInvalidas = Object.keys(tema_cores).filter(chave => !CHAVES_TEMA_VALIDAS.includes(chave));
    if (chavesInvalidas.length > 0) {
        return res.status(400).json({ erro: `Chave(s) de cor desconhecida(s): ${chavesInvalidas.join(', ')}` });
    }

    const valoresInvalidos = Object.entries(tema_cores).filter(([, valor]) => !REGEX_COR_HEX.test(valor));
    if (valoresInvalidos.length > 0) {
        return res.status(400).json({ erro: 'Cada cor precisa estar no formato hexadecimal, ex: #A5273A.' });
    }

    try {
        await Configuracao.atualizarCores(tema_cores);
        res.json({ mensagem: 'Cores do tema atualizadas com sucesso.' });
    } catch (err) {
        console.error('Erro ao atualizar cores do tema:', err.message);
        res.status(500).json({ erro: 'Erro ao atualizar cores do tema.' });
    }
};

exports.atualizarLogo = async (req, res) => {
    const { logo_base64 } = req.body;
    if (logo_base64 && !logo_base64.startsWith('data:image/')) {
        return res.status(400).json({ erro: 'Imagem inválida.' });
    }

    if (logo_base64) {
        const tamanhoAproximadoBytes = logo_base64.length * 0.75;
        if (tamanhoAproximadoBytes > 6 * 1024 * 1024) {
            return res.status(400).json({ erro: 'Imagem muito grande (máximo ~5MB).' });
        }
    }

    try {
        await Configuracao.atualizarLogo(logo_base64 || null);
        res.json({ mensagem: logo_base64 ? 'Logotipo atualizado com sucesso.' : 'Logotipo removido, voltando ao padrão.' });
    } catch (err) {
        console.error('Erro ao atualizar logotipo:', err.message);
        res.status(500).json({ erro: 'Erro ao atualizar logotipo.' });
    }
};
