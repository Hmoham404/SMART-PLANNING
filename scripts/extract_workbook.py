import openpyxl, json, datetime, math, pathlib
p=pathlib.Path('Planning de Production 11112026.xlsx')
v=openpyxl.load_workbook(p,read_only=True,data_only=True)
f=openpyxl.load_workbook(p,read_only=True,data_only=False)
def val(x):
 if isinstance(x,(datetime.datetime,datetime.date,datetime.time)): return x.isoformat()
 if isinstance(x,float) and not math.isfinite(x): return str(x)
 return x
sheets=[]; records=[]; errors=0; formulas=0
for vs,fs in zip(v,f):
 rows=[]
 for rn,(vr,fr) in enumerate(zip(vs.iter_rows(values_only=True),fs.iter_rows(values_only=True)),1):
  values=[val(x) for x in vr]; forms={str(i):x for i,x in enumerate(fr) if isinstance(x,str) and x.startswith('=')}
  while values and values[-1] is None: values.pop()
  if not values and not forms: continue
  errors+=sum(isinstance(x,str) and x in ('#REF!','#VALUE!','#DIV/0!','#N/A','#NAME?','#NUM!','#NULL!') for x in values); formulas+=len(forms)
  row={'row':rn,'values':values,'formulas':forms}; rows.append(row);records.append((vs.title,rn,values,forms))
 sheets.append({'name':vs.title,'columns':vs.max_column,'rows':rows})
out={'source':p.name,'sheets':sheets,'stats':{'sheets':len(sheets),'rows':len(records),'formulas':formulas,'errors':errors}}
pathlib.Path('public/classeur.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def lit(s):return "'"+s.replace("'","''")+"'"
with open('supabase/classeur.sql','w',encoding='utf-8') as o:
 o.write('-- Données du classeur : valeurs calculées et formules d’origine. Exécuter après schema.sql.\n')
 o.write('create table if not exists public.workbook_rows (sheet_name text not null, row_number integer not null, cells jsonb not null, formulas jsonb not null default \'{}\'::jsonb, updated_at timestamptz not null default now(), primary key(sheet_name,row_number));\nalter table public.workbook_rows enable row level security;\ngrant select, insert, update, delete on public.workbook_rows to anon, authenticated;\ndrop policy if exists "myc_workbook_access" on public.workbook_rows;\ncreate policy "myc_workbook_access" on public.workbook_rows for all to anon, authenticated using (true) with check (true);\n')
 for i in range(0,len(records),100):
  part=records[i:i+100];o.write('insert into public.workbook_rows(sheet_name,row_number,cells,formulas) values\n')
  o.write(',\n'.join('('+lit(s)+','+str(n)+','+lit(json.dumps(a,ensure_ascii=False,separators=(',',':')))+'::jsonb,'+lit(json.dumps(b,ensure_ascii=False,separators=(',',':')))+'::jsonb)' for s,n,a,b in part))
  o.write('\non conflict (sheet_name,row_number) do nothing;\n')
print(json.dumps(out['stats']))
