// Checks names/presence only. Never prints credential values.
const required = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(`Missing deployment settings: ${missing.join(', ')}`);
  process.exit(1);
}
if (!/^[a-z0-9]{20}$/.test(process.env.SUPABASE_PROJECT_REF))
  throw new Error('Invalid Supabase project reference');
console.log(
  'Deployment connection settings are present; hosted function/Vault readiness must also be verified.',
);
