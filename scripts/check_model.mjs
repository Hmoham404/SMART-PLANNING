import {readFileSync} from 'node:fs';
import {derive,grouped} from '../src/domain.mjs';
const b=JSON.parse(readFileSync('public/business-data.json','utf8')),d=derive(b.records,'2026-11-16');
console.log(JSON.stringify({orders:d.orders.length,late:d.orders.filter(o=>o.late).length,risk:d.materials.filter(x=>x.risk).length,otd:d.otd,otif:d.otif,evaluated:d.evaluated,schedules:[...new Set(grouped(b.records,'schedule').map(s=>s.client+':'+s.product))]},null,2));
