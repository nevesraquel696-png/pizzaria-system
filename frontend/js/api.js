// ATENÇÃO: quando for publicar online, troque as duas linhas abaixo
// pelo endereço do seu backend hospedado (ex: https://sua-api.onrender.com)
const API_URL = 'http://localhost:3000/api';
const SOCKET_URL = 'http://localhost:3000';

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
