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
    horario_fechamento TIME NOT NULL DEFAULT '23:30:00',
    taxa_entrega DECIMAL(10,2) DEFAULT 0.00,
    chave_pix VARCHAR(255) DEFAULT NULL,
    whatsapp_numero VARCHAR(20) DEFAULT NULL
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

-- Imagem customizada por categoria (aparece no lugar do ícone genérico
-- nos cards de tamanho do cliente, se o admin fizer upload de uma)
CREATE TABLE imagens_categoria (
    categoria ENUM('tradicional','especial','doce','promocao') PRIMARY KEY,
    imagem_url VARCHAR(255) DEFAULT NULL,
    imagem_public_id VARCHAR(255) DEFAULT NULL
);
INSERT INTO imagens_categoria (categoria, imagem_url) VALUES
('tradicional', NULL), ('especial', NULL), ('doce', NULL), ('promocao', NULL);

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
    descricao TEXT DEFAULT NULL,
    disponivel BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_nome VARCHAR(100) NOT NULL,
    telefone VARCHAR(20),
    tipo_entrega ENUM('local','retirada','entrega') NOT NULL,
    endereco TEXT,
    observacoes TEXT DEFAULT NULL,
    forma_pagamento ENUM('pix','cartao','dinheiro') NOT NULL,
    troco_para DECIMAL(10,2) DEFAULT 0.00,
    taxa_entrega DECIMAL(10,2) DEFAULT 0.00,
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
    nome_item VARCHAR(100) DEFAULT NULL,
    quantidade INT NOT NULL DEFAULT 1,
    preco_unitario DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

-- ============================================
-- CARDÁPIO COMPLETO (edite/apague pelo painel admin)
-- Preços NÃO vêm aqui de propósito - configure na aba "Preços" do admin.
-- ============================================

-- ---------- PIZZA DOCE ----------
INSERT INTO produtos (nome, tipo, categoria, preco_base, descricao, disponivel) VALUES
('Cartola', 'sabor_pizza', 'doce', 0, 'Mussarela, banana, chocolate e leite condensado', TRUE),
('Chocolate', 'sabor_pizza', 'doce', 0, 'Granulado e chocolate', TRUE),
('Prestígio', 'sabor_pizza', 'doce', 0, 'Granulado, coco ralado e chocolate', TRUE),
('Romeu e Julieta', 'sabor_pizza', 'doce', 0, 'Goiabada e mussarela', TRUE),
('Paçoca', 'sabor_pizza', 'doce', 0, 'Chocolate ao leite e paçoca', TRUE),
('M&Ms', 'sabor_pizza', 'doce', 0, 'Chocolate ao leite e confete', TRUE);

-- ---------- PIZZAS ESPECIAIS ----------
INSERT INTO produtos (nome, tipo, categoria, preco_base, descricao, disponivel) VALUES
('Sítio S.F', 'sabor_pizza', 'especial', 0, 'Frango, mussarela, milho, calabresa, cebola e ovo', TRUE),
('Pra Você', 'sabor_pizza', 'especial', 0, 'Frango, mussarela, milho, tomate e catupiry', TRUE),
('Vegetariana', 'sabor_pizza', 'especial', 0, 'Mussarela, tomate, cebola, pimentão e brócolis', TRUE),
('Pizza Strogonoff', 'sabor_pizza', 'especial', 0, 'Frango, mussarela, batata palha, milho e molho especial', TRUE),
('Carioca', 'sabor_pizza', 'especial', 0, 'Carne moída temperada, mussarela e tomate', TRUE),
('Brócolis', 'sabor_pizza', 'especial', 0, 'Mussarela, brócolis e bacon', TRUE);

-- ---------- PIZZA PROMOÇÃO ----------
INSERT INTO produtos (nome, tipo, categoria, preco_base, descricao, disponivel) VALUES
('Calabresa', 'sabor_pizza', 'promocao', 0, 'Calabresa fatiada e cebola', TRUE),
('Mussarela', 'sabor_pizza', 'promocao', 0, 'Mussarela, azeitona e cebola', TRUE),
('Napolitana', 'sabor_pizza', 'promocao', 0, 'Mussarela, rodelas de tomate e parmesão', TRUE),
('Marguerita', 'sabor_pizza', 'promocao', 0, 'Mussarela, queijo parmesão e manjericão', TRUE);

