-- ============================================
-- MIGRAÇÃO: separa os pedidos por "dia operacional"
--
-- Antes, a aba "Pedidos" do painel mostrava TODOS os pedidos já feitos,
-- desde o primeiro dia do sistema. Essa migração adiciona uma coluna que
-- marca a qual expediente (dia operacional) cada pedido pertence, pra:
--   1) a aba "Pedidos" mostrar só o movimento do dia atual, reiniciando
--      automaticamente quando a loja fecha e abre de novo;
--   2) o painel poder mostrar o histórico de dias anteriores numa aba própria.
--
-- "Dia operacional" != dia do calendário: se a loja abre 17:30 e fecha
-- 01:00, um pedido feito às 00:20 ainda pertence ao expediente que abriu
-- na noite anterior. Veja backend/utils/diaOperacional.js.
--
-- Execute este script UMA VEZ no banco já existente (não recria tabelas).
-- ============================================

ALTER TABLE pedidos ADD COLUMN dia_operacional DATE NULL AFTER criado_em;

-- Backfill dos pedidos que já existiam antes da coluna existir: aproxima
-- pelo dia do calendário em que o pedido foi criado, aplicando o offset
-- fixo de Brasília (-03:00, sem horário de verão desde 2019) sobre o
-- timestamp gravado em UTC. Evita usar CONVERT_TZ porque bancos gerenciados
-- (ex: TiDB Cloud) às vezes não têm as tabelas de fuso horário carregadas.
-- Não tenta recalcular com a regra de "cruza meia-noite" pra pedidos
-- antigos porque o horário de funcionamento configurado na época pode ter
-- sido diferente do atual - a partir de agora, todo pedido NOVO já grava
-- o dia operacional correto no momento da criação.
UPDATE pedidos
SET dia_operacional = DATE(DATE_SUB(criado_em, INTERVAL 3 HOUR))
WHERE dia_operacional IS NULL;

ALTER TABLE pedidos MODIFY COLUMN dia_operacional DATE NOT NULL;
CREATE INDEX idx_pedidos_dia_operacional ON pedidos (dia_operacional);
