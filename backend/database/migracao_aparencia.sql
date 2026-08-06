-- ============================================
-- MIGRAÇÃO: personalização de aparência (logo, TODAS as cores do tema, sino)
-- Rode no SEU BANCO JÁ EXISTENTE (TiDB Cloud). Não apaga nada.
--
-- Se você já rodou uma versão anterior deste arquivo (que criava as colunas
-- cor_primaria/cor_destaque), pode ignorar o erro de "coluna já existe" nas
-- duas primeiras linhas e rodar só a de cores_json - o sistema agora usa
-- cores_json no lugar das duas colunas antigas.
-- ============================================

USE pizzaria_db;

-- Logo e som ficam salvos em base64 direto no banco (mesmo esquema já usado
-- pelas fotos de tamanho de pizza) - assim não somem quando o serviço
-- reinicia em plataformas como o Render, que apagam o disco a cada deploy.
-- Enquanto ficarem NULL, o sistema usa os arquivos padrão
-- (frontend/imagens/logo.png e frontend/sounds/sino.mp3).
ALTER TABLE configuracoes ADD COLUMN logo_base64 LONGTEXT DEFAULT NULL;
ALTER TABLE configuracoes ADD COLUMN sino_base64 LONGTEXT DEFAULT NULL;

-- Todas as cores do tema (verde, vermelho, dourado, fundo, texto etc.),
-- guardadas como um único JSON: {"--cor-verde": "#0A6C40", ...}.
-- Enquanto NULL, o sistema usa as cores padrão de frontend/css/theme.css.
ALTER TABLE configuracoes ADD COLUMN cores_json LONGTEXT DEFAULT NULL;
