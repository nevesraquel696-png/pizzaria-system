-- ============================================
-- MIGRAÇÃO: número de pedido que reinicia a cada dia operacional
--
-- O `id` do pedido (chave interna do banco) NUNCA reinicia - ele é usado
-- em toda referência interna (itens do pedido, exclusão, atualização de
-- status, etc). Reiniciar ele geraria IDs duplicados e quebraria tudo.
--
-- Em vez disso, essa migração adiciona um número SEPARADO,
-- `numero_pedido_dia`, que é só o que aparece na tela pro cliente/cozinha
-- ("Pedido #0007") - esse sim reinicia em 1 a cada novo dia operacional.
--
-- Execute este script UMA VEZ no banco já existente.
-- ============================================

-- Ajuste o nome do banco se for diferente do seu:
USE pizzaria_db;

ALTER TABLE pedidos ADD COLUMN numero_pedido_dia INT NULL AFTER dia_operacional;

-- Backfill dos pedidos que já existem: numera cada um dentro do seu próprio
-- dia_operacional, na ordem em que foram criados.
UPDATE pedidos p
JOIN (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY dia_operacional ORDER BY criado_em ASC) AS numero
    FROM pedidos
) t ON t.id = p.id
SET p.numero_pedido_dia = t.numero
WHERE p.numero_pedido_dia IS NULL;

ALTER TABLE pedidos MODIFY COLUMN numero_pedido_dia INT NOT NULL;

-- Tabela do contador atômico (usada pelo backend pra gerar o próximo número
-- de cada dia sem risco de dois pedidos simultâneos saírem com o mesmo
-- número - ver backend/models/Pedido.js).
CREATE TABLE IF NOT EXISTS contadores_pedido_dia (
    dia_operacional DATE PRIMARY KEY,
    ultimo_numero INT NOT NULL DEFAULT 0
);

-- Inicializa o contador de cada dia já existente com o maior número já
-- usado nesse dia - sem isso, o primeiro pedido novo depois da migração
-- poderia repetir um número já usado hoje.
INSERT INTO contadores_pedido_dia (dia_operacional, ultimo_numero)
SELECT dia_operacional, MAX(numero_pedido_dia) FROM pedidos GROUP BY dia_operacional
ON DUPLICATE KEY UPDATE ultimo_numero = VALUES(ultimo_numero);
