-- ============================================
-- MIGRAÇÃO: passar as imagens de categoria para o Cloudinary
-- Rode no SEU BANCO JÁ EXISTENTE (TiDB Cloud). Não apaga nada.
-- ============================================

USE pizzaria_db;

-- Guarda o "public_id" da imagem no Cloudinary, necessário pra poder
-- apagar o arquivo de lá quando o admin remover a imagem da categoria.
ALTER TABLE imagens_categoria ADD COLUMN imagem_public_id VARCHAR(255) DEFAULT NULL;

-- As imagens antigas (se existirem) apontavam pra pasta /uploads do
-- servidor, que já foi apagada pelo Render - por isso limpamos essas
-- referências. Depois é só subir a imagem de novo pelo painel admin,
-- que agora vai direto pro Cloudinary e não some mais.
UPDATE imagens_categoria SET imagem_url = NULL WHERE imagem_url LIKE '/uploads/%';
