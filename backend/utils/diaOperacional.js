// "Dia operacional" é o dia do MOVIMENTO da pizzaria, não o dia do
// calendário: um pedido feito às 00:20, com a loja aberta das 17:30 às
// 01:00, ainda pertence ao expediente que abriu na noite anterior - senão
// esse pedido "trocaria de dia" no meio do mesmo atendimento.
//
// A lógica de "cruza meia-noite" é a mesma usada em
// middleware/horarioFuncionamento.js pra decidir se a loja está aberta -
// aqui só reaproveitamos ela pra decidir A QUAL dia o pedido pertence.
//
// Sempre calculado no fuso America/Sao_Paulo, pelo mesmo motivo do
// middleware de horário: servidores como o Render rodam em UTC por padrão.

function formatarDataSP(data) {
    // yyyy-mm-dd no fuso de São Paulo, sem depender de bibliotecas externas
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(data);
    const mapa = Object.fromEntries(partes.map(p => [p.type, p.value]));
    return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function formatarHoraSP(data) {
    return data.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
}

/**
 * @param {{horario_abertura: string, horario_fechamento: string}} config
 * @param {Date} [agora] - permite injetar uma data fixa em testes; padrão é o momento atual
 * @returns {string} data no formato YYYY-MM-DD representando o dia operacional
 */
function obterDiaOperacional(config, agora = new Date()) {
    const horaAtual = formatarHoraSP(agora);
    const { horario_abertura, horario_fechamento } = config;
    const cruzaMeiaNoite = horario_fechamento < horario_abertura;

    // Se o expediente cruza a meia-noite e ainda estamos "depois da meia-noite,
    // mas antes do fechamento" (ex: 00:20 com fechamento às 01:00), o pedido
    // pertence ao dia operacional de ONTEM, não ao de hoje.
    if (cruzaMeiaNoite && horaAtual <= horario_fechamento) {
        const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
        return formatarDataSP(ontem);
    }

    return formatarDataSP(agora);
}

module.exports = { obterDiaOperacional };
