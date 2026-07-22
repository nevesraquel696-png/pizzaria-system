const express = require('express');
const router = express.Router();
const imagensController = require('../controllers/imagensController');
const autenticar = require('../middleware/autenticacao');

router.get('/', imagensController.listar); // público, o cliente precisa ver as imagens
router.put('/:fatias', autenticar, imagensController.validarFatias, imagensController.salvar);
router.delete('/:fatias', autenticar, imagensController.validarFatias, imagensController.remover);

module.exports = router;
