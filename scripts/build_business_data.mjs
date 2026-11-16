import {readFileSync,writeFileSync} from 'node:fs';
import {normalizeWorkbook} from '../src/domain.mjs';
const book=JSON.parse(readFileSync('public/classeur.json','utf8'));
const model=normalizeWorkbook(book);
writeFileSync('public/business-data.json',JSON.stringify(model));
console.log(JSON.stringify(Object.fromEntries([...new Set(model.records.map(r=>r.type))].map(t=>[t,model.records.filter(r=>r.type===t).length]))));
