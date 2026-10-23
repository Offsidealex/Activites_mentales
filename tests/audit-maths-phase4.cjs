// Independent phase-4 mathematical checks for proportionality and percentages.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('const MODULES ='));assert(script);
const keys=['tableau_prop1','tableau_prop2','tableau_prop3','pourcentages','pct_simples','pct_arrondi','pct_variation'];
const num=s=>Number(String(s).replace(/\s/g,'').replace(',','.'));
function expected(key,q){
 const t=String(q.html).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 if(key.startsWith('tableau_prop')){
  const rows=[...String(q.html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(c=>c[1].replace(/<[^>]*>/g,'').trim()));
  if(rows.length!==2||rows.some(r=>r.length!==3))return null;
  const a=num(rows[0][1]),b=num(rows[0][2]),c=num(rows[1][1]);
  if(rows[1][2]!=='?'||![a,b,c].every(Number.isFinite)||a===0)return null;
  return b*c/a;
 }
 if(key==='pourcentages'){const m=t.match(/([\d\s,.]+)\s*(?:\S+\s+)?sur\s+([\d\s,.]+)/i);return m?Math.round(num(m[1])/num(m[2])*100):null;}
 if(key==='pct_simples'){const m=t.match(/([\d,.]+)\s*%\s*de\s*([\d\s,.]+)/i);return m?num(m[1])*num(m[2])/100:null;}
 if(key==='pct_variation'){const m=t.match(/([\d\s,.]+)\s*\S+\s*(augmenté|diminué)\s*de\s*([\d,.]+)\s*%/i);return m?num(m[1])*(m[2].toLowerCase()==='augmenté'?1+num(m[3])/100:1-num(m[3])/100):null;}
 if(key==='pct_arrondi'){const m=t.match(/([\d\s,.]+)\s+par rapport à\s+([\d\s,.]+)/i);return m?Math.round(num(m[1])/num(m[2])*10000)/100:null;}
 return null;
}
const rounds=Number(process.env.AUDIT_ROUNDS||30),counts={},examples={};
for(let seed=1;seed<=rounds;seed++){
 let state=seed;const math=Object.create(Math);math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
 const element=()=>({children:[],dataset:{},style:{setProperty(){}},appendChild(c){this.children.push(c)}});
 const ctx=vm.createContext({Math:math,document:{createElement:element,getElementById(){return element()}}});
 vm.runInContext(script,ctx,{timeout:3000});
 for(const key of keys){counts[key]??={verified:0,unverified:0,failed:0};
  const questions=vm.runInContext('MODULES['+JSON.stringify(key)+'].gen()',ctx,{timeout:2000});
  for(const q of questions){const e=expected(key,q),a=Number(q.ans);
   const status=e===null||!Number.isFinite(e)?'unverified':Math.abs(e-a)<=0.011?'verified':'failed';
   counts[key][status]++;if(status!=='verified'&&(examples[key]||[]).length<5)(examples[key]??=[]).push({seed,html:q.html,answer:q.ans,expected:e,status});
  }
 }
}
fs.mkdirSync('audit-reports',{recursive:true});fs.writeFileSync('audit-reports/math-phase4.json',JSON.stringify({rounds,counts,examples},null,2));
console.log(JSON.stringify(counts,null,2));if(Object.values(counts).some(c=>c.failed||c.unverified||!c.verified))process.exitCode=1;
