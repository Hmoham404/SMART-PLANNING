import {readFileSync} from 'node:fs';
const env=Object.fromEntries(readFileSync('.env','utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
for(const table of ['myc_records','production_entries']){
 try{const r=await fetch(env.VITE_SUPABASE_URL+'/rest/v1/'+table+'?select=id&limit=1',{headers:{apikey:env.VITE_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(8000)});const data=await r.json();console.log(table+': HTTP '+r.status+' '+(Array.isArray(data)?data.length+' ligne témoin':data.message||'Erreur'));}catch(e){console.log(table+': '+e.message)}
}
