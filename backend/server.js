require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const configurarSocket = require('./socket/socketHandler');
const { limitarLogin, limitarCriacaoPedido, limitarGeral } = require('./middleware/limitadores');

const authRoutes = require('./routes/auth');
const pedidosRoutes = require('./routes/pedidos');
const produtosRoutes = require('./routes/produtos');
const configRoutes = require('./routes/config');
const precosRoutes = require('./routes/precos');
const imagensRoutes = require('./routes/imagens');
const cuponsRoutes = require('./routes/cupons');
const promocoesRoutes = require('./routes/promocoes');

// Em produção, defina FRONTEND_ORIGINS com a(s) URL(s) real(is) do site
// (separadas por vírgula), ex: https://minhapizzaria.com,https://www.minhapizzaria.com
// Sem essa variável, liberamos qualquer origem ('*') pra não quebrar em
// desenvolvimento - mas isso permite que QUALQUER site na internet chame
// a API em nome de um visitante. Vale a pena configurar antes de ir ao ar.
const origensPermitidas = (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
const configCors = { origin: origensPermitidas.length > 0 ? origensPermitidas : '*' };
if (origensPermitidas.length === 0) {
    console.warn('AVISO: FRONTEND_ORIGINS não definida - CORS liberado para qualquer origem. Configure em produção.');
}

const app = express();
app.use(helmet()); // cabeçalhos de segurança padrão (X-Content-Type-Options, HSTS, etc.)
app.use(compression()); // reduz o tamanho das respostas, ajuda em conexões mais lentas
app.use(cors(configCors));
app.use(limitarGeral);
// Limite maior que o padrão (100kb) porque as fotos de tamanho chegam em
// base64 dentro do JSON, não como arquivo separado.
app.use(express.json({ limit: '8mb' }));

const server = http.createServer(app);
const io = new Server(server, { cors: configCors });

// Deixa o "io" acessível dentro dos controllers via req.app.get('io')
app.set('io', io);

configurarSocket(io);

app.use('/api/auth/login', limitarLogin);
app.use('/api/pedidos', (req, res, next) => {
    if (req.method === 'POST' && req.path === '/') return limitarCriacaoPedido(req, res, next);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/config', configRoutes);
app.use('/api/precos-pizza', precosRoutes);
app.use('/api/imagens-tamanho', imagensRoutes);
app.use('/api/cupons', cuponsRoutes);
app.use('/api/promocoes', promocoesRoutes);

app.get('/api/status', (req, res) => {
    res.json({ status: 'online' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
