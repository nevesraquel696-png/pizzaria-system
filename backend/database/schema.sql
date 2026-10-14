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
DROP TABLE IF EXISTS promocoes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS configuracoes;
DROP TABLE IF EXISTS secoes_cardapio;

CREATE TABLE configuracoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    horario_abertura TIME NOT NULL DEFAULT '17:30:00',
    horario_fechamento TIME NOT NULL DEFAULT '23:30:00',
    taxa_entrega DECIMAL(10,2) DEFAULT 0.00,
    chave_pix VARCHAR(255) DEFAULT NULL,
    whatsapp_numero VARCHAR(20) DEFAULT NULL,
    promocao_ativa BOOLEAN DEFAULT FALSE,
    promocao_texto VARCHAR(255) DEFAULT NULL,
    -- Cores do tema em JSON, ex: {"verde":"#0A6C40","vermelho":"#A5273A",...}.
    -- Quando NULL (ou faltar alguma chave), o frontend usa a paleta padrão
    -- definida em frontend/css/theme.css - a personalização é sempre opcional.
    tema_cores JSON DEFAULT NULL,
    -- Logotipo customizado em base64, mesmo esquema das fotos de produto:
    -- direto no banco (persistente), nunca em arquivo no servidor.
    logo_base64 LONGTEXT DEFAULT NULL
);
INSERT INTO configuracoes (horario_abertura, horario_fechamento) VALUES ('17:30:00', '23:30:00');

-- Seções do cardápio (ex: "Tradicional", "Especial", "Sobremesas"...) -
-- totalmente livres: o admin cria, renomeia, reordena e apaga pelo painel.
-- Substituem o antigo ENUM fixo de categoria dos sabores de pizza.
CREATE TABLE secoes_cardapio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO secoes_cardapio (nome, ordem) VALUES
('Tradicional', 1), ('Especial', 2), ('Doce', 3), ('Promoção', 4);

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    nivel ENUM('admin','cozinha') DEFAULT 'admin',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cupons de desconto (criados pelo admin em Configurações > Cupons)
CREATE TABLE cupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    tipo ENUM('percentual', 'fixo') NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    validade DATE DEFAULT NULL,
    limite_uso INT DEFAULT NULL,
    usos_atuais INT DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Imagem customizada por TAMANHO de pizza (aparece no lugar do ícone genérico
-- nos cards de tamanho do cliente, se o admin fizer upload de uma). Guardada
-- em base64 direto no banco - nada de arquivo em disco, que se perde toda
-- vez que o servidor reinicia em serviços como o Render.
CREATE TABLE imagens_tamanho (
    fatias INT PRIMARY KEY,
    imagem_base64 LONGTEXT DEFAULT NULL
);
INSERT INTO imagens_tamanho (fatias, imagem_base64) VALUES
(4, NULL), (6, NULL), (8, NULL), (12, NULL), (14, NULL);

-- Tabela de preços: uma linha por combinação seção + tamanho.
-- Edite os valores pelo painel admin (ou direto aqui) com os preços reais.
CREATE TABLE precos_pizza (
    id INT AUTO_INCREMENT PRIMARY KEY,
    secao_id INT NOT NULL,
    fatias INT NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    UNIQUE KEY secao_fatias (secao_id, fatias),
    FOREIGN KEY (secao_id) REFERENCES secoes_cardapio(id) ON DELETE CASCADE
);

-- Preencha com os preços reais da pizzaria (valores de exemplo abaixo, ajuste no admin)
INSERT INTO precos_pizza (secao_id, fatias, preco)
SELECT s.id, f.fatias, 0.00
FROM secoes_cardapio s
CROSS JOIN (SELECT 4 AS fatias UNION SELECT 6 UNION SELECT 8 UNION SELECT 12 UNION SELECT 14) f;

