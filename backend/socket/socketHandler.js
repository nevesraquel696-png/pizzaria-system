const jwt = require('jsonwebtoken');
const { ALGORITMO_JWT } = require('../middleware/autenticacao');

// Antes, qualquer pessoa na internet podia abrir uma conexão de socket direto
// no servidor (sem passar pelo admin/cozinha) e ficar escutando os eventos
// 'novoPedido'/'statusAtualizado' - que levam nome do cliente, tipo de
// entrega e valor do pedido. Só o admin/cozinha usam socket (o cliente final
// só usa a API normal), então passamos a exigir o mesmo token JWT do painel
// pra completar a conexão.
//
// Eventos emitidos pelo backend: 'novoPedido', 'statusAtualizado'
function configurarSocket(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Token não fornecido.'));

        try {
            socket.usuario = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ALGORITMO_JWT });
            next();
        } catch (err) {
            next(new Error('Token inválido ou expirado.'));
        }
    });

    io.on('connection', (socket) => {
        console.log('Cliente conectado ao socket:', socket.id, '-', socket.usuario?.nome);

        socket.on('disconnect', () => {
            console.log('Cliente desconectado:', socket.id);
        });
    });
}

module.exports = configurarSocket;
