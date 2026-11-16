import json,openpyxl,datetime
b=json.load(open('public/classeur.json',encoding='utf8'));w=openpyxl.load_workbook('Planning de Production 11112026.xlsx',read_only=True,data_only=True)
assert len(w.sheetnames)==len(b['sheets'])==18
count=0
for s,src in zip(b['sheets'],w):
 assert s['name']==src.title
 lookup={r['row']:r for r in s['rows']}
 for rn,vs in enumerate(src.iter_rows(values_only=True),1):
  if rn not in lookup: continue
  for i,x in enumerate(lookup[rn]['values']):
   v=vs[i]
   if isinstance(v,(datetime.datetime,datetime.date,datetime.time)):v=v.isoformat()
   assert x==v,(s['name'],rn,i,x,v)
   count+=1
print('OK:',count,'valeurs verifiees dans 18 feuilles')
