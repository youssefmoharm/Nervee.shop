// Runs only against the explicitly configured isolated integration database.
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) throw new Error('An isolated database URL is required');
const id = `concurrency-${randomUUID()}`;
function sql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', ['-X', '-At', '-v', 'ON_ERROR_STOP=1', '--dbname', dbUrl], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '',
      errors = '';
    child.stdout.on('data', chunk => {
      output += chunk;
    });
    child.stderr.on('data', chunk => {
      errors += chunk;
    });
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve(output.trim()) : reject(new Error(errors))));
    child.stdin.end(statement);
  });
}
try {
  await sql(`INSERT INTO products(id,slug,name,category,price,description,material,care)
    VALUES('${id}','${id}','Concurrency fixture','T-Shirts',650,'Fixture','Cotton','[]');
    INSERT INTO product_inventory(product_id,size,in_stock,stock_quantity) VALUES('${id}','M',true,1);`);
  const attempt =
    key => `SELECT order_id FROM place_order_with_idempotency(NULL,'${id}@example.test','Test','Buyer','01012345678','15 Test Street','Cairo','Cairo',NULL,'standard','cod',NULL,
    '[{"product_id":"${id}","size":"M","quantity":1}]','${key}');`;
  const [first, retry] = await Promise.all([sql(attempt(id)), sql(attempt(id))]);
  if (first !== retry) throw new Error('Concurrent retries returned different orders');
  const stock = await sql(
    `SELECT stock_quantity FROM product_inventory WHERE product_id='${id}' AND size='M';`,
  );
  if (stock !== '0') throw new Error(`Concurrent retry stock mismatch: ${stock}`);
  let rejected = false;
  try {
    await sql(attempt(`${id}-other`));
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('Sold-out last item accepted a second order');
  console.log('PASS: concurrent retries share one order; last-item stock is not oversold');
} finally {
  await sql(
    `DELETE FROM orders WHERE email='${id}@example.test'; DELETE FROM products WHERE id='${id}';`,
  );
}
