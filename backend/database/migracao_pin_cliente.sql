-- ============================================
-- MIGRAÇÃO: senha (PIN de 4 números) pra proteger os dados salvos do cliente
-- Rode no SEU BANCO JÁ EXISTENTE (TiDB Cloud). Não apaga nada.
--
-- Problema que isso resolve: hoje, quem digita um telefone no checkout
-- recebe de volta o nome e o endereço da última pessoa que pediu com esse
-- número - sem nenhuma verificação. Isso expõe dado pessoal pra quem
-- souber ou simplesmente adivinhar um telefone (não é tão difícil, são só
-- 11 dígitos previsíveis por região/operadora).
--
-- Com essa migração, o cliente pode (opcionalmente, sem obrigar ninguém)
-- criar uma senha de 4 números no pedido. Da próxima vez que digitar o
-- mesmo telefone, o sistema só devolve nome/endereço depois de confirmar
-- essa senha - quem não criou senha continua funcionando exatamente como
-- hoje (sem quebrar nada pra quem já pediu antes).
-- ============================================

USE pizzaria_db;

CREATE TABLE IF NOT EXISTS clientes_pin (
    telefone VARCHAR(11) PRIMARY KEY,
    pin_hash VARCHAR(255) NOT NULL,
    tentativas_falhas INT NOT NULL DEFAULT 0,
    bloqueado_ate TIMESTAMP NULL DEFAULT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
