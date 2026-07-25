const jwt = require('jsonwebtoken');
require('dotenv').config();

// Fixamos o algoritmo esperado (o mesmo usado em authController.js pra
// assinar). Sem isso, jwt.verify aceita qualquer algoritmo presente no
// próprio token - em tese um atacante poderia tentar trocar o algoritmo
// pra passar sem assinatura válida. Definir explicitamente fecha essa
// porta independente da versão da lib.
const ALGORITMO_JWT = ['HS256'];

// Protege rotas do admin/cozinha. O front precisa mandar o token no header:
// Authorization: Bearer <token>
const autenticar = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token não fornecido. Faça login novamente.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ALGORITMO_JWT });
        req.usuario = payload; // { id, nome, nivel }
        next();
    } catch (err) {
        // Log detalhado: sem isso, não dá pra saber se o token expirou de
        // verdade, se a assinatura não bate (JWT_SECRET diferente do que
        // assinou o token) ou outro motivo - a mensagem genérica pro
        // navegador não diz qual é.
        console.error('Falha ao verificar token JWT:', err.name, '-', err.message);
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
};

// Restringe a rota a determinados níveis de usuário (ex: só 'admin').
// Precisa rodar DEPOIS de `autenticar` (usa req.usuario preenchido por ele).
// Sem isso, qualquer conta autenticada - inclusive 'cozinha' - conseguia
// excluir pedidos, mexer no cardápio, preços, cupons e configurações, já
// que essas rotas só checavam "está logado", nunca "é admin".
const autorizarNiveis = (...niveisPermitidos) => (req, res, next) => {
    if (!req.usuario || !niveisPermitidos.includes(req.usuario.nivel)) {
        return res.status(403).json({ erro: 'Você não tem permissão para essa ação.' });
    }
    next();
};

module.exports = autenticar;
module.exports.autorizarNiveis = autorizarNiveis;
module.exports.ALGORITMO_JWT = ALGORITMO_JWT;
