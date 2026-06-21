const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const { databaseUrl } = require('./db_config.cjs');

const client = new Client({
  connectionString: databaseUrl,
});

async function applyFix() {
  try {
    const sqlPath = path.join(__dirname, 'fix_blocked_and_delete_v3_4.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Connecting to Supabase Database...");
    await client.connect();
    
    console.log("Applying Security Hardening & Deletion Fixes (V3.4)...");
    await client.query(sql);
    
    console.log("✅ Database Polices Updated Successfully!");
  } catch (err) {
    console.error("❌ Database Error:", err.message);
    console.log("\n--- SQL CONTENT ---\n", err.detail || "");
  } finally {
    await client.end();
  }
}

applyFix();
