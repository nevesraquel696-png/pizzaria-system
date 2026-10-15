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
    // Contador de visitantes ao vivo. Fica num "canal" separado e público
    // ('/visitantes'): quem abre o cardápio só entra e sai, não recebe nada.
    // O número só é enviado pro canal principal, que exige token (admin).
    const canalVisitantes = io.of('/visitantes');
    // A página de monitoramento (frontend/visitantes) também entra nesse
    // canal, mas avisa com ?monitor=1 pra não se contar como visitante.
    const contarVisitantes = () => [...canalVisitantes.sockets.values()]
        .filter(s => !s.handshake.query.monitor).length;
    const avisarTodos = () => {
        const quantidade = contarVisitantes();
        io.emit('visitantes', quantidade);                 // painel admin (logado)
        canalVisitantes.emit('visitantes', quantidade);    // página pública de monitoramento (só o número)
    };

    canalVisitantes.on('connection', (socket) => {
        socket.emit('visitantes', contarVisitantes());
        if (!socket.handshake.query.monitor) avisarTodos();
        socket.on('disconnect', () => { if (!socket.handshake.query.monitor) avisarTodos(); });
    });

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
        socket.emit('visitantes', contarVisitantes());

        socket.on('disconnect', () => {
            console.log('Cliente desconectado:', socket.id);
        });
    });
}

module.exports = configurarSocket;
