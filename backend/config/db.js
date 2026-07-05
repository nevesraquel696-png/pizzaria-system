const mysql = require('mysql2');
require('dotenv').config();

// Pool de conexões: mais estável que uma conexão única,
// reconecta automaticamente e evita o servidor cair depois de tempo ocioso.
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

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