-- ---------- PIZZA TRADICIONAL ----------
INSERT INTO produtos (nome, tipo, categoria, preco_base, descricao, disponivel) VALUES
('Tanajura', 'sabor_pizza', 'tradicional', 0, 'Queijo com bastante bacon', TRUE),
('Sítio Serrote', 'sabor_pizza', 'tradicional', 0, 'Calabresa moída, pouca cebola e mussarela', TRUE),
('Sítio Aroeira', 'sabor_pizza', 'tradicional', 0, 'Presunto, mussarela e rodelas de tomate', TRUE),
('Dois Queijos', 'sabor_pizza', 'tradicional', 0, 'Mussarela e catupiry', TRUE),
('Sítio Tamanduá', 'sabor_pizza', 'tradicional', 0, 'Calabresa com queijo e cebola', TRUE),
('Sítio Garapa', 'sabor_pizza', 'tradicional', 0, 'Calabresa moída, molho de pimenta, cebola e ovo', TRUE),
('Sítio Cacimba', 'sabor_pizza', 'tradicional', 0, 'Milho, calabresa moída e mussarela', TRUE),
('Matuta', 'sabor_pizza', 'tradicional', 0, 'Queijo, bacon, presunto e pouca cebola', TRUE),
('Sítio Angico', 'sabor_pizza', 'tradicional', 0, 'Calabresa, presunto, milho, cebola e mussarela', TRUE),
('Caipira', 'sabor_pizza', 'tradicional', 0, 'Frango, milho e catupiry', TRUE),
('Sítio Tingui', 'sabor_pizza', 'tradicional', 0, 'Presunto, palmito, milho, catupiry ou mussarela', TRUE),
('Atum', 'sabor_pizza', 'tradicional', 0, 'Molho, atum e cebola', TRUE),
('Frango', 'sabor_pizza', 'tradicional', 0, 'Frango temperado e mussarela', TRUE),
('Portuguesa', 'sabor_pizza', 'tradicional', 0, 'Presunto, mussarela, ovo e cebola', TRUE),
('Catu Frango', 'sabor_pizza', 'tradicional', 0, 'Frango com catupiry', TRUE),
('Sítio Lagoa Grande', 'sabor_pizza', 'tradicional', 0, 'Calabresa moída, bacon e catupiry', TRUE),
('Sítio Bredos', 'sabor_pizza', 'tradicional', 0, 'Bacon, palmito, catupiry e queijo', TRUE),
('Quatro Queijos', 'sabor_pizza', 'tradicional', 0, 'Cheddar, mussarela, catupiry e parmesão', TRUE),
('Maluca do Júnior', 'sabor_pizza', 'tradicional', 0, 'Calabresa fatiada, presunto, mussarela, ovo, catupiry e frango', TRUE),
('Sítio Rigideira', 'sabor_pizza', 'tradicional', 0, 'Carne de sol, calabresa fatiada, pouca cebola e mussarela', TRUE),
('Sítio Poção', 'sabor_pizza', 'tradicional', 0, 'Presunto, milho, ervilha e mussarela', TRUE),
('Trem-Bom', 'sabor_pizza', 'tradicional', 0, 'Atum, frango, queijo e milho', TRUE),
('Cegonheira', 'sabor_pizza', 'tradicional', 0, 'Presunto, frango, queijo, milho, bacon, ovo, calabresa e catupiry', TRUE),
('Monteirense', 'sabor_pizza', 'tradicional', 0, 'Carne de sol, milho, mussarela, catupiry e pouca cebola', TRUE),
('Maria Bonita', 'sabor_pizza', 'tradicional', 0, 'Carne de sol, milho, mussarela, catupiry e pouca cebola', TRUE),
('Velho Chico', 'sabor_pizza', 'tradicional', 0, 'Mussarela, carne de sol, queijo, manteiga, milho e catupiry', TRUE),
('Estação Santa Catarina', 'sabor_pizza', 'tradicional', 0, 'Cheddar, palmito, ervilha e peito de peru', TRUE),
('Estação Gameleira', 'sabor_pizza', 'tradicional', 0, 'Catupiry, camarão, mussarela e cebola', TRUE),
('Estação Pcinhos', 'sabor_pizza', 'tradicional', 0, 'Palmito, milho, ervilha, bacon e peito de peru', TRUE),
('Estação Extrema', 'sabor_pizza', 'tradicional', 0, 'Mussarela, peito de peru, milho e bacon', TRUE);

INSERT INTO produtos (nome, tipo, preco_base, disponivel) VALUES
('Catupiry', 'borda', 0, TRUE),
('Cheddar', 'borda', 0, TRUE),
('Chocolate', 'borda', 0, TRUE),
('Coca-Cola 2L', 'bebida', 0, TRUE),
('Guaraná 2L', 'bebida', 0, TRUE);
