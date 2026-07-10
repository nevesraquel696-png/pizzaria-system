require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const configurarSocket = require('./socket/socketHandler');

const authRoutes = require('./routes/auth');
const pedidosRoutes = require('./routes/pedidos');
const produtosRoutes = require('./routes/produtos');
const configRoutes = require('./routes/config');
const precosRoutes = require('./routes/precos');
const imagensRoutes = require('./routes/imagens');

const app = express();
app.use(compression()); // reduz o tamanho das respostas, ajuda em conexões mais lentas
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Deixa o "io" acessível dentro dos controllers via req.app.get('io')
app.set('io', io);

configurarSocket(io);

app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/config', configRoutes);
app.use('/api/precos-pizza', precosRoutes);
app.use('/api/imagens-categoria', imagensRoutes);

app.get('/api/status', (req, res) => {
    res.json({ status: 'online' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
