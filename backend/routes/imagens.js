const express = require('express');
const router = express.Router();
const imagensController = require('../controllers/imagensController');
const autenticar = require('../middleware/autenticacao');
const upload = require('../config/upload');

router.get('/', imagensController.listar); // público, o cliente precisa ver as imagens
router.post('/:categoria', autenticar, imagensController.validarCategoria, upload.single('imagem'), imagensController.upload);
router.delete('/:categoria', autenticar, imagensController.validarCategoria, imagensController.remover);

module.exports = router;
