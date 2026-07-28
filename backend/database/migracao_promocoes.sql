-- ============================================
-- MIGRAÇÃO: Promoções
-- Cada promoção é uma pizza de tamanho fixo, com uma lista fixa de sabores
-- escolhidos pelo admin, vendida por um preço fixo "de/por". Aparece pro
-- cliente numa aba própria no cardápio, parecido com a lista de Tamanhos.
-- Execute este script no banco já existente (quem for instalar do zero
-- já recebe essa tabela pelo schema.sql).
-- ============================================

CREATE TABLE IF NOT EXISTS promocoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    fatias INT NOT NULL,
    sabor_ids JSON NOT NULL,
    preco_de DECIMAL(10,2) NOT NULL,
    preco_por DECIMAL(10,2) NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
