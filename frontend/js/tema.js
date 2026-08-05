// Aplica a personalização feita pelo admin (logo, cores, som de notificação)
// em qualquer página que incluir este script. Busca em /config (endpoint
// público) e, se o admin não personalizou nada, os campos vêm nulos e a
// página simplesmente continua com os padrões (logo.png, sino.mp3 e as
// cores originais do theme.css) - nunca quebra por causa disso.

async function aplicarTemaPersonalizado() {
    try {
        const config = await apiFetch('/config');
        const raiz = document.documentElement.style;

        if (config.cores_json) {
            try {
                const cores = JSON.parse(config.cores_json);
                Object.entries(cores).forEach(([variavel, valor]) => {
                    if (/^--cor-[a-z-]+$/.test(variavel) && /^#[0-9A-Fa-f]{6}$/.test(valor)) {
                        raiz.setProperty(variavel, valor);
                    }
                });
            } catch (err) {
                console.warn('cores_json inválido:', err);
            }
        }

        if (config.logo_base64) {
            document.querySelectorAll('.logo-app').forEach(img => { img.src = config.logo_base64; });
        }
        if (config.sino_base64) {
            document.querySelectorAll('.sino-app').forEach(audio => { audio.src = config.sino_base64; });
        }
    } catch (err) {
        console.warn('Não foi possível carregar a personalização de aparência:', err);
    }
}

aplicarTemaPersonalizado();
