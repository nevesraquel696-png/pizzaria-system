-- ============================================
-- MIGRAÇÃO: cupons de desconto, banner de promoção,
-- fotos por tamanho (agora salvas no banco, não em arquivo)
-- Rode no SEU BANCO JÁ EXISTENTE (TiDB Cloud). Não apaga nada.
-- ============================================

USE pizzaria_db;

-- 1) Banner de promoção (aviso no topo da loja, sem desconto automático)
ALTER TABLE configuracoes ADD COLUMN promocao_ativa BOOLEAN DEFAULT FALSE;
ALTER TABLE configuracoes ADD COLUMN promocao_texto VARCHAR(255) DEFAULT NULL;

-- 2) Cupons de desconto (o admin cria em Configurações > Cupons)
CREATE TABLE IF NOT EXISTS cupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(40) NOT NULL UNIQUE,
    tipo ENUM('percentual', 'fixo') NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    validade DATE DEFAULT NULL,       -- NULL = sem data de expiração
    limite_uso INT DEFAULT NULL,      -- NULL = sem limite de quantas vezes pode ser usado
    usos_atuais INT DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3) Guarda no pedido qual cupom foi usado e quanto de desconto deu
--    (histórico correto mesmo se o cupom for editado/apagado depois)
ALTER TABLE pedidos ADD COLUMN cupom_codigo VARCHAR(40) DEFAULT NULL;
ALTER TABLE pedidos ADD COLUMN desconto DECIMAL(10,2) DEFAULT 0.00;

-- 4) Foto por TAMANHO (4/6/8/12/14 fatias) em vez de por categoria.
--    Guardada como base64 direto no banco (LONGTEXT) em vez de arquivo em
--    disco - no Render (e serviços parecidos) o disco não é permanente e o
--    arquivo se perde a cada reinício do servidor, deixando o link quebrado.
--    Guardando no banco, a foto nunca some.
CREATE TABLE IF NOT EXISTS imagens_tamanho (
    fatias INT PRIMARY KEY,
    imagem_base64 LONGTEXT DEFAULT NULL
);
INSERT IGNORE INTO imagens_tamanho (fatias, imagem_base64) VALUES
(4, NULL), (6, NULL), (8, NULL), (12, NULL), (14, NULL);

-- A tabela antiga "imagens_categoria" (por categoria, em arquivo) não é mais
-- usada pelo sistema, mas fica aqui sem ser apagada, caso queira consultar o
-- que tinha antes. Pode ser removida manualmente se quiser:
-- DROP TABLE imagens_categoria;
