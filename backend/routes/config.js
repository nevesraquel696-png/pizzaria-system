const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const autenticar = require('../middleware/autenticacao');
const { autorizarNiveis } = require('../middleware/autenticacao');

router.get('/', configController.obter); // público, o front do cliente pode checar
router.put('/', autenticar, autorizarNiveis('admin'), configController.atualizar); // só admin altera

module.exports = router;
