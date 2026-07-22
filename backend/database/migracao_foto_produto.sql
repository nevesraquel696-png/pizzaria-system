-- ============================================
-- MIGRAÇÃO: foto por produto (bebidas, outros, bordas)
-- Rode no SEU BANCO JÁ EXISTENTE (TiDB Cloud). Não apaga nada.
-- ============================================

USE pizzaria_db;

ALTER TABLE produtos ADD COLUMN imagem_base64 LONGTEXT DEFAULT NULL;