-- produtos: sabores de pizza (com seção), bordas, bebidas e outros itens
CREATE TABLE produtos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo ENUM('sabor_pizza','borda','bebida','outros') NOT NULL,
    secao_id INT DEFAULT NULL,
    preco_base DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    descricao TEXT DEFAULT NULL,
    imagem_base64 LONGTEXT DEFAULT NULL,
    disponivel BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (secao_id) REFERENCES secoes_cardapio(id)
);

-- Promoções: pizza de tamanho fixo com sabores fixos escolhidos pelo admin,
-- vendida por um preço fixo "de/por" (ignora a tabela de preços por
-- categoria acima). Aparece pro cliente numa aba própria no cardápio.
CREATE TABLE promocoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    fatias INT NOT NULL,
    sabor_ids JSON NOT NULL,
    preco_de DECIMAL(10,2) NOT NULL,
    preco_por DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
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
    cupom_codigo VARCHAR(40) DEFAULT NULL,
    desconto DECIMAL(10,2) DEFAULT 0.00,
    status ENUM('pendente','preparo','saiu_entrega','entregue') DEFAULT 'pendente',
    total DECIMAL(10,2) NOT NULL,
    vezes_impresso INT DEFAULT 1,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Dia do EXPEDIENTE ao qual o pedido pertence (não necessariamente o
    -- mesmo dia do calendário - ver backend/utils/diaOperacional.js). É o
    -- que permite a aba "Pedidos" reiniciar sozinha a cada novo expediente
    -- e a aba "Histórico" separar o movimento dia a dia.
    dia_operacional DATE NOT NULL,
    -- Número do pedido DENTRO do dia operacional (o que aparece pro cliente/
    -- cozinha como "Pedido #0007") - reinicia em 1 a cada novo expediente.
    -- Diferente do `id` acima, que é a chave real do banco e nunca reinicia.
    numero_pedido_dia INT NOT NULL,
    INDEX idx_pedidos_dia_operacional (dia_operacional)
);

-- Contador atômico usado só internamente pra gerar o numero_pedido_dia sem
-- risco de dois pedidos simultâneos saírem com o mesmo número (ver
-- backend/models/Pedido.js).
CREATE TABLE contadores_pedido_dia (
    dia_operacional DATE PRIMARY KEY,
    ultimo_numero INT NOT NULL DEFAULT 0
);

