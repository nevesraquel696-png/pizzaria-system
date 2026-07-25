const express = require('express');
const router = express.Router();
const precosController = require('../controllers/precosController');
const autenticar = require('../middleware/autenticacao');
const { autorizarNiveis } = require('../middleware/autenticacao');

router.get('/', precosController.listar); // público, o cliente precisa saber os preços
router.get('/opcoes', precosController.categoriasEFatiasValidas); // público
router.put('/', autenticar, autorizarNiveis('admin'), precosController.atualizarEmLote); // só admin edita

module.exports = router;
