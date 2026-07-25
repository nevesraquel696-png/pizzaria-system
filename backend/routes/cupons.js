const express = require('express');
const router = express.Router();
const cuponsController = require('../controllers/cuponsController');
const autenticar = require('../middleware/autenticacao');
const { autorizarNiveis } = require('../middleware/autenticacao');

router.post('/validar', cuponsController.validar); // público - cliente confere o cupom no carrinho

router.get('/', autenticar, autorizarNiveis('admin'), cuponsController.listar);
router.post('/', autenticar, autorizarNiveis('admin'), cuponsController.criar);
router.put('/:id', autenticar, autorizarNiveis('admin'), cuponsController.atualizar);
router.delete('/:id', autenticar, autorizarNiveis('admin'), cuponsController.excluir);

module.exports = router;
