// Aplica as cores e o logotipo personalizados pelo admin (aba Aparência),
// se houver algum configurado. Roda em toda tela (cliente/admin/cozinha) -
// sem nada configurado, a página só segue com a paleta e o logo padrão
// definidos em frontend/css/theme.css e frontend/imagens/logo.png.
const CHAVES_TEMA = ['verde', 'verde-escuro', 'vermelho', 'vermelho-escuro', 'terracota', 'dourado', 'creme', 'texto'];

async function aplicarTemaGlobal() {
    try {
        const resp = await fetch(`${API_URL}/config`);
        const config = await resp.json();

        if (config.tema_cores) {
            CHAVES_TEMA.forEach(chave => {
                if (config.tema_cores[chave]) {
                    document.documentElement.style.setProperty(`--cor-${chave}`, config.tema_cores[chave]);
                }
            });
        }

        if (config.logo_base64) {
            document.querySelectorAll('img[src*="logo.png"]').forEach(img => {
                img.src = config.logo_base64;
            });
        }
    } catch (err) {
        // API fora do ar ou sem tema customizado ainda - segue com o padrão.
    }
}

document.addEventListener('DOMContentLoaded', aplicarTemaGlobal);
