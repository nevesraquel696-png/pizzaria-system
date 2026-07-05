-- ============================================
-- BANCO DE DADOS - SISTEMA PIZZARIA (v2)
-- Execute este script completo no MySQL
--
-- MUDANÇA IMPORTANTE nesta versão:
-- O preço da pizza agora depende do TAMANHO (nº de fatias) e da
-- CATEGORIA (tradicional/especial/doce/promocao), igual ao cardápio
-- físico. Os sabores dentro de uma categoria compartilham o mesmo
-- preço por tamanho. A borda continua com preço próprio, somado.
-- ============================================

CREATE DATABASE IF NOT EXISTS pizzaria_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pizzaria_db;

DROP TABLE IF EXISTS itens_pedido;
DROP TABLE IF EXISTS pedidos;
DROP TABLE IF EXISTS produtos;
DROP TABLE IF EXISTS precos_pizza;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS configuracoes;

CREATE TABLE configuracoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    horario_abertura TIME NOT NULL DEFAULT '17:30:00',
    horario_fechamento TIME NOT NULL DEFAULT '23:30:00'
);
INSERT INTO configuracoes (horario_abertura, horario_fechamento) VALUES ('17:30:00', '23:30:00');

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    nivel ENUM('admin','cozinha') DEFAULT 'admin',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de preços: uma linha por combinação categoria + tamanho.
-- Edite os valores pelo painel admin (ou direto aqui) com os preços reais.
CREATE TABLE precos_pizza (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoria ENUM('tradicional','especial','doce','promocao') NOT NULL,
    fatias INT NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    UNIQUE KEY categoria_fatias (categoria, fatias)
);

-- Preencha com os preços reais da pizzaria (valores de exemplo abaixo, ajuste no admin)
INSERT INTO precos_pizza (categoria, fatias, preco) VALUES
('tradicional', 4, 0.00), ('tradicional', 6, 0.00), ('tradicional', 8, 0.00), ('tradicional', 12, 0.00), ('tradicional', 14, 0.00),
('especial', 4, 0.00), ('especial', 6, 0.00), ('especial', 8, 0.00), ('especial', 12, 0.00), ('especial', 14, 0.00),
('doce', 4, 0.00), ('doce', 6, 0.00), ('doce', 8, 0.00), ('doce', 12, 0.00), ('doce', 14, 0.00),
('promocao', 4, 0.00), ('promocao', 6, 0.00), ('promocao', 8, 0.00), ('promocao', 12, 0.00), ('promocao', 14, 0.00);

-- produtos: sabores de pizza (com categoria), bordas, bebidas e outros itens
CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('sabor_pizza','borda','bebida','outros') NOT NULL,
    categoria ENUM('tradicional','especial','doce','promocao') DEFAULT NULL,
    preco_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    disponivel BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20),
    tipo_entrega ENUM('local','retirada','entrega') NOT NULL,
    endereco TEXT,
    forma_pagamento ENUM('pix','cartao','dinheiro') NOT NULL,
    troco_para DECIMAL(10,2) DEFAULT 0.00,
    status ENUM('pendente','preparo','saiu_entrega','entregue') DEFAULT 'pendente',
    total DECIMAL(10,2) NOT NULL,
    vezes_impresso INT DEFAULT 1,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE itens_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    tipo_item ENUM('pizza','bebida','outros') NOT NULL,
    pizza_categoria ENUM('tradicional','especial','doce','promocao') DEFAULT NULL,
    fatias INT DEFAULT NULL,
    sabores JSON DEFAULT NULL,
    borda VARCHAR(50) DEFAULT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    preco_unitario DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

-- ============================================
-- SABORES DE EXEMPLO (edite/apague pelo painel admin)
-- ============================================
INSERT INTO produtos (nome, tipo, categoria, preco_base, disponivel) VALUES
('Calabresa', 'sabor_pizza', 'tradicional', 0, TRUE),
('Mussarela', 'sabor_pizza', 'tradicional', 0, TRUE),
('Frango com Catupiry', 'sabor_pizza', 'especial', 0, TRUE),
('Chocolate', 'sabor_pizza', 'doce', 0, TRUE);

INSERT INTO produtos (nome, tipo, preco_base, disponivel) VALUES
('Catupiry', 'borda', 0, TRUE),
('Cheddar', 'borda', 0, TRUE),
('Chocolate', 'borda', 0, TRUE),
('Coca-Cola 2L', 'bebida', 0, TRUE),
('Guaraná 2L', 'bebida', 0, TRUE);
