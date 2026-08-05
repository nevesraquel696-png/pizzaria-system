-- ============================================
-- MIGRAÇÃO: seções de cardápio customizáveis + tema (cores/logo)
-- Rode este script UMA VEZ no banco já existente (não apaga nenhum dado).
--
-- O que muda:
-- 1) Nova tabela `secoes_cardapio` - o admin cria/renomeia/reordena/apaga
--    livremente pelo painel, no lugar do antigo ENUM fixo
--    (tradicional/especial/doce/promocao).
-- 2) `produtos.categoria` e `precos_pizza.categoria` viram `secao_id`,
--    apontando pra tabela nova. Os dados existentes são migrados
--    automaticamente (cada categoria antiga vira uma seção com o mesmo
--    nome, na mesma ordem de sempre).
-- 3) `itens_pedido.pizza_categoria` deixa de ser ENUM e passa a guardar o
--    NOME da seção (texto), pra pedidos antigos continuarem legíveis mesmo
--    que uma seção seja renomeada ou apagada depois.
-- 4) `configuracoes` ganha as colunas `tema_cores` (JSON) e `logo_base64`
--    (upload do logotipo pelo admin).
-- ============================================

-- 1) Seções (a partir do ENUM fixo, na mesma ordem de sempre)
CREATE TABLE IF NOT EXISTS secoes_cardapio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ordem INT NOT NULL DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO secoes_cardapio (nome, ordem) VALUES
('Tradicional', 1), ('Especial', 2), ('Doce', 3), ('Promoção', 4);

-- 2a) produtos: nova coluna secao_id, migra os dados, remove a antiga
ALTER TABLE produtos ADD COLUMN secao_id INT DEFAULT NULL AFTER tipo;
UPDATE produtos p JOIN secoes_cardapio s
    ON (p.categoria = 'tradicional' AND s.nome = 'Tradicional')
    OR (p.categoria = 'especial' AND s.nome = 'Especial')
    OR (p.categoria = 'doce' AND s.nome = 'Doce')
    OR (p.categoria = 'promocao' AND s.nome = 'Promoção')
SET p.secao_id = s.id;
ALTER TABLE produtos ADD CONSTRAINT fk_produtos_secao FOREIGN KEY (secao_id) REFERENCES secoes_cardapio(id);
ALTER TABLE produtos DROP COLUMN categoria;

-- 2b) precos_pizza: idem, com a chave única trocando de (categoria,fatias) para (secao_id,fatias)
ALTER TABLE precos_pizza ADD COLUMN secao_id INT DEFAULT NULL AFTER id;
UPDATE precos_pizza pp JOIN secoes_cardapio s
    ON (pp.categoria = 'tradicional' AND s.nome = 'Tradicional')
    OR (pp.categoria = 'especial' AND s.nome = 'Especial')
    OR (pp.categoria = 'doce' AND s.nome = 'Doce')
    OR (pp.categoria = 'promocao' AND s.nome = 'Promoção')
SET pp.secao_id = s.id;
ALTER TABLE precos_pizza MODIFY COLUMN secao_id INT NOT NULL;
ALTER TABLE precos_pizza DROP INDEX categoria_fatias;
ALTER TABLE precos_pizza DROP COLUMN categoria;
ALTER TABLE precos_pizza ADD UNIQUE KEY secao_fatias (secao_id, fatias);
ALTER TABLE precos_pizza ADD CONSTRAINT fk_precos_secao FOREIGN KEY (secao_id) REFERENCES secoes_cardapio(id) ON DELETE CASCADE;

-- 3) itens_pedido: ENUM -> texto (snapshot do nome da seção no pedido)
ALTER TABLE itens_pedido MODIFY COLUMN pizza_categoria VARCHAR(100) DEFAULT NULL;
UPDATE itens_pedido SET pizza_categoria = CASE pizza_categoria
    WHEN 'tradicional' THEN 'Tradicional'
    WHEN 'especial' THEN 'Especial'
    WHEN 'doce' THEN 'Doce'
    WHEN 'promocao' THEN 'Promoção'
    ELSE pizza_categoria
END;

-- 4) configuracoes: cores do tema + logotipo customizados
ALTER TABLE configuracoes ADD COLUMN tema_cores JSON DEFAULT NULL;
ALTER TABLE configuracoes ADD COLUMN logo_base64 LONGTEXT DEFAULT NULL;
