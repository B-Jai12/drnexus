const { initDatabase, pool, query } = require("./supabase");

async function connectToDatabase() {
  await initDatabase();
  return pool;
}

module.exports = { connectToDatabase, pool, query };
