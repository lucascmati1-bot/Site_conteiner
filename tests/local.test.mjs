import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openLocalDatabase } from '../scripts/local-db.mjs';
import { createLocalServer } from '../scripts/local-server.mjs';

const root = path.resolve(import.meta.dirname, '..');
execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { cwd: root });
const worker = (await import('../dist/server/index.js')).default;

test('banco local persiste reservas e aplica migrações somente uma vez', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ecocontainer-local-'));
  const filename = path.join(directory, 'reservas.sqlite');
  let db = openLocalDatabase(filename, path.join(root, 'drizzle'));
  try {
    await db.prepare("INSERT INTO bookings(id,access_hash,request_hash,checkin,checkout,total_cents,guest_name,guest_email,order_payload,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind('local-test', 'hash', 'hash', '2027-01-08', '2027-01-10', 1, 'Teste', 'test@example.com', '{}', 1, 2).run();
    await db.prepare('INSERT INTO night_locks(night,booking_id) VALUES (?,?)').bind('2027-01-08', 'local-test').run();
    db.close(); db = openLocalDatabase(filename, path.join(root, 'drizzle'));
    assert.equal((await db.prepare('SELECT guest_name FROM bookings WHERE id=?').bind('local-test').first()).guest_name, 'Teste');
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM _local_schema_migrations').first()).count, 2);
    await assert.rejects(db.batch([
      db.prepare('INSERT INTO request_limits(bucket,count) VALUES (?,?)').bind('rollback-test', 1),
      db.prepare('INSERT INTO night_locks(night,booking_id) VALUES (?,?)').bind('2027-01-08', 'local-test')
    ]));
    assert.equal(await db.prepare('SELECT * FROM request_limits WHERE bucket=?').bind('rollback-test').first(), null);
  } finally { db.close(); fs.rmSync(directory, { recursive: true, force: true }); }
});

test('servidor Node executa o mesmo Worker com páginas, cotação e banco local', async () => {
  const DB = openLocalDatabase(':memory:', path.join(root, 'drizzle'));
  const env = { DB, PUBLIC_BASE_URL: 'http://localhost', PAYMENTS_ENABLED: 'false' };
  const server = createLocalServer(worker, env);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`; env.PUBLIC_BASE_URL = base;
  try {
    assert.equal((await fetch(base + '/')).status, 200);
    assert.equal((await fetch(base + '/modelo-residencia.html')).status, 200);
    assert.equal((await fetch(base + '/js/residence-viewer.js')).status, 200);
    assert.equal((await fetch(base + '/.env')).status, 404);
    assert.equal((await fetch(base + '/.local/reservas.sqlite')).status, 404);
    assert.equal((await fetch(base + '/scripts/start-local.mjs')).status, 404);
    assert.deepEqual(await (await fetch(base + '/api/availability')).json(), { blockedDates: [] });
    assert.equal((await (await fetch(base + '/api/config')).json()).paymentsEnabled, false);
    const result = await fetch(base + '/api/quote', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ checkin: '2027-01-08', checkout: '2027-01-10', guests: 2, extras: [] }) });
    assert.equal(result.status, 200); assert.equal((await result.json()).total, '0.50');
    assert.equal((await fetch(base + '/api/create-payment', { method: 'POST' })).status, 503);
    assert.equal((await fetch(base + '/api/quote', { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); DB.close(); }
});
