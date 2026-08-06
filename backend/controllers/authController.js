const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const { ALGORITMO_JWT } = require('../middleware/autenticacao');
require('dotenv').config();

// Hash "fake" só pra gastar o mesmo tempo de bcrypt.compare quando o email
// nem existe. Sem isso, a resposta de "email não encontrado" volta bem mais
// rápido que a de "senha errada" (que faz o compare de verdade) - alguém
// medindo o tempo de resposta conseguiria descobrir quais emails têm conta
// cadastrada, mesmo sem nunca ver a mensagem de erro mudar.
const HASH_FALSO = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q0Q8Q0Q8Q0Q8Q0Q8Q0Q8Q0Q8Q0Q8O';

exports.login = async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });

    try {
        const usuario = await Usuario.buscarPorEmail(email);

        const senhaCorreta = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FALSO);
        if (!usuario || !senhaCorreta) return res.status(401).json({ erro: 'Credenciais inválidas.' });

        const token = jwt.sign(
            { id: usuario.id, nome: usuario.nome, nivel: usuario.nivel },
            process.env.JWT_SECRET,
            { expiresIn: '8h', algorithm: ALGORITMO_JWT[0] }
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
                const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET, { algorithms: ALGORITMO_JWT });
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

// Troca a senha do próprio usuário logado. Precisa passar pelo middleware
// `autenticar` (req.usuario vem do token) e confirmar a senha ATUAL antes
// de trocar - assim, mesmo que alguém pegue o token de outra forma (ex.
// sessão aberta esquecida no computador), não consegue trocar a senha sem
// saber a senha antiga. É a forma "definitiva" de resolver o problema de
// ficar sem acesso depois de recriar o banco: uma vez logado, dá pra trocar
// a senha por uma que você escolher, sem depender de rodar SQL/curl de novo.
exports.alterarSenha = async (req, res) => {
    const { senha_atual, senha_nova } = req.body;

    if (!senha_atual || !senha_nova) {
        return res.status(400).json({ erro: 'Informe a senha atual e a nova senha.' });
    }
    if (senha_nova.length < 6) {
        return res.status(400).json({ erro: 'A nova senha precisa ter pelo menos 6 caracteres.' });
    }
    if (senha_nova === senha_atual) {
        return res.status(400).json({ erro: 'A nova senha precisa ser diferente da senha atual.' });
    }

    try {
        const usuario = await Usuario.buscarPorId(req.usuario.id);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });

        const senhaCorreta = await bcrypt.compare(senha_atual, usuario.senha_hash);
        if (!senhaCorreta) return res.status(401).json({ erro: 'Senha atual incorreta.' });

        const senha_hash = await bcrypt.hash(senha_nova, 10);
        await Usuario.atualizarSenha(usuario.id, senha_hash);

        res.json({ mensagem: 'Senha alterada com sucesso.' });
    } catch (err) {
        console.error('Erro ao alterar senha:', err.message);
        res.status(500).json({ erro: 'Erro ao alterar senha.' });
    }
};
