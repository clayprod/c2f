const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const fetchSchema = async () => {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/openapi+json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
};

const normalizeSchemaName = (name) => name.replace(/^public\./, '');

const main = async () => {
  const schema = await fetchSchema();
  const components = schema.components && schema.components.schemas ? schema.components.schemas : null;
  const definitions = schema.definitions ? schema.definitions : null;
  const source = components || definitions || {};
  const entries = Object.entries(source)
    .filter(([, value]) => value && value.type === 'object' && value.properties)
    .map(([name, value]) => {
      const columns = Object.keys(value.properties).sort();
      return {
        table: normalizeSchemaName(name),
        columns,
      };
    })
    .sort((a, b) => a.table.localeCompare(b.table));

  if (entries.length === 0) {
    console.log('No tables found in OpenAPI schema.');
    return;
  }

  for (const entry of entries) {
    console.log(`${entry.table}: ${entry.columns.join(', ')}`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
