import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { openLocalDatabase } from './local-db.mjs';
import { createLocalServer } from './local-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Instale Node.js 24 ou superior para usar o servidor local.'); process.exit(1);
}
const envFile = path.join(root, '.env');
if (!fs.existsSync(envFile)) fs.copyFileSync(path.join(root, '.env.example'), envFile);
const config = { ...parseEnv(fs.readFileSync(envFile, 'utf8')), ...process.env };
const port = Number(config.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida no .env.');
const base = new URL(config.PUBLIC_BASE_URL || `http://localhost:${port}`);
if (base.origin !== base.href.replace(/\/$/, '') || base.username || base.password || !['http:', 'https:'].includes(base.protocol)) throw new Error('PUBLIC_BASE_URL deve conter apenas a origem do site, sem caminho ou credenciais.');
execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { cwd: root, stdio: 'inherit' });
const worker = (await import(pathToFileURL(path.join(root, 'dist/server/index.js')).href)).default;
const DB = openLocalDatabase(path.join(root, '.local', 'reservas.sqlite'), path.join(root, 'drizzle'));
const env = {
  GOOGLE_CLIENT_ID: config.GOOGLE_CLIENT_ID || '', GOOGLE_CLIENT_SECRET: config.GOOGLE_CLIENT_SECRET || '',
  DB, PUBLIC_BASE_URL: base.origin, MP_PUBLIC_KEY: config.MP_PUBLIC_KEY || '', MP_CARD_ENABLED: config.MP_CARD_ENABLED || 'false',
  MP_ACCESS_TOKEN: config.MP_ACCESS_TOKEN || '', MP_WEBHOOK_SECRET: config.MP_WEBHOOK_SECRET || '',
  PAYMENTS_ENABLED: config.PAYMENTS_ENABLED === 'true' ? 'true' : 'false'
};
const server = createLocalServer(worker, env);
server.on('error', error => {
  DB.close();
  console.error(error.code === 'EADDRINUSE' ? `A porta ${port} já está em uso. Pare o outro servidor ou ajuste PORT e PUBLIC_BASE_URL no .env.` : 'Não foi possível iniciar o servidor local.');
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`\nAplicação local: http://localhost:${port}`);
  console.log(`Modelo 3D: http://localhost:${port}/modelo-residencia.html`);
  console.log('Reservas locais: .local/reservas.sqlite (separadas da hospedagem).');
  console.log(env.PAYMENTS_ENABLED === 'true' ? 'Pagamentos habilitados com as credenciais locais. Verifique o ambiente da conta antes de gerar PIX.' : 'Pagamentos desativados. Para testar, configure credenciais de teste no .env.');
  console.log('Pressione Ctrl+C para encerrar.\n');
});
let closing = false;
function close() { if (closing) return; closing = true; server.close(() => { DB.close(); process.exit(0); }); }
process.on('SIGINT', close); process.on('SIGTERM', close);
