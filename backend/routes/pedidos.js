const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const autenticar = require('../middleware/autenticacao');


// Público: cliente cria o pedido (sem bloqueio de horário)
router.post('/', pedidosController.criarPedido);

// Admin: cria pedido manualmente pelo painel
router.post('/admin', autenticar, pedidosController.criarPedidoAdmin);

// Protegido: usado pelo admin/cozinha
router.get('/', autenticar, pedidosController.listarPedidos);
router.get('/:id', autenticar, pedidosController.buscarPedido);
router.patch('/:id/status', autenticar, pedidosController.atualizarStatus);
router.post('/:id/reimprimir', autenticar, pedidosController.reimprimir);
router.delete('/:id', autenticar, pedidosController.excluirPedido);

module.exports = router;