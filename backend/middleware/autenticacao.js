const jwt = require('jsonwebtoken');
require('dotenv').config();

// Protege rotas do admin/cozinha. O front precisa mandar o token no header:
// Authorization: Bearer <token>
const autenticar = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ erro: 'Token não fornecido. Faça login novamente.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
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

module.exports = autenticar;
