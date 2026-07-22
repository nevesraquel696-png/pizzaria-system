-- ============================================
-- MIGRAÇÃO: mostrar o nome de bebidas/outros itens nos pedidos
-- Rode no SEU BANCO JÁ EXISTENTE (TiDB Cloud). Não apaga nada.
-- ============================================

USE pizzaria_db;

-- Antes, o pedido só guardava "bebida" ou "outros" (o tipo), sem o nome
-- do produto - por isso os painéis mostravam só "1x Bebida" em vez de
-- "1x Coca Lata". A partir de agora, o nome é salvo junto no momento
-- da compra.
ALTER TABLE itens_pedido ADD COLUMN nome_item VARCHAR(100) DEFAULT NULL;

-- Pedidos ANTIGOS (feitos antes dessa migração) continuam sem esse nome,
-- porque a informação não foi guardada na hora - não tem como recuperar
-- retroativamente. Só os pedidos novos, feitos depois de publicar essa
-- correção, vão mostrar o nome certinho.