CREATE TABLE itens_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    tipo_item ENUM('pizza','bebida','outros') NOT NULL,
    -- Guarda o NOME da seção no momento do pedido (não o id) - assim o
    -- histórico de pedidos antigos continua legível mesmo que o admin
    -- depois renomeie ou apague a seção.
    pizza_categoria VARCHAR(100) DEFAULT NULL,
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
INSERT INTO produtos (nome, tipo, secao_id, preco_base, descricao, disponivel) VALUES
('Cartola', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Doce'), 0, 'Mussarela, banana, chocolate e leite condensado', TRUE),
('Chocolate', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Doce'), 0, 'Granulado e chocolate', TRUE),
('Prestígio', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Doce'), 0, 'Granulado, coco ralado e chocolate', TRUE),
('Romeu e Julieta', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Doce'), 0, 'Goiabada e mussarela', TRUE),
('Paçoca', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Doce'), 0, 'Chocolate ao leite e paçoca', TRUE),
('M&Ms', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Doce'), 0, 'Chocolate ao leite e confete', TRUE);

-- ---------- PIZZAS ESPECIAIS ----------
INSERT INTO produtos (nome, tipo, secao_id, preco_base, descricao, disponivel) VALUES
('Sítio S.F', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Especial'), 0, 'Frango, mussarela, milho, calabresa, cebola e ovo', TRUE),
('Pra Você', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Especial'), 0, 'Frango, mussarela, milho, tomate e catupiry', TRUE),
('Vegetariana', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Especial'), 0, 'Mussarela, tomate, cebola, pimentão e brócolis', TRUE),
('Pizza Strogonoff', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Especial'), 0, 'Frango, mussarela, batata palha, milho e molho especial', TRUE),
('Carioca', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Especial'), 0, 'Carne moída temperada, mussarela e tomate', TRUE),
('Brócolis', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Especial'), 0, 'Mussarela, brócolis e bacon', TRUE);

-- ---------- PIZZA PROMOÇÃO ----------
INSERT INTO produtos (nome, tipo, secao_id, preco_base, descricao, disponivel) VALUES
('Calabresa', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Promoção'), 0, 'Calabresa fatiada e cebola', TRUE),
('Mussarela', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Promoção'), 0, 'Mussarela, azeitona e cebola', TRUE),
('Napolitana', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Promoção'), 0, 'Mussarela, rodelas de tomate e parmesão', TRUE),
('Marguerita', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Promoção'), 0, 'Mussarela, queijo parmesão e manjericão', TRUE);

-- ---------- PIZZA TRADICIONAL ----------
INSERT INTO produtos (nome, tipo, secao_id, preco_base, descricao, disponivel) VALUES
('Tanajura', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Queijo com bastante bacon', TRUE),
('Sítio Serrote', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Calabresa moída, pouca cebola e mussarela', TRUE),
('Sítio Aroeira', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Presunto, mussarela e rodelas de tomate', TRUE),
('Dois Queijos', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Mussarela e catupiry', TRUE),
('Sítio Tamanduá', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Calabresa com queijo e cebola', TRUE),
('Sítio Garapa', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Calabresa moída, molho de pimenta, cebola e ovo', TRUE),
('Sítio Cacimba', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Milho, calabresa moída e mussarela', TRUE),
('Matuta', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Queijo, bacon, presunto e pouca cebola', TRUE),
('Sítio Angico', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Calabresa, presunto, milho, cebola e mussarela', TRUE),
('Caipira', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Frango, milho e catupiry', TRUE),
('Sítio Tingui', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Presunto, palmito, milho, catupiry ou mussarela', TRUE),
('Atum', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Molho, atum e cebola', TRUE),
('Frango', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Frango temperado e mussarela', TRUE),
('Portuguesa', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Presunto, mussarela, ovo e cebola', TRUE),
('Catu Frango', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Frango com catupiry', TRUE),
('Sítio Lagoa Grande', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Calabresa moída, bacon e catupiry', TRUE),
('Sítio Bredos', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Bacon, palmito, catupiry e queijo', TRUE),
('Quatro Queijos', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Cheddar, mussarela, catupiry e parmesão', TRUE),
('Maluca do Júnior', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Calabresa fatiada, presunto, mussarela, ovo, catupiry e frango', TRUE),
('Sítio Rigideira', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Carne de sol, calabresa fatiada, pouca cebola e mussarela', TRUE),
('Sítio Poção', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Presunto, milho, ervilha e mussarela', TRUE),
('Trem-Bom', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Atum, frango, queijo e milho', TRUE),
('Cegonheira', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Presunto, frango, queijo, milho, bacon, ovo, calabresa e catupiry', TRUE),
('Monteirense', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Carne de sol, milho, mussarela, catupiry e pouca cebola', TRUE),
('Maria Bonita', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Carne de sol, milho, mussarela, catupiry e pouca cebola', TRUE),
('Velho Chico', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Mussarela, carne de sol, queijo, manteiga, milho e catupiry', TRUE),
('Estação Santa Catarina', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Cheddar, palmito, ervilha e peito de peru', TRUE),
('Estação Gameleira', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Catupiry, camarão, mussarela e cebola', TRUE),
('Estação Pcinhos', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Palmito, milho, ervilha, bacon e peito de peru', TRUE),
('Estação Extrema', 'sabor_pizza', (SELECT id FROM secoes_cardapio WHERE nome='Tradicional'), 0, 'Mussarela, peito de peru, milho e bacon', TRUE);

INSERT INTO produtos (nome, tipo, preco_base, disponivel) VALUES
('Catupiry', 'borda', 0, TRUE),
('Cheddar', 'borda', 0, TRUE),
('Chocolate', 'borda', 0, TRUE),
('Coca-Cola 2L', 'bebida', 0, TRUE),
('Guaraná 2L', 'bebida', 0, TRUE);
