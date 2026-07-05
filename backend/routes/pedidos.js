const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const verificarHorarioFuncionamento = require('../middleware/horarioFuncionamento');
const autenticar = require('../middleware/autenticacao');

// Público: cliente cria o pedido (bloqueado fora do horário de funcionamento)
router.post('/', verificarHorarioFuncionamento, pedidosController.criarPedido);

// Admin: cria pedido manualmente pelo painel (não é bloqueado pelo horário)
router.post('/admin', autenticar, pedidosController.criarPedidoAdmin);

// Protegido: usado pelo admin/cozinha
router.get('/', autenticar, pedidosController.listarPedidos);
router.get('/:id', autenticar, pedidosController.buscarPedido);
router.patch('/:id/status', autenticar, pedidosController.atualizarStatus);
router.post('/:id/reimprimir', autenticar, pedidosController.reimprimir);

module.exports = router;
