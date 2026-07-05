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
        return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
};

module.exports = autenticar;
