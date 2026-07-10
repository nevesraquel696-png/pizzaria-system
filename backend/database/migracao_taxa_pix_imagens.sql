-- ============================================
-- MIGRAÇÃO: taxa de entrega, Pix/WhatsApp, imagens por categoria
-- Rode no SEU BANCO JÁ EXISTENTE (TiDB Cloud). Não apaga nada.
-- ============================================

USE pizzaria_db;

-- 1) Configurações gerais: taxa de entrega, chave Pix, WhatsApp da pizzaria
ALTER TABLE configuracoes ADD COLUMN taxa_entrega DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE configuracoes ADD COLUMN chave_pix VARCHAR(255) DEFAULT NULL;
ALTER TABLE configuracoes ADD COLUMN whatsapp_numero VARCHAR(20) DEFAULT NULL;

-- 2) Guarda a taxa cobrada em cada pedido (histórico correto mesmo se a
--    taxa mudar depois)
ALTER TABLE pedidos ADD COLUMN taxa_entrega DECIMAL(10,2) DEFAULT 0.00 AFTER troco_para;

-- 3) Imagem customizada por categoria (usada no lugar do ícone SVG genérico
--    nos cards de tamanho do cliente)
CREATE TABLE IF NOT EXISTS imagens_categoria (
    categoria ENUM('tradicional','especial','doce','promocao') PRIMARY KEY,
    imagem_url VARCHAR(255) DEFAULT NULL
);

INSERT IGNORE INTO imagens_categoria (categoria, imagem_url) VALUES
('tradicional', NULL), ('especial', NULL), ('doce', NULL), ('promocao', NULL);
