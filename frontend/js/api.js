// URL base do backend. Ajuste se for publicar em outro endereço.
const API_URL = 'http://localhost:3000/api';

function getToken() {
    return localStorage.getItem('pizzaria_token');
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
