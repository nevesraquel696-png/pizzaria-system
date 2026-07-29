-- ============================================
-- MIGRAÇÃO: personalização de aparência (logo, cores, sino de notificação)
-- Rode no SEU BANCO JÁ EXISTENTE (TiDB Cloud). Não apaga nada.
-- ============================================

USE pizzaria_db;

-- Logo e som ficam salvos em base64 direto no banco (mesmo esquema já usado
-- pelas fotos de tamanho de pizza) - assim não somem quando o serviço
-- reinicia em plataformas como o Render, que apagam o disco a cada deploy.
-- Enquanto ficarem NULL, o sistema usa os arquivos padrão
-- (frontend/imagens/logo.png e frontend/sounds/sino.mp3).
ALTER TABLE configuracoes ADD COLUMN logo_base64 LONGTEXT DEFAULT NULL;
ALTER TABLE configuracoes ADD COLUMN sino_base64 LONGTEXT DEFAULT NULL;

-- Cores em hex (#RRGGBB). Enquanto NULL, o sistema usa as cores padrão
-- definidas em frontend/css/theme.css.
ALTER TABLE configuracoes ADD COLUMN cor_primaria VARCHAR(7) DEFAULT NULL;
ALTER TABLE configuracoes ADD COLUMN cor_destaque VARCHAR(7) DEFAULT NULL;
