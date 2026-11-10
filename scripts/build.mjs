import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const output = path.join(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Saída inválida.');
const files = ['index.html', 'login.html', 'css/login.css', 'js/login.js', 'reservar.html', 'css/reservation.css', 'js/reservation.js', 'modelo-residencia.html', 'guia-hospede.html', 'css/photo-tour.css', 'css/guest-picker.css', 'css/booking-layout.css', 'js/checkout.js', 'js/guest-picker.js', 'js/photo-tour.js', 'js/residence-model.js', 'js/residence-viewer.js'];
const assets = Object.fromEntries(files.map(file => ['/' + file, fs.readFileSync(path.join('public', file), 'utf8')]));
assets['/'] = assets['/index.html'];
const payment = fs.readFileSync('worker/payment.mjs', 'utf8').replaceAll('export ', '');
const auth = fs.readFileSync('worker/auth.mjs', 'utf8').replace(/^import[^\n]*\n/, '').replaceAll('export ', '');
const api = fs.readFileSync('worker/api.mjs', 'utf8').replace(/^import[^\n]*\n/gm, '').replace('export async function api', 'async function api');
const worker = `${payment}\n${auth}\n${api}\nconst assets = ${JSON.stringify(assets)};
export default { async fetch(request, env) {
 const url = new URL(request.url);
 let response;
 if (url.pathname.startsWith('/api/')) response = await api(request, env);
 else if (request.method !== 'GET' && request.method !== 'HEAD') response = new Response('Método não permitido',{status:405});
 else if (url.pathname === '/healthz') response = new Response(JSON.stringify({status:'ok',paymentsEnabled:configured(env),database:!!env.DB}),{headers:{'Content-Type':'application/json'}});
 else if (!Object.hasOwn(assets,url.pathname)) response = new Response('Página não encontrada',{status:404});
 else { const type=url.pathname.endsWith('.js')?'application/javascript':url.pathname.endsWith('.css')?'text/css':'text/html'; response=new Response(request.method==='HEAD'?null:assets[url.pathname],{headers:{'Content-Type':type+'; charset=utf-8'}}); }
 const headers = new Headers(response.headers); headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('Cache-Control','no-store');
 return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}};\n`;
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'server'), { recursive: true });
fs.mkdirSync(path.join(output, '.openai'), { recursive: true });
fs.writeFileSync(path.join(output, 'server/index.js'), worker);
fs.copyFileSync('.openai/hosting.json', path.join(output, '.openai/hosting.json'));
console.log('Worker e recursos públicos gerados, sem credenciais.');
