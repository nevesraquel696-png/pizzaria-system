const express = require('express');
const router = express.Router();
const secoesController = require('../controllers/secoesController');
const autenticar = require('../middleware/autenticacao');
const { autorizarNiveis } = require('../middleware/autenticacao');

// Público: cliente e admin precisam ver as seções pra montar o cardápio
router.get('/', secoesController.listar);

// Protegido: só admin cria/renomeia/reordena/apaga seções
router.post('/', autenticar, autorizarNiveis('admin'), secoesController.criar);
router.put('/reordenar', autenticar, autorizarNiveis('admin'), secoesController.reordenar);
router.put('/:id', autenticar, autorizarNiveis('admin'), secoesController.renomear);
router.delete('/:id', autenticar, autorizarNiveis('admin'), secoesController.excluir);

module.exports = router;
