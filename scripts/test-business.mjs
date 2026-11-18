import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {indexedDB,IDBKeyRange} from 'fake-indexeddb';
import {normalizeWorkbook,derive,dateValue,grouped,reconcileImport} from '../src/domain.mjs';
import {planCheck} from '../src/planning.mjs';
const book=JSON.parse(readFileSync('public/classeur.json','utf8')),seed=normalizeWorkbook(book);
test('Conversion des données métier sans quantités inventées',()=>{
 const d=derive(seed.records,'2026-11-16');assert.equal(d.orders.length,28);assert.equal(d.materials.length,22);assert.equal(d.operations.length,15);assert.equal(d.deliveries.length,25);
 assert.equal(d.deliveries.filter(x=>x.quantity_invalid).length,2);assert.equal(d.evaluated,8);assert.equal(d.otif,3/8);
 assert.equal(d.orders.find(o=>o.id==='order-15').reported,false);assert.equal(dateValue('W46'),'2026-11-15');assert.equal(dateValue('01-Dec-26'),'2026-12-01');assert.equal(dateValue(' 02-Mars-2027'),'2027-03-02');
 const totals=grouped(seed.records,'history');assert.equal(totals.length,42);assert(!totals.some(r=>r.client.toLowerCase()==='total'));
});
test('Production finale, opérations intermédiaires et archivage',()=>{
 const extra=(id,data)=>({id,type:'entry',data,updated_at:new Date().toISOString()});let rows=[...seed.records,extra('new1',{order_id:'order-5',scope:'Produit fini',produced:1000,rejected:10}),extra('new2',{order_id:'order-5',scope:'Opération intermédiaire',produced:3000,rejected:0})];
 let o=derive(rows,'2026-11-16').orders.find(o=>o.id==='order-5');assert.equal(o.produced,990);assert.equal(o.remaining,49010);assert.equal(o.status,'En production');rows.find(r=>r.id==='new1').data.archived=true;assert.equal(derive(rows,'2026-11-16').orders.find(o=>o.id==='order-5').produced,0);
});
test('Une réception ou consommation déjà prévue n’est pas comptée deux fois',()=>{
 let base={id:'m-test',type:'material',data:{initial_stock:100,planned_receipt:50,forecast_consumption:80,safety_stock:0}};
 let move={id:'movement-test',type:'movement',data:{material_id:'m-test',kind:'Réception',quantity:50,forecast_relation:'Déjà prévue'}};
 let d=derive([base,move],'2026-11-16').materials[0];assert.equal(d.stock,150);assert.equal(d.planned_receipt_remaining,0);assert.equal(d.forecast_end,70);
 move.data={material_id:'m-test',kind:'Consommation',quantity:20,forecast_relation:'Déjà prévue'};d=derive([base,move],'2026-11-16').materials[0];assert.equal(d.stock,80);assert.equal(d.forecast_consumption_remaining,60);assert.equal(d.forecast_end,70);
});
test('Une livraison partielle liée à une commande ne marque pas la commande expédiée',()=>{
 const o={id:'o-test',type:'order',data:{quantity:100,baseline_produced:100,status:'Confirmée'}},d={id:'d-test',type:'delivery',data:{order_id:'o-test',planned_quantity:100,planned_date:'2026-11-16',actual_date:'2026-11-16',delivered_quantity:40}};
 assert.equal(derive([o,d],'2026-11-16').orders[0].status,'Prête à livrer');d.data.delivered_quantity=100;assert.equal(derive([o,d],'2026-11-16').orders[0].status,'Expédiée');
});
test('L’import reconnaît une commande déplacée et préserve sa base de production',()=>{
 const original=seed.records.find(r=>r.id==='order-5'),incoming={...original,id:'order-90',data:{...original.data,baseline_produced:5000}},entry={id:'entry-test',type:'entry',data:{order_id:'order-5',produced:5000,rejected:0}};
 const result=reconcileImport([incoming],[original,entry]);assert.equal(result.records[0].id,'order-5');assert.equal(result.records[0].data.baseline_produced,0);assert.equal(result.preservedBaselines,1);
});
test('Le planning inclut la charge source et les fabrications superposées',()=>{
 const op={id:'op-test',client:'KIKO',product:'YZA037',department:'Automatic assembling',daily_capacity:100},plan={operation_id:'op-test',start:'2026-11-16',end:'2026-11-16',quantity:50};
 assert.equal(planCheck(plan,op,[],[{client:'KIKO',product:'YZA037',date:'2026-11-16',quantity:80}],[]).ok,false);
 assert.equal(planCheck(plan,op,[{...plan,quantity:60}],[],[]).ok,false);
 assert.equal(planCheck(plan,op,[{...plan,quantity:40}],[],[]).ok,true);
});
test('Réception matière et livraison complète mettent à jour leurs indicateurs',()=>{
 let rows=[...seed.records,{id:'m1',type:'movement',data:{material_id:'material-5',kind:'Réception',quantity:1000}}];let m=derive(rows,'2026-11-16').materials.find(m=>m.id==='material-5');assert.equal(m.stock,2512);assert.equal(m.risk,false);assert.equal(m.shortage,0);
 rows.push({id:'delivery-new',type:'delivery',data:{client:'KIKO',order_id:'order-5',planned_quantity:50000,delivered_quantity:50000,planned_date:'2026-11-16',actual_date:'2026-11-16'}});assert.equal(derive(rows,'2026-11-16').orders.find(o=>o.id==='order-5').status,'Expédiée');
});
test('Planification : jours fermés, surcharge et charge source contrôlés',()=>{
 const d=derive(seed.records,'2026-11-16'),op=d.operations.find(o=>o.id==='operation-7');let p={operation_id:op.id,start:'2026-11-16',end:'2026-11-16',quantity:1000};assert.equal(planCheck(p,op,[],[],[]).ok,true);assert.equal(planCheck({...p,quantity:1e9},op,[],[],[]).ok,false);assert.equal(planCheck({...p,start:'2026-11-15',end:'2026-11-15'},op,[],[],[]).ok,false);assert.equal(planCheck(p,op,[],[],['2026-11-16']).ok,false);
 const source=[{client:op.client,product:op.product,date:p.start,quantity:op.daily_capacity}];assert.equal(planCheck(p,op,[],source,[]).ok,false);
});
mkdirSync('.qa',{recursive:true});
await build({entryPoints:['src/App.jsx'],bundle:true,packages:'external',platform:'node',format:'esm',outfile:'.qa/App.mjs',define:{'import.meta.env.VITE_SUPABASE_URL':'""','import.meta.env.VITE_SUPABASE_ANON_KEY':'""'}});
const {default:App}=await import('../.qa/App.mjs');
globalThis.indexedDB=indexedDB;globalThis.IDBKeyRange=IDBKeyRange;globalThis.window={confirm:()=>true};globalThis.ResizeObserver=class{observe(){}disconnect(){}};globalThis.fetch=async url=>{assert.equal(url,'/business-data.json');return {ok:true,json:async()=>structuredClone(seed)}};
const mount=()=>Renderer.create(React.createElement(App),{createNodeMock:()=>({getBoundingClientRect:()=>({width:0,height:0}),addEventListener(){},removeEventListener(){}})});
const text=n=>typeof n==='string'?n:(n?.children||[]).map(text).join('');
const button=(root,label)=>{const b=root.findAllByType('button').find(b=>text(b).includes(label));assert.ok(b,'Bouton absent : '+label);return b};
const click=async(root,label)=>{await act(async()=>{await button(root,label).props.onClick()})};
const dialog=root=>root.findByProps({role:'dialog'});
const setField=async(root,label,value)=>{const l=root.findAllByType('label').find(n=>text(n).startsWith(label));assert.ok(l,'Champ absent : '+label);const input=l.findAll(n=>n.type==='input'||n.type==='select')[0];await act(async()=>input.props.onChange({target:{value:String(value)}}))};
const submit=async(root)=>{await act(async()=>{await root.findByType('form').props.onSubmit({preventDefault(){}})})};
const readLocal=()=>new Promise((resolve,reject)=>{let r=indexedDB.open('myc-planning-v3',1);r.onsuccess=()=>{let db=r.result,q=db.transaction('records').objectStore('records').getAll();q.onsuccess=()=>{db.close();resolve(q.result)};q.onerror=()=>reject(q.error)}});
const waitFor=async fn=>{for(let i=0;i<100;i++){if(fn())return;await act(async()=>new Promise(resolve=>setTimeout(resolve,10)))}assert.fail('Interface non initialisée')};
test('Parcours React : saisie, persistance, stock, livraison, capacité et planning',async()=>{
 let app;await act(async()=>{app=mount()});await waitFor(()=>text(app.root).includes('Votre production, sous contrôle.'));
 assert(!text(app.root).includes('Explorateur des feuilles'));
 const menuButton=()=>app.root.findByProps({'aria-label':'Menu'});
 assert.equal(menuButton().props['aria-expanded'],false);
 await act(async()=>menuButton().props.onClick());assert.equal(menuButton().props['aria-expanded'],true);
 await act(async()=>app.root.findByProps({'aria-label':'Fermer le menu'}).props.onClick());assert.equal(menuButton().props['aria-expanded'],false);
 await act(async()=>menuButton().props.onClick());
 await click(app.root,'Commandes clients');assert.equal(menuButton().props['aria-expanded'],false);
 assert.equal(text(app.root.findByProps({'aria-current':'page'})).includes('Commandes clients'),true);
 assert(text(app.root).includes('PO-H26-0999#1'));
 await click(app.root,'PO-H26-0999#1');assert(text(dialog(app.root)).includes('À FABRIQUER'));await click(dialog(app.root),'Déclarer une production');
 await setField(dialog(app.root),'Machine / poste','INJ-04');await setField(dialog(app.root),'Quantité prévue',1200);await setField(dialog(app.root),'Quantité produite',1000);await setField(dialog(app.root),'Rebuts',10);await submit(dialog(app.root));
 let local=await readLocal(),d=derive(local,'2026-11-16');assert.equal(d.orders.find(o=>o.id==='order-5').produced,990);assert.equal(d.orders.find(o=>o.id==='order-5').remaining,49010);
 await act(async()=>app.unmount());await act(async()=>{app=mount()});await waitFor(()=>text(app.root).includes('Votre production, sous contrôle.'));await click(app.root,'Commandes clients');await click(app.root,'PO-H26-0999#1');assert(text(dialog(app.root)).includes('990'));await click(dialog(app.root),'Fermer');
 await click(app.root,'Matières premières');await click(app.root,'Réception / consommation');await setField(dialog(app.root),'Ligne matière','material-5');await setField(dialog(app.root),'Quantité dans',1000);await submit(dialog(app.root));d=derive(await readLocal(),'2026-11-16');assert.equal(d.materials.find(m=>m.id==='material-5').risk,false);
 await click(app.root,'Livraisons');const invalid=app.root.findAllByType('tr').find(r=>text(r).includes('À corriger'));await click(invalid,'Compléter');await setField(dialog(app.root),'Quantité livrée',50000);await submit(dialog(app.root));d=derive(await readLocal(),'2026-11-16');assert.equal(d.evaluated,9);
 await click(app.root,'Capacité & équipes');await click(app.root,'Simuler / ajuster');await setField(dialog(app.root),'Shifts par jour',3);await submit(dialog(app.root));d=derive(await readLocal(),'2026-11-16');assert.equal(d.operations.find(o=>o.id==='operation-7').shifts,3);
 await click(app.root,'Planning production');await click(app.root,'Planifier');await setField(dialog(app.root),'Commande à produire','order-5');await setField(dialog(app.root),'Phase / poste','operation-7');await setField(dialog(app.root),'Quantité planifiée',1e9);await submit(dialog(app.root));assert(text(dialog(app.root)).includes('Capacité insuffisante'));await setField(dialog(app.root),'Quantité planifiée',1000);await submit(dialog(app.root));assert.equal(grouped(await readLocal(),'plan').length,1);
 for(const name of ['Réalisations','Couverture des stocks','Analyses & KPI','Points à vérifier'])await click(app.root,name);
 await act(async()=>app.unmount());
});

