const rateLimit = require('express-rate-limit');

// Login: no máximo 10 tentativas por IP a cada 15 minutos. Sem isso, alguém
// podia tentar milhares de senhas por segundo contra /api/auth/login (força
// bruta) - o bcrypt até deixa isso lento, mas não impede um script de ficar
// tentando indefinidamente.
const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }
});

// Criação de pedido (rota pública, sem login): limita quantos pedidos o
// mesmo IP consegue disparar, pra evitar spam de comandas falsas lotando a
// cozinha ou o banco.
const limitarCriacaoPedido = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitos pedidos enviados em pouco tempo. Aguarde alguns minutos.' }
});

// Limite geral, mais frouxo, pra toda a API - uma última barreira contra
// scraping/DoS básico sem atrapalhar o uso normal do cliente/admin/cozinha.
const limitarGeral = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas requisições. Aguarde um instante.' }
});

// Busca de dados salvos do cliente por telefone (rota pública, sem login):
// devolve nome e endereço de quem já fez pedido com aquele número. Como
// isso expõe nome+endereço pra quem souber/adivinhar um telefone, o limite
// é bem mais apertado que os outros - dificulta tentar vários números em
// sequência pra "catalogar" clientes.
const limitarBuscaCliente = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas consultas em pouco tempo. Aguarde alguns minutos.' }
});

// Verificação da senha (PIN) de 4 números do cliente: limite apertado por
// IP como primeira camada - a proteção principal (bloqueio por telefone
// depois de tentativas erradas) fica no próprio model ClientePin.
const limitarVerificarPin = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos.' }
});

module.exports = { limitarLogin, limitarCriacaoPedido, limitarGeral, limitarBuscaCliente, limitarVerificarPin };
