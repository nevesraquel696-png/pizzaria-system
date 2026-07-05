// Centraliza os eventos de socket em um só lugar.
// Eventos emitidos pelo backend: 'novoPedido', 'statusAtualizado'
function configurarSocket(io) {
    io.on('connection', (socket) => {
        console.log('Cliente conectado ao socket:', socket.id);

        socket.on('disconnect', () => {
            console.log('Cliente desconectado:', socket.id);
        });
    });
}

module.exports = configurarSocket;
