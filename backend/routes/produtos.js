const express = require('express');
const router = express.Router();
const produtosController = require('../controllers/produtosController');
const autenticar = require('../middleware/autenticacao');
const { autorizarNiveis } = require('../middleware/autenticacao');

// Público: cliente vê o cardápio disponível (?disponiveis=true)
router.get('/', produtosController.listar);

// Protegido: gestão do cardápio, só admin
router.post('/', autenticar, autorizarNiveis('admin'), produtosController.criar);
router.put('/:id', autenticar, autorizarNiveis('admin'), produtosController.atualizar);
router.put('/:id/imagem', autenticar, autorizarNiveis('admin'), produtosController.atualizarImagem);
router.patch('/:id/disponibilidade', autenticar, autorizarNiveis('admin'), produtosController.alternarDisponibilidade);
router.delete('/:id', autenticar, autorizarNiveis('admin'), produtosController.excluir);

module.exports = router;
