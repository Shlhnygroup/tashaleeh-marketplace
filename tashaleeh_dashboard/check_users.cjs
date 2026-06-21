const { Client } = require('pg');

const { databaseUrl } = require('./db_config.cjs');

const client = new Client({
  connectionString: databaseUrl,
});

async function findUsers() {
  try {
    await client.connect();
    const res = await client.query('SELECT email FROM auth.users LIMIT 5');
    if (res.rows.length > 0) {
      console.log("Users found in database:");
      res.rows.forEach(r => console.log("- " + r.email));
    } else {
      console.log("No users found in database.");
    }
  } catch (err) {
    console.error("Error fetching users:", err.message);
  } finally {
    await client.end();
  }
}

findUsers();
