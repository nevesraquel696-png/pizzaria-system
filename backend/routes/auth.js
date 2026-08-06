const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const autenticar = require('../middleware/autenticacao');

router.post('/login', authController.login);
router.post('/cadastrar', authController.cadastrar); // use uma vez para criar o admin, depois proteja/remova

// Só quem já está logado (token válido) pode trocar a própria senha.
router.put('/alterar-senha', autenticar, authController.alterarSenha);

module.exports = router;
