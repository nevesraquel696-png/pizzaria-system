const mysql = require('mysql2');
require('dotenv').config();

// Pool de conexões: mais estável que uma conexão única,
// reconecta automaticamente e evita o servidor cair depois de tempo ocioso.
const configuracaoPool = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Bancos gratuitos hospedados (ex: TiDB Cloud) normalmente exigem SSL.
// Defina DB_SSL=true no .env quando usar um banco externo desses.
// Usamos trim()+toLowerCase() porque alguns painéis de hospedagem (ex: Render)
// podem salvar espaços ou quebras de linha invisíveis no valor da variável.
const sslAtivado = String(process.env.DB_SSL || '').trim().toLowerCase() === 'true';
console.log('DB_SSL lido como:', JSON.stringify(process.env.DB_SSL), '-> ativado:', sslAtivado);

if (sslAtivado) {
    configuracaoPool.ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
}

const pool = mysql.createPool(configuracaoPool);

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Erro ao conectar ao MySQL:', err.message);
        return;
    }
    console.log('Conectado ao Banco de Dados MySQL!');
    connection.release();
});

// Versão "promise" para poder usar async/await nos controllers
const db = pool.promise();

module.exports = db;