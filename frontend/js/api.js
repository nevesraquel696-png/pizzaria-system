// ATENÇÃO: quando for publicar online, troque as duas linhas abaixo
// pelo endereço do seu backend hospedado (ex: https://sua-api.onrender.com)
const API_URL = 'https://pizzaria-system-virginia.onrender.com/api';
const SOCKET_URL = 'https://pizzaria-system-virginia.onrender.com';

function getToken() {
    return localStorage.getItem('pizzaria_token');
}

// Escapa texto antes de inserir em innerHTML. Sem isso, um cliente poderia
// digitar algo como <script> no nome ou nas observações do pedido, e esse
// código rodaria na tela de quem está no admin/cozinha ao ver o pedido.
function escapeHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function apiFetch(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const resp = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
        throw new Error(data.erro || data.mensagem || 'Erro na requisição');
    }
    return data;
}
