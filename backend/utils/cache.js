// Cache simples em memória, só pra evitar bater no banco toda hora em
// consultas que quase não mudam (cardápio, preços). Como o servidor roda
// numa única instância (plano free do Render), um Map em memória já resolve
// bem - não precisa de Redis nem nada externo.
const armazenamento = new Map();

function obter(chave) {
    const item = armazenamento.get(chave);
    if (!item) return null;
    if (Date.now() > item.expiraEm) {
        armazenamento.delete(chave);
        return null;
    }
    return item.valor;
}

function definir(chave, valor, ttlMs = 30000) {
    armazenamento.set(chave, { valor, expiraEm: Date.now() + ttlMs });
}

function invalidar(chave) {
    armazenamento.delete(chave);
}

module.exports = { obter, definir, invalidar };
