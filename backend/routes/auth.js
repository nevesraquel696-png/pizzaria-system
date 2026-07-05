const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/cadastrar', authController.cadastrar); // use uma vez para criar o admin, depois proteja/remova

module.exports = router;
