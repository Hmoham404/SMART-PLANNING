import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {indexedDB} from 'fake-indexeddb';

const rows=new Map();let offline=false;
class Query {
 constructor(){this.filters=[];this.mode='read'}
 select(){return this}
 order(){return this}
 eq(k,v){this.filters.push([k,v]);return this}
 range(a,b){this.bounds=[a,b];return this}
 maybeSingle(){this.single=true;return this}
 insert(value){this.mode='insert';this.value=value;return this}
 update(value){this.mode='update';this.value=value;return this}
 upsert(values){this.mode='upsert';this.value=values;return this}
 then(resolve,reject){return Promise.resolve().then(()=>{
  if(offline)return {data:null,error:{message:'Offline',code:'NETWORK'}};
  let selected=[...rows.values()].filter(r=>this.filters.every(([k,v])=>r[k]===v));
  if(this.mode==='upsert'){for(const r of this.value)if(!rows.has(r.id))rows.set(r.id,{...structuredClone(r),revision:1});return {data:null,error:null}}
  if(this.mode==='insert'){const row={...structuredClone(this.value),revision:1};rows.set(row.id,row);selected=[row]}
  if(this.mode==='update')selected=selected.map(r=>{const updated={...r,...structuredClone(this.value),revision:r.revision+1,updated_at:new Date().toISOString()};rows.set(r.id,updated);return updated});
  if(this.bounds)selected=selected.slice(this.bounds[0],this.bounds[1]+1);
  return {data:structuredClone(this.single?selected[0]??null:selected),error:null};
 }).then(resolve,reject)}
}
globalThis.__planningCloud={from(name){assert.equal(name,'myc_records');return new Query()}};
globalThis.indexedDB=indexedDB;globalThis.window={};
const seed={meta:{},records:[{id:'order-seed',type:'order',data:{quantity:100},updated_at:'2026-11-16T00:00:00Z'},{id:'material-seed',type:'material',data:{initial_stock:30},updated_at:'2026-11-16T00:00:00Z'}]};
globalThis.fetch=async()=>({ok:true,json:async()=>structuredClone(seed)});
mkdirSync('.qa',{recursive:true});
await build({entryPoints:['src/store.js'],bundle:true,packages:'external',platform:'node',format:'esm',outfile:'.qa/cloud-store.mjs',define:{'import.meta.env.VITE_SUPABASE_URL':'"https://test.invalid"','import.meta.env.VITE_SUPABASE_ANON_KEY':'"test"'},plugins:[{name:'mock-supabase',setup(build){build.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'supabase',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClient=()=>globalThis.__planningCloud;'}))}}]});
const {useBusinessStore}=await import('../.qa/cloud-store.mjs');
let store;
function Probe(){store=useBusinessStore();return null}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await act(async()=>new Promise(r=>setTimeout(r,5)))}assert.fail('Cloud operation timed out')}

test('Cloud: initial import, additions, edits, offline recovery and conflict protection',async()=>{
 let app;await act(async()=>{app=Renderer.create(React.createElement(Probe))});await until(()=>store.ready&&!store.busy&&store.status==='Supabase connecté');
 assert.equal(rows.size,2,'seed uploads automatically');assert.equal(store.records.some(r=>r.dirty),false);
 await act(async()=>{await store.save('order',{quantity:120},'order-seed')});assert.equal(rows.get('order-seed').data.quantity,120);assert.equal(rows.get('order-seed').revision,2);
 let added;await act(async()=>{added=await store.save('entry',{produced:10,rejected:1,order_id:'order-seed'})});assert.equal(rows.get(added).data.produced,10);
 offline=true;await act(async()=>{await store.save('order',{quantity:130},'order-seed')});assert.equal(rows.get('order-seed').data.quantity,120);assert.equal(store.records.find(r=>r.id==='order-seed').dirty,true);
 offline=false;await act(async()=>{await store.sync()});assert.equal(rows.get('order-seed').data.quantity,130);assert.equal(store.records.some(r=>r.dirty),false);
 const remote=rows.get('order-seed');rows.set(remote.id,{...remote,revision:remote.revision+1,data:{quantity:150}});
 await act(async()=>{await store.save('order',{quantity:140},'order-seed')});assert.equal(rows.get('order-seed').data.quantity,150,'concurrent server change is preserved');assert.equal(store.records.find(r=>r.id==='order-seed').data.quantity,140,'local change stays recoverable');assert.equal(store.records.find(r=>r.id==='order-seed').dirty,true);
 await act(async()=>app.unmount());
});
