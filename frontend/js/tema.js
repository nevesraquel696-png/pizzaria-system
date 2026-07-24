// ============================================
// Alternância de tema (claro/escuro) - compartilhado entre
// admin.js e cozinha.js, que só diferem na configuração:
// o admin nasce claro e liga o escuro; a cozinha nasce escura
// e liga o claro. A lógica de ligar/lembrar/atualizar botão é
// a mesma nos dois casos, então mora aqui uma vez só.
//
// Uso:
//   const tema = criarAlternadorTema({
//       chave: 'pizzaria_tema_escuro',
//       classe: 'tema-escuro',
//       botaoId: 'btn-tema-escuro',
//       padraoAtivo: false,
//       iconeAtivo: ICONES.sol,
//       iconeInativo: ICONES.lua,
//       textoAtivo: 'Modo Claro',
//       textoInativo: 'Modo Escuro',
//   });
//   tema.iniciar(); // dentro do DOMContentLoaded
//
// IMPORTANTE: pra não piscar o tema errado por uma fração de
// segundo antes do JS carregar (FOUC), cada página também tem
// um <script> inline logo no início do <body> que já aplica a
// classe salva no localStorage antes de qualquer conteúdo ser
// pintado na tela. Essa função só precisa reaplicar (idempotente)
// e cuidar do ícone/texto do botão, que dependem do icones.js.
// ============================================
function criarAlternadorTema(opcoes) {
    const {
        chave,           // chave usada no localStorage
        classe,          // classe adicionada ao <body> quando "ativo"
        botaoId,         // id do botão que alterna o tema
        padraoAtivo = false,     // valor default se não houver nada salvo
        respeitarSistema = false, // se true, usa prefers-color-scheme como default (só quando não há nada salvo)
        iconeAtivo = '',
        iconeInativo = '',
        textoAtivo = '',
        textoInativo = '',
    } = opcoes;

    function valorPadrao() {
        if (respeitarSistema && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return padraoAtivo;
    }

    function estaAtivoSalvo() {
        const salvo = localStorage.getItem(chave);
        return salvo === null ? valorPadrao() : salvo === 'true';
    }

    function atualizarBotao(ativo) {
        const btn = document.getElementById(botaoId);
        if (!btn) return;
        const icone = btn.querySelector('.icone');
        const texto = btn.querySelector('.texto-acao');
        if (icone) icone.innerHTML = ativo ? iconeAtivo : iconeInativo;
        if (texto) texto.textContent = ativo ? textoAtivo : textoInativo;
        // aria-pressed avisa leitores de tela do estado atual do botão
        btn.setAttribute('aria-pressed', String(ativo));
    }

    function aplicar(ativo) {
        document.body.classList.toggle(classe, ativo);
        atualizarBotao(ativo);
    }

    function alternar() {
        const ativo = !document.body.classList.contains(classe);
        localStorage.setItem(chave, String(ativo));
        aplicar(ativo);
    }

    function iniciar() {
        aplicar(estaAtivoSalvo());
        const btn = document.getElementById(botaoId);
        if (btn) btn.addEventListener('click', alternar);
    }

    return { iniciar, alternar, estaAtivoSalvo };
}
