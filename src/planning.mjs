export function workingDates(start,end,holidays=[]){
 const first=new Date(start+'T12:00:00Z'),last=new Date(end+'T12:00:00Z');
 if(!Number.isFinite(+first)||!Number.isFinite(+last)||last<first)return [];
 if((last-first)/86400000>366)throw Error('Limitez une fabrication à 366 jours.');
 const days=[];for(let d=new Date(first);d<=last;d.setUTCDate(d.getUTCDate()+1)){let iso=d.toISOString().slice(0,10);if(d.getUTCDay()!==0&&!holidays.includes(iso))days.push(iso)}return days;
}
export function sourceLoad(operation,date,schedule){return schedule.filter(s=>s.client===operation.client&&s.date===date&&(operation.department==='Automatic assembling'?s.product==='YZA037':s.product.replaceAll(' ','')===operation.product.replaceAll(' ',''))).reduce((sum,s)=>sum+s.quantity,0)}
export function planCheck(plan,operation,plans,schedule,holidays){
 const days=workingDates(plan.start,plan.end,holidays);
 if(!days.length)return {ok:false,error:'Aucun jour ouvert dans cette période.',days:[],peak:0};
 const daily=plan.quantity/days.length;
 let peak=0;for(const date of days){let used=sourceLoad(operation,date,schedule);for(const other of plans.filter(p=>p.operation_id===operation.id)){let dates=workingDates(other.start,other.end,holidays);if(dates.includes(date))used+=other.quantity/dates.length}peak=Math.max(peak,used+daily)}
 return {ok:peak<=operation.daily_capacity,error:peak>operation.daily_capacity?'Capacité insuffisante sur au moins un jour. Réduisez la quantité, allongez la période ou ajustez les shifts.':null,days,peak,daily};
}
