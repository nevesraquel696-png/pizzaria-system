const express = require('express');
const router = express.Router();
const imagensController = require('../controllers/imagensController');
const autenticar = require('../middleware/autenticacao');
const upload = require('../config/upload');

router.get('/', imagensController.listar); // público, o cliente precisa ver as imagens
router.post('/:categoria', autenticar, upload.single('imagem'), imagensController.upload);
router.delete('/:categoria', autenticar, imagensController.remover);

module.exports = router;
