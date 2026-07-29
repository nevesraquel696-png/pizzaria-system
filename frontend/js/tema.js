// Aplica a personalização feita pelo admin (logo, cores, som de notificação)
// em qualquer página que incluir este script. Busca em /config (endpoint
// público) e, se o admin não personalizou nada, os campos vêm nulos e a
// página simplesmente continua com os padrões (logo.png, sino.mp3 e as
// cores originais do theme.css) - nunca quebra por causa disso.

function hexParaRgb(hex) {
    const limpo = hex.replace('#', '');
    const bigint = parseInt(limpo, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

// Escurece uma cor hex - usado pra gerar automaticamente a variante
// "-escuro" (hover de botão, título etc.) a partir da cor escolhida no
// admin, sem precisar pedir duas cores pra cada tom.
function escurecerHex(hex, fator = 0.28) {
    const { r, g, b } = hexParaRgb(hex);
    const ajustar = (c) => Math.max(0, Math.round(c * (1 - fator)));
    const paraHex = (c) => c.toString(16).padStart(2, '0');
    return `#${paraHex(ajustar(r))}${paraHex(ajustar(g))}${paraHex(ajustar(b))}`;
}

async function aplicarTemaPersonalizado() {
    try {
        const config = await apiFetch('/config');
        const raiz = document.documentElement.style;

        if (config.cor_primaria) {
            raiz.setProperty('--cor-verde', config.cor_primaria);
            raiz.setProperty('--cor-verde-escuro', escurecerHex(config.cor_primaria));
        }
        if (config.cor_destaque) {
            raiz.setProperty('--cor-vermelho', config.cor_destaque);
            raiz.setProperty('--cor-vermelho-escuro', escurecerHex(config.cor_destaque));
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
