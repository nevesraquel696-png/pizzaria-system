function telefoneValido(telefone) {
    return /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test((telefone || '').trim());
}

function precoValido(valor) {
    return !isNaN(valor) && Number(valor) >= 0;
}

module.exports = { telefoneValido, precoValido };
