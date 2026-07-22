const express = require('express');
const router = express.Router();
const produtosController = require('../controllers/produtosController');
const autenticar = require('../middleware/autenticacao');

// Público: cliente vê o cardápio disponível (?disponiveis=true)
router.get('/', produtosController.listar);

// Protegido: gestão do cardápio pelo admin
router.post('/', autenticar, produtosController.criar);
router.put('/:id', autenticar, produtosController.atualizar);
router.patch('/:id/disponibilidade', autenticar, produtosController.alternarDisponibilidade);
router.delete('/:id', autenticar, produtosController.excluir);

module.exports = router;
