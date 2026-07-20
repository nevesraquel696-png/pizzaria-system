const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
require('dotenv').config();

exports.login = async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });

    try {
        const usuario = await Usuario.buscarPorEmail(email);
        if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas.' });

        const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaCorreta) return res.status(401).json({ erro: 'Credenciais inválidas.' });

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, nivel: usuario.nivel },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, nome: usuario.nome, nivel: usuario.nivel });
    } catch (err) {
        console.error('Erro no login:', err.message);
        res.status(500).json({ erro: 'Erro ao fazer login.' });
    }
};

// Cadastra um novo usuário (admin/cozinha).
// Regra de segurança: enquanto não existir NENHUM usuário no banco, a rota
// fica aberta só pra criar o primeiro admin (bootstrap inicial do sistema).
// A partir do momento que já existe pelo menos um usuário, só quem já está
// logado como admin pode cadastrar outro - senão qualquer pessoa na internet
// conseguiria criar uma conta admin sozinha.
exports.cadastrar = async (req, res) => {
    const { nome, email, senha, nivel } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Dados incompletos.' });

    try {
        const totalUsuarios = await Usuario.contar();

        if (totalUsuarios > 0) {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ erro: 'Já existe um administrador cadastrado. Faça login como admin para cadastrar novos usuários.' });
            }
            try {
                const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
                if (payload.nivel !== 'admin') {
                    return res.status(403).json({ erro: 'Só administradores podem cadastrar novos usuários.' });
                }
            } catch (err) {
                return res.status(401).json({ erro: 'Token inválido ou expirado.' });
            }
        }

        const senha_hash = await bcrypt.hash(senha, 10);
        const id = await Usuario.criar({ nome, email, senha_hash, nivel });
        res.status(201).json({ mensagem: 'Usuário criado com sucesso.', id });
    } catch (err) {
        res.status(500).json({ erro: 'Erro ao criar usuário. O email já pode estar em uso.' });
    }
};
