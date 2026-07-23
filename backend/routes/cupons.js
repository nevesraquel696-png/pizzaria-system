const express = require('express');
const router = express.Router();
const cuponsController = require('../controllers/cuponsController');
const autenticar = require('../middleware/autenticacao');

router.post('/validar', cuponsController.validar); // público - cliente confere o cupom no carrinho

router.get('/', autenticar, cuponsController.listar);
router.post('/', autenticar, cuponsController.criar);
router.put('/:id', autenticar, cuponsController.atualizar);
router.delete('/:id', autenticar, cuponsController.excluir);

module.exports = router;
