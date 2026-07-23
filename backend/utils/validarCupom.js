const Cupom = require('../models/Cupom');

// Confere se um cupom pode ser usado agora (existe, ativo, dentro da validade
// e do limite de uso) e calcula o desconto em cima do subtotal informado.
// Retorna { erro } se inválido, ou { cupom, desconto } se ok.
async function validarCupom(codigo, subtotal) {
    if (!codigo || !codigo.trim()) {
        return { erro: 'Informe um código de cupom.' };
    }

    const cupom = await Cupom.buscarPorCodigo(codigo.trim().toUpperCase());
    if (!cupom) {
        return { erro: 'Cupom não encontrado.' };
    }
    if (!cupom.ativo) {
        return { erro: 'Esse cupom não está mais ativo.' };
    }
    if (cupom.validade) {
        const hoje = new Date().toISOString().slice(0, 10);
        const validade = new Date(cupom.validade).toISOString().slice(0, 10);
        if (hoje > validade) {
            return { erro: 'Esse cupom expirou.' };
        }
    }
    if (cupom.limite_uso !== null && cupom.usos_atuais >= cupom.limite_uso) {
        return { erro: 'Esse cupom já atingiu o limite de uso.' };
    }

    let desconto = cupom.tipo === 'percentual'
        ? subtotal * (Number(cupom.valor) / 100)
        : Number(cupom.valor);

    // Nunca deixa o desconto derrubar o total pra menos de zero
    desconto = Math.min(desconto, subtotal);
    desconto = Math.round(desconto * 100) / 100;

    return { cupom, desconto };
}

module.exports = validarCupom;
