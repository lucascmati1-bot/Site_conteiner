import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { api } from '../worker/api.mjs';
import { cardPayment, quote, orderState, orderPayload, validSignature } from '../worker/payment.mjs';
const origin = 'https://ecocontainer-piracaia.suportecma-ti.chatgpt.site';
const input = { checkin: '2027-01-08', checkout: '2027-01-10', guests: 2, extras: [], name: 'Hóspede Teste', email: 'guest@example.com' };
function db() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync('drizzle/0000_bookings.sql','utf8'));
  sqlite.exec(readFileSync('drizzle/0001_guest_auth.sql','utf8'));
  sqlite.prepare('INSERT INTO guest_users(id,google_sub,name,email,created_at) VALUES (?,?,?,?,?)').run('test-user','google-sub-test','Teste','guest@example.com',1);
  sqlite.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(createHash('sha256').update('b'.repeat(64)).digest('hex'),'test-user',Date.now()+86400000);
  const wrap = (sql, values=[]) => ({ sql, values, bind(...args) { return wrap(sql,args); }, async first() { return sqlite.prepare(sql).get(...values) || null; }, async all() { return { results: sqlite.prepare(sql).all(...values) }; }, async run() { return sqlite.prepare(sql).run(...values); } });
  return { sqlite, prepare:wrap, async batch(statements) { sqlite.exec('BEGIN'); try { const results=statements.map(s=>sqlite.prepare(s.sql).run(...s.values)); sqlite.exec('COMMIT'); return results; } catch(e) { sqlite.exec('ROLLBACK'); throw e; } } };
}
function env() {
  const state = { calls: 0, orders:new Map(), fail:false };
  const value = { DB:db(), MP_ACCESS_TOKEN:'test-only', MP_WEBHOOK_SECRET:'test-webhook', PAYMENTS_ENABLED:'true', PUBLIC_BASE_URL:origin,
    async MP_FETCH(url, options) {
      if(options.method === 'POST') {
        state.calls++;
        const body=JSON.parse(options.body), id='ORD'+options.headers['X-Idempotency-Key'].replaceAll('-','').toUpperCase();
        const order=state.orders.get(id) || { ...body,id,country_code:'BRA',status:'action_required',status_detail:'waiting_transfer',transactions:{payments:[{amount:body.total_amount,status:'action_required',payment_method:{id:'pix',qr_code:'real-provider-code',qr_code_base64:'aGVsbG8='}}]} };
        state.orders.set(id,order);
        if(state.fail) throw new Error('Timeout after provider creation');
        return Response.json(order);
      }
      return Response.json(state.orders.get(url.split('/').at(-1)));
    }
  }; return {value,state};
}
function create(id=crypto.randomUUID(), key='a'.repeat(64), data=input, methodOrigin=origin) {return new Request(origin+'/api/create-payment',{method:'POST',headers:{Cookie:'eco_session='+'b'.repeat(64),Origin:methodOrigin,'Content-Type':'application/json','Idempotency-Key':id,Cookie:'eco_session='+'b'.repeat(64),'X-Booking-Key':key},body:JSON.stringify(data)});}

