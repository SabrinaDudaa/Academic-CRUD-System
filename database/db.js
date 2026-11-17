const { Pool } = require('pg');

// As variáveis de ambiente são opcionais: sem elas, valem os mesmos dados do readme.txt.
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'GrupoBD',
  password: process.env.DB_PASSWORD || 'serverBD2025',
  database: process.env.DB_NAME || 'sistemaong',
});

// Executa várias consultas na MESMA conexão, dentro de uma transação.
// (pool.query('BEGIN') e as consultas seguintes podem cair em conexões diferentes,
// então a transação não valeria de nada.)
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await callback(client);
    await client.query('COMMIT');
    return resultado;
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  transaction,
  end: () => pool.end(),
};
