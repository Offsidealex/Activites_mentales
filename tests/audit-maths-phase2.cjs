// Oracles independants : jamais de reutilisation de q.ans pour calculer l'attendu.
// Execution : node tests/audit-maths-phase2.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.includes('const MODULES ='));
assert.equal(scripts.length,1);
function calculate(source){
 const s=source.replace(/,/g,'.').replace(/[−–]/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/\s+/g,'');
 if(!/^[0-9x+\-*/().]+$/.test(s))return null;
 const expression=s.replace(/(\d|\))x/g,'$1*x').replace(/x/g,'X');
 if(!/^[0-9X+\-*/().]+$/.test(expression))return null;
 return expression;
}
function evalExpr(expression,x){
 const code=calculate(expression);
 if(!code)return null;
 const value=vm.runInNewContext(code,{X:x},{timeout:100});
 return typeof value==='number'&&Number.isFinite(value)?value:null;
}
function rational(n,d){if(!Number.isInteger(n)||!Number.isInteger(d)||!d)return null;return n/d}
function fractionParts(html){
 return [...html.matchAll(/<span class="fr">\s*<span class="n">(\d+)<\/span>\s*<span class="d">(\d+)<\/span>\s*<\/span>/g)]
 .map(m=>[Number(m[1]),Number(m[2])]);
}
function check(key,q){
 const text=String(q.html||'').replace(/<br\s*\/?>/gi,';').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();
 const ans=typeof q.ans==='number'?q.ans:Number(q.ans);
 let expected=null;
 if(['add_rel','mult_rel','sub_rel','chaine_rel','mix_rel'].includes(key)){
  expected=evalExpr(text);
 }else if(['etendue','moyenne','mediane'].includes(key)){
  const values=(text.match(/-?\d+(?:[.,]\d+)?/g)||[]).map(x=>Number(x.replace(',','.')));
  if(values.length){const sorted=values.slice().sort((a,b)=>a-b);
   expected=key==='etendue'?sorted.at(-1)-sorted[0]:key==='moyenne'?values.reduce((a,b)=>a+b,0)/values.length:
   (sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2;
  }
 }else if(key==='effectif_total'){
  const m=text.match(/Effectifs\s*:\s*([\d\s|]+)/i);
  if(m)expected=(m[1].match(/\d+/g)||[]).reduce((a,b)=>a+Number(b),0);
 }else if(key==='moyenne_effectifs'){
  const a=text.match(/(?:Valeurs|Notes)\s*:\s*([\d\s|]+)/i),b=text.match(/Effectifs\s*:\s*([\d\s|]+)/i);
  if(a&&b){const v=a[1].match(/\d+/g).map(Number),n=b[1].match(/\d+/g).map(Number);
   if(v.length===n.length&&n.reduce((x,y)=>x+y,0)>0)expected=v.reduce((s,x,i)=>s+x*n[i],0)/n.reduce((s,x)=>s+x,0);
  }
 }else if(['add_frac','mult_frac','arrondir'].includes(key)){
  const f=fractionParts(q.html||'');
  if(key==='arrondir'&&f.length===1)expected=rational(...f[0]);
  if(key==='add_frac'&&f.length===2)expected=rational(...f[0])+rational(...f[1]);
  if(key==='mult_frac'&&f.length===2)expected=rational(...f[0])*rational(...f[1]);
 }else if(/^eq_niv\d+$/.test(key)){
  const sides=text.split('=');
  if(sides.length===2&&Number.isFinite(ans)){
   const left=evalExpr(sides[0],ans),right=evalExpr(sides[1],ans);
   if(left!==null&&right!==null)expected=right===null?null:left-right;
   if(expected!==null)return {status:Math.abs(expected)<1e-6?'verified':'failed',expected:0,actual:expected};
  }
 }
 if(expected===null||!Number.isFinite(expected))return {status:'unverified'};
 const actual=q.ans&&typeof q.ans==='object'&&Number.isFinite(Number(q.ans.n))&&Number.isFinite(Number(q.ans.d))
  ?rational(Number(q.ans.n),Number(q.ans.d)):ans;
 if(!Number.isFinite(actual))return {status:'unverified'};
 // Tolérance volontaire pour exercices à réponses arrondies (2 décimales ou dixième).
 const roundedExpected=key==='arrondir'?Math.round(expected*10)/10:expected;
 const tolerance=key==='arrondir'?0.001:0.011;
 return {status:Math.abs(roundedExpected-actual)<=tolerance?'verified':'failed',expected:roundedExpected,actual};
}
const counts={},examples={};const rounds=Number(process.env.AUDIT_ROUNDS??30);
if(!Number.isSafeInteger(rounds)||rounds<1||rounds>1000)throw Error('AUDIT_ROUNDS doit etre un entier entre 1 et 1000');
for(let seed=1;seed<=rounds;seed++){
 let state=seed;const math=Object.create(Math);math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
 const element=()=>({children:[],dataset:{},style:{setProperty(){}},appendChild(c){this.children.push(c)}});
 const context=vm.createContext({Math:math,document:{createElement:element,getElementById(){return element()}}});
 vm.runInContext(scripts[0],context,{timeout:3000});
 const keys=Array.from(vm.runInContext('Object.keys(MODULES)',context));
 for(const key of keys){
  if(!(['add_rel','mult_rel','sub_rel','chaine_rel','mix_rel','etendue','moyenne','mediane','effectif_total','moyenne_effectifs','add_frac','mult_frac','arrondir'].includes(key)||/^eq_niv\d+$/.test(key)))continue;
  counts[key]??={verified:0,unverified:0,failed:0};
  let questions;
  try{questions=vm.runInContext('MODULES['+JSON.stringify(key)+'].gen()',context,{timeout:2000})}
  catch(e){counts[key].failed++;(examples[key]??=[]).push({seed,error:String(e)});continue}
  for(const q of questions){
   let result;try{result=check(key,q)}catch(e){result={status:'failed',error:String(e)}}
   counts[key][result.status]++;
   if(result.status!=='verified'&&(examples[key]||[]).length<3)(examples[key]??=[]).push({seed,question:q.html,answer:q.ans,...result});
  }
 }
}
const report={rounds,counts,examples};
fs.mkdirSync('audit-reports',{recursive:true});
fs.writeFileSync('audit-reports/math-phase2.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(counts,null,2));
if(Object.values(counts).some(c=>c.failed>0))process.exitCode=1;