test('total temporário é cinquenta centavos, ignora total enviado e valida datas e extras', () => {
  assert.equal(quote({...input,total:99999}).totalCents,50);
  assert.equal(quote({...input,extras:['extra-cesta']}).totalCents,50);
  assert.equal(quote({...input,checkout:'2027-01-15',extras:['extra-cesta','extra-fogueira']}).totalCents,50);
  assert.equal(orderPayload('test',quote(input).totalCents,input.email).total_amount,'0.50');
  for(const data of [{...input,checkin:'2027-02-30'}, {...input,checkout:input.checkin}, {...input,guests:0}, {...input,extras:['bad']},{...input,extras:['extra-cesta','extra-cesta']}]) assert.throws(()=>quote(data));
});
test('PIX real usa preço correto e repetição não cria outra ordem', async () => {
  const {value,state}=env(), id=crypto.randomUUID();
  const first=await api(create(id),value); assert.equal(first.status,200); const body=await first.json();
  assert.equal(body.total,'0.50');assert.equal(body.pixCopiaECola,'real-provider-code');
  const second=await api(create(id),value);assert.equal(second.status,200);assert.equal(state.calls,1);
  assert.equal(value.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM night_locks').get().n,2);
});
test('reservas concorrentes não ocupam a mesma noite e a transação falha inteira', async () => {
  const {value}=env();
  const responses=await Promise.all([api(create(),value),api(create(),value)]);
  assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);
  assert.equal(value.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM bookings').get().n,1);
});
test('falha ambígua mantém datas e chave para recuperação sem nova cobrança', async () => {
  const {value,state}=env(), id=crypto.randomUUID();state.fail=true;
  assert.equal((await api(create(id),value)).status,503);
  assert.equal((await api(create(),value)).status,409);
  state.fail=false;const result=await api(create(id),value);assert.equal(result.status,200);
  assert.equal(state.orders.size,1);assert.equal((await result.json()).status,'pending');
});
test('somente situação conferida na API confirma reserva com valor exato', () => {
  const booking={id:'booking',order_id:'ORD123',total_cents:111000,status:'pending'};
  const good={id:'ORD123',external_reference:'booking',total_amount:'1110.00',total_paid_amount:'1110.00',status:'processed',status_detail:'accredited',transactions:{payments:[{amount:'1110.00',paid_amount:'1110.00',status:'processed',status_detail:'accredited',payment_method:{id:'pix'}}]}};
  assert.equal(orderState(good,booking),'approved');
  assert.equal(orderState({...good,total_paid_amount:'1.00'},booking),'review');
  assert.equal(orderState({...good,external_reference:'another'},booking),'review');
  assert.equal(orderState({...good,status:'pending'},booking),'pending');
  assert.equal(orderState({...good,status:'canceled',transactions:{payments:[]}}, {...booking,status:'approved'}),'approved');
});
test('webhook exige assinatura válida, timestamp e request id', async () => {
  const ts=String(Date.now()),id='ORDABC',rid=crypto.randomUUID(),secret='test-secret';
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`id:${id.toLowerCase()};request-id:${rid};ts:${ts};`)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const req=new Request(origin,{headers:{'x-signature':`ts=${ts},v1=${sig}`,'x-request-id':rid}});
  assert.equal(await validSignature(req,secret,id),true);
  assert.equal(await validSignature(req,'wrong',id),false);
  assert.equal(await validSignature(req,secret,id,Date.now()+600000),false);
  assert.equal(await validSignature(new Request(origin),secret,id),false);
});
test('consulta exige chave privada da reserva e origem cruzada não cria cobrança', async () => {
  const {value}=env(),id=crypto.randomUUID();await api(create(id),value);
  assert.equal((await api(new Request(origin+'/api/check-payment/'+id),value)).status,404);
  assert.equal((await api(create(crypto.randomUUID(),'a'.repeat(64),input,'https://evil.example'),value)).status,403);
  assert.equal((await api(new Request(origin+'/api/simulate-approval/'+id,{method:'POST'}),value)).status,404);
});
test('cancelamento verificado libera noites e aprovação conserva bloqueio', async () => {
  const {value,state}=env(),id=crypto.randomUUID();await api(create(id),value);
  const booking=value.DB.sqlite.prepare('SELECT * FROM bookings').get();
  state.orders.get(booking.order_id).status='canceled';
  value.DB.sqlite.prepare('UPDATE bookings SET last_checked=0').run();
  const response=await api(new Request(origin+'/api/check-payment/'+id,{headers:{Cookie:'eco_session='+'b'.repeat(64),'X-Booking-Key':'a'.repeat(64)}}),value);
  assert.equal((await response.json()).status,'canceled');
  assert.equal(value.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM night_locks').get().n,0);
});
test('cobranças permanecem desativadas sem configuração completa', async () => {
  const {value}=env();delete value.MP_WEBHOOK_SECRET;
  assert.equal((await api(create(),value)).status,503);
  assert.equal((await (await api(new Request(origin+'/api/config'),value)).json()).paymentsEnabled,false);
});
test('rejeição definitiva do provedor libera datas sem confirmar reserva', async () => {
  const {value}=env();value.MP_FETCH=async()=>Response.json({error:'bad_request'},{status:400});
  assert.equal((await api(create(),value)).status,400);
  assert.equal(value.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM night_locks').get().n,0);
});
test('webhook assinado consulta provedor, confirma e tolera repetição', async () => {
  const {value,state}=env(),id=crypto.randomUUID();await api(create(id),value);
  const booking=value.DB.sqlite.prepare('SELECT * FROM bookings').get(),order=state.orders.get(booking.order_id);
  order.status='processed';order.status_detail='accredited';order.total_paid_amount=order.total_amount;
  Object.assign(order.transactions.payments[0],{status:'processed',status_detail:'accredited',paid_amount:order.total_amount});
  const ts=String(Date.now()),rid=crypto.randomUUID();
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value.MP_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`id:${order.id.toLowerCase()};request-id:${rid};ts:${ts};`)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const send=()=>api(new Request(origin+'/api/mercadopago-webhook?data.id='+order.id,{method:'POST',headers:{'x-signature':`ts=${ts},v1=${sig}`,'x-request-id':rid}}),value);
  assert.equal((await send()).status,200);assert.equal((await send()).status,200);
  assert.equal(value.DB.sqlite.prepare('SELECT status FROM bookings').get().status,'approved');
  assert.equal(value.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM night_locks').get().n,2);
});

test('capacidade permite oito adultos e crianças e não conta bebês', () => {
  assert.equal(quote({...input, guests:8, adults:6, children:2, infants:3}).guests,8);
  for (const counts of [{guests:9,adults:7,children:2,infants:0},{guests:2,adults:0,children:2,infants:0},{guests:2,adults:2,children:1,infants:0},{guests:2,adults:2,children:0,infants:-1}]) assert.throws(() => quote({...input,...counts}));
});

test('estadia exige pelo menos duas diárias', () => {
  assert.throws(() => quote({...input, checkout:'2027-01-09'}), /mínima.*2 diárias/);
  assert.equal(quote(input).nights,2);
});

const cardInput = { type:'credit_card', id:'visa', token:'test-token-123456', installments:6, identification:{type:'CPF',number:'12345678909'} };
test('cartão usa valor do servidor e valida parcelas e documento', () => {
 const card=cardPayment(cardInput), payload=orderPayload('booking',135000,input.email,card);
 assert.equal(payload.total_amount,'1350.00');
 assert.equal(payload.transactions.payments[0].payment_method.installments,6);
 assert.equal(payload.transactions.payments[0].expiration_time,undefined);
 for(const invalid of [{...cardInput,installments:13},{...cardInput,installments:0},{...cardInput,type:'debit_card'},{...cardInput,token:''},{...cardInput,identification:{type:'CPF',number:'1'}}])assert.throws(()=>cardPayment(invalid));
});
test('cartão fica indisponível sem configuração e não cria bloqueios', async () => {
 const {value,state}=env(); const r=await api(create(undefined,undefined,{...input,card:cardInput}),value);
 assert.equal(r.status,503);assert.equal(state.calls,0);assert.equal(value.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM night_locks').get().n,0);
});
test('cartão aprovado é conferido com bandeira, parcelas e valor e é idempotente', async () => {
 const {value,state}=env();value.MP_PUBLIC_KEY='public-test-key';value.MP_CARD_ENABLED='true';
 value.MP_FETCH=async (url,options)=>{
  if(options.method==='POST') {state.calls++;const payload=JSON.parse(options.body);assert.equal(payload.total_amount,'0.50');const order={...payload,id:'ORDCARD123',country_code:'BRA',status:'processed',status_detail:'accredited',total_paid_amount:payload.total_amount};const payment=order.transactions.payments[0];payment.status='processed';payment.status_detail='accredited';payment.paid_amount=payment.amount;state.orders.set(order.id,order);return Response.json(order);}
  return Response.json(state.orders.get(url.split('/').at(-1)));
 };
 const id=crypto.randomUUID(), data={...input,total:1,card:cardInput};
 const first=await api(create(id,undefined,data),value);assert.equal(first.status,200);assert.equal((await first.json()).status,'approved');
 const second=await api(create(id,undefined,data),value);assert.equal((await second.json()).status,'approved');assert.equal(state.calls,1);
 const booking=value.DB.sqlite.prepare('SELECT * FROM bookings WHERE id=?').get(id);const order=structuredClone(state.orders.get('ORDCARD123'));order.transactions.payments[0].payment_method.installments=12;assert.equal(orderState(order,booking),'review');
});
