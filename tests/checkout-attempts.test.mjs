import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/js/checkout.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  function selectionIdentity('),source.indexOf('  async function api'));
const selection={checkin:'2027-02-08',checkout:'2027-02-10',guests:2,adults:2,children:0,infants:0,extras:[]};
function run(current,legacy){const values=new Map([['eco_pix_attempt',JSON.stringify(legacy)]]);const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const context={sessionStorage:storage,document:{body:{dataset:{}}},capture:()=>current};vm.createContext(context);vm.runInContext('let attempt=null;'+code+';globalThis.result={attempt,key:attemptStorageKey,save};',context);return {result:context.result,values};}
test('novas datas não retomam PIX anterior e preservam a solicitação antiga',()=>{const old={id:'previous',payload:{...selection,checkin:'2027-02-01',checkout:'2027-02-03'},retry:false};const {result,values}=run(selection,old);assert.equal(result.attempt,null);assert.equal(values.size,1);assert.equal(JSON.parse([...values.values()][0]).id,'previous');assert.equal(values.has(result.key),false);});
test('mesmas datas e hóspedes retomam a chave anterior sem criar nova tentativa',()=>{const {result}=run(selection,{id:'previous',key:'same-key',payload:selection,retry:false});assert.equal(result.attempt.id,'previous');assert.equal(result.attempt.key,'same-key');});
test('mudança na quantidade de hóspedes separa a solicitação sem apagar a anterior',()=>{const {result,values}=run({...selection,guests:3,adults:3},{id:'previous',payload:selection});assert.equal(result.attempt,null);assert.equal(values.size,1);});
