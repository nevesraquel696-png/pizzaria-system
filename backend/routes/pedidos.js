const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const autenticar = require('../middleware/autenticacao');
const { autorizarNiveis } = require('../middleware/autenticacao');
const verificarHorarioFuncionamento = require('../middleware/horarioFuncionamento');
const { limitarBuscaCliente, limitarVerificarPin, limitarStatusPedido } = require('../middleware/limitadores');

// Público: cliente cria o pedido (bloqueado fora do horário de funcionamento)
router.post('/', verificarHorarioFuncionamento, pedidosController.criarPedido);

// Público: busca nome/endereço salvos de um telefone já usado antes, pra
// pré-preencher o checkout. Rate limit próprio, mais apertado - ver limitadores.js.
router.get('/cliente/:telefone', limitarBuscaCliente, pedidosController.buscarClientePorTelefone);

// Público: confirma a senha de 4 números pra liberar nome/endereço salvos
// (ver clientes_pin) - rate limit próprio + bloqueio por telefone no model.
router.post('/cliente/:telefone/verificar-pin', limitarVerificarPin, pedidosController.verificarPinCliente);

// Público: card "Acompanhar meu pedido" - nome + telefone juntos, mesmo
// limitador apertado da busca de cliente (mesma sensibilidade: expõe dado
// pessoal pra quem souber nome+telefone).
router.get('/rastrear', limitarBuscaCliente, pedidosController.rastrearPedido);

// Público: polling leve do status (só pendente/preparo/saiu_entrega/entregue,
// sem dado pessoal), usado pela mesma tela pra atualizar sozinha.
router.get('/:id/status', limitarStatusPedido, pedidosController.statusPublico);

// Admin: cria pedido manualmente pelo painel
router.post('/admin', autenticar, autorizarNiveis('admin'), pedidosController.criarPedidoAdmin);

// Histórico por dia - só admin (informação de faturamento). Precisa vir
// ANTES de '/:id', senão o Express entende "historico" como um :id.
router.get('/historico/dias', autenticar, autorizarNiveis('admin'), pedidosController.listarDiasHistorico);
router.get('/historico/:dia', autenticar, autorizarNiveis('admin'), pedidosController.listarPedidosPorDia);

// Protegido: usado pelo admin/cozinha (lista só o dia operacional em curso)
router.get('/', autenticar, pedidosController.listarPedidos);
router.get('/:id', autenticar, pedidosController.buscarPedido);
router.patch('/:id/status', autenticar, pedidosController.atualizarStatus);
router.post('/:id/reimprimir', autenticar, pedidosController.reimprimir);
router.delete('/:id', autenticar, autorizarNiveis('admin'), pedidosController.excluirPedido);

module.exports = router;
