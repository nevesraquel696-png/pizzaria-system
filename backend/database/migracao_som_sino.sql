-- ============================================
-- MIGRAÇÃO: som do sino personalizado (aba Aparência do admin)
-- Rode UMA VEZ no banco já existente. Não apaga nada.
-- NULL = continua usando o frontend/sounds/sino.mp3 padrão.
-- ============================================

ALTER TABLE configuracoes ADD COLUMN som_sino_base64 LONGTEXT DEFAULT NULL;
