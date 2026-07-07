-- ============================================
-- MIGRAÇÃO: adicionar campo de descrição + cardápio completo
-- Rode este script no SEU BANCO JÁ EXISTENTE (TiDB Cloud).
-- Ele NÃO apaga nada que você já tem (preços, admin, pedidos).
-- ============================================

USE pizzaria_db;

-- 1) Adiciona a coluna de descrição (se der erro "Duplicate column name",
--    significa que você já rodou isso antes - pode ignorar e seguir pro passo 2)
ALTER TABLE produtos ADD COLUMN descricao TEXT DEFAULT NULL AFTER preco_base;

-- 2) Remove os sabores/bordas de EXEMPLO que vieram no script inicial
--    (Calabresa, Mussarela, Frango com Catupiry, Chocolate, e as 3 bordas),
--    pra não duplicar quando inserirmos o cardápio completo abaixo.
--    Isso NÃO afeta bebidas, preços, o usuário admin nem pedidos já feitos.
DELETE FROM produtos WHERE tipo IN ('sabor_pizza', 'borda');

-- 3) Cardápio completo baseado no seu cardápio físico.
--    Os PREÇOS não vêm aqui de propósito - configure os valores reais
--    na aba "Preços" do painel admin, por categoria e tamanho.

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

-- ---------- BORDAS (descrições opcionais, edite os preços no painel) ----------
INSERT INTO produtos (nome, tipo, preco_base, disponivel) VALUES
('Catupiry', 'borda', 0, TRUE),
('Cheddar', 'borda', 0, TRUE),
('Chocolate', 'borda', 0, TRUE);

-- Confirma quantos sabores foram cadastrados
SELECT categoria, COUNT(*) AS total_sabores FROM produtos WHERE tipo = 'sabor_pizza' GROUP BY categoria;
