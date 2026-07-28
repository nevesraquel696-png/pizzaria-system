const express = require('express');
const router = express.Router();
const promocoesController = require('../controllers/promocoesController');
const autenticar = require('../middleware/autenticacao');
const { autorizarNiveis } = require('../middleware/autenticacao');

// Público: cliente vê só as promoções ligadas, no cardápio
router.get('/', promocoesController.listarAtivas);

// Protegido: gestão das promoções, só admin
router.get('/todas', autenticar, autorizarNiveis('admin'), promocoesController.listarTodas);
router.post('/', autenticar, autorizarNiveis('admin'), promocoesController.criar);
router.put('/:id', autenticar, autorizarNiveis('admin'), promocoesController.atualizar);
router.patch('/:id/ativa', autenticar, autorizarNiveis('admin'), promocoesController.alternarAtiva);
router.delete('/:id', autenticar, autorizarNiveis('admin'), promocoesController.excluir);

module.exports = router;