test('Espace MYC : ouverture, ordre du jour, notes persistantes et retour atelier',async()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 let app;await act(async()=>{app=mount()});await waitFor(()=>app.root.findAllByProps({className:'brand-meeting-link'}).length>0);
 await act(async()=>app.root.findByProps({className:'brand-meeting-link'}).props.onClick());
 assert.equal(app.root.findAllByProps({className:'meeting-room'}).length,1);
 await click(app.root,'Point suivant');assert(text(app.root).includes('Engagements clients'));
 await click(app.root,'Point suivant');assert(text(app.root).includes('Approvisionnement et charge'));
 await click(app.root,'Point suivant');
 await act(async()=>app.root.findByProps({id:'meeting-notes'}).props.onChange({target:{value:'Confirmer la livraison - Responsable atelier - vendredi'}}));
 assert.equal(memory.get('myc-meeting-notes'),'Confirmer la livraison - Responsable atelier - vendredi');
 await click(app.root,'Retour');assert.equal(app.root.findAllByProps({className:'meeting-room'}).length,0);
 await act(async()=>app.root.findByProps({className:'brand-meeting-link'}).props.onClick());
 assert.equal(app.root.findByProps({id:'meeting-notes'}).props.value,memory.get('myc-meeting-notes'));
 await click(app.root,'Point suivant');await click(app.root,'Examiner les commandes');
 assert.equal(app.root.findAllByProps({className:'meeting-room'}).length,0);
 await act(async()=>app.unmount());delete globalThis.localStorage;
});
