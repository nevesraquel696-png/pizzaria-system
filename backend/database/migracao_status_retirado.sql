-- ============================================
-- MIGRAÇÃO: novo status 'retirado' (tela do entregador)
--
-- Antes, o fluxo de status era: pendente -> preparo -> saiu_entrega -> entregue.
-- "saiu_entrega" era marcado pela cozinha (comanda pronta) e o próximo passo
-- já era o entregue final, sem nenhum controle de quem de fato pegou o
-- pedido pra entregar.
--
-- Essa migração adiciona o status 'retirado', usado pela nova tela do
-- entregador (frontend/entregador):
--   1) cozinha marca "Concluído / Saiu" -> status 'saiu_entrega'
--      (pedido pronto, aguardando o entregador pegar)
--   2) entregador marca "Retirei" -> status 'retirado'
--      (ele já pegou o pedido e está a caminho do cliente)
--   3) entregador marca "Entreguei" -> status 'entregue'
--      (finaliza o pedido)
--
-- Execute este script UMA VEZ no banco já existente (não recria tabelas).
-- ============================================

ALTER TABLE pedidos
    MODIFY COLUMN status ENUM('pendente','preparo','saiu_entrega','retirado','entregue') DEFAULT 'pendente';
