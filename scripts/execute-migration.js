const fs = require('fs');
const path = require('path');
require('dotenv').config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const executeSQL = async (sql) => {
  const response = await fetch(`${url}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to execute SQL: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.text();
};

const main = async () => {
  const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '202601261714_fix_plan_features.sql');
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`Migration file not found: ${migrationFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationFile, 'utf8');
  console.log('Executing migration: 202601261714_fix_plan_features.sql');
  
  try {
    await executeSQL(sql);
    console.log('✅ Migration executed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});