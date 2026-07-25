const express = require('express');
const router = express.Router();
const imagensController = require('../controllers/imagensController');
const autenticar = require('../middleware/autenticacao');
const { autorizarNiveis } = require('../middleware/autenticacao');

router.get('/', imagensController.listar); // público, o cliente precisa ver as imagens
router.put('/:fatias', autenticar, autorizarNiveis('admin'), imagensController.validarFatias, imagensController.salvar);
router.delete('/:fatias', autenticar, autorizarNiveis('admin'), imagensController.validarFatias, imagensController.remover);

module.exports = router;
