const Cupom = require('../models/Cupom');
const validarCupom = require('../utils/validarCupom');

const TIPOS_VALIDOS = ['percentual', 'fixo'];

exports.listar = async (req, res) => {
    try {
        const cupons = await Cupom.listarTodos();
        res.json(cupons);
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar cupons.' });
    }
};

exports.criar = async (req, res) => {
    const { codigo, tipo, valor, validade, limite_uso } = req.body;

    if (!codigo || !codigo.trim()) return res.status(400).json({ erro: 'Informe o código do cupom.' });
    if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ erro: 'Tipo de cupom inválido.' });
    if (!(Number(valor) > 0)) return res.status(400).json({ erro: 'Informe um valor de desconto maior que zero.' });
    if (tipo === 'percentual' && Number(valor) > 100) return res.status(400).json({ erro: 'Desconto percentual não pode passar de 100%.' });

    try {
        const id = await Cupom.criar({
            codigo: codigo.trim(),
            tipo,
            valor: Number(valor),
            validade: validade || null,
            limite_uso: limite_uso ? Number(limite_uso) : null
        });
        res.status(201).json({ mensagem: 'Cupom criado com sucesso!', id });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ erro: 'Já existe um cupom com esse código.' });
        }
        res.status(500).json({ erro: 'Erro ao criar cupom.' });
    }
};

exports.atualizar = async (req, res) => {
    const { tipo, valor, validade, limite_uso, ativo } = req.body;

    if (!TIPOS_VALIDOS.includes(tipo)) return res.status(400).json({ erro: 'Tipo de cupom inválido.' });
    if (!(Number(valor) > 0)) return res.status(400).json({ erro: 'Informe um valor de desconto maior que zero.' });

    try {
        await Cupom.atualizar(req.params.id, {
            tipo,
            valor: Number(valor),
            validade: validade || null,
            limite_uso: limite_uso ? Number(limite_uso) : null,
            ativo: !!ativo
        });
        res.json({ mensagem: 'Cupom atualizado com sucesso!' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar cupom.' });
    }
};

exports.excluir = async (req, res) => {
    try {
        await Cupom.excluir(req.params.id);
        res.json({ mensagem: 'Cupom excluído com sucesso.' });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao excluir cupom.' });
    }
};

// Público - o cliente usa isso pra conferir o cupom no carrinho ANTES de
// fechar o pedido. O desconto final de verdade é recalculado de novo, no
// servidor, na hora de criar o pedido (nunca confiamos no que vier daqui).
exports.validar = async (req, res) => {
    const { codigo, subtotal } = req.body;

    if (!(Number(subtotal) > 0)) {
        return res.status(400).json({ erro: 'Subtotal inválido.' });
    }

    const resultado = await validarCupom(codigo, Number(subtotal));
    if (resultado.erro) {
        return res.status(400).json({ erro: resultado.erro });
    }

    res.json({
        codigo: resultado.cupom.codigo,
        tipo: resultado.cupom.tipo,
        valor: Number(resultado.cupom.valor),
        desconto: resultado.desconto
    });
};
