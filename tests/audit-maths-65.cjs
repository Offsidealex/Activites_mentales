// Audit de couverture et de génération. Une question non reconnue reste NON VÉRIFIÉE.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.includes('const MODULES ='));
assert.equal(scripts.length,1);
const rounds=Number(process.env.AUDIT_ROUNDS||30);
const target=Number(process.env.AUDIT_TARGET||65);
const result={target,rounds,modules:[],totals:{generated:0,verified:0,unverified:0,failed:0}};
function check(q){
  const statement=String(q.html||'').replace(/<[^>]*>/g,'').replace(/&times;/g,'×').replace(/&minus;/g,'−').trim();
  const answer=Number(q.ans);
  if(!Number.isFinite(answer))return {status:'unverified',reason:'Réponse non numérique ou format inconnu'};
  const normalized=statement.replace(/,/g,'.').replace(/−/g,'-').replace(/\s+/g,'');
  const simple=normalized.match(/^(-?\d+(?:\.\d+)?)([+×*÷/−-])(-?\d+(?:\.\d+)?)=?$/);
  if(simple){
    const a=Number(simple[1]),b=Number(simple[3]),op=simple[2];
    const expected=op==='+'?a+b:op==='-'?a-b:op==='×'||op==='*'?a*b:b===0?NaN:a/b;
    if(!Number.isFinite(expected))return {status:'failed',reason:'Opération non définie'};
    return Math.abs(answer-expected)<=1e-8*Math.max(1,Math.abs(expected))?{status:'verified'}:{status:'failed',reason:`Attendu ${expected}, fourni ${answer}`};
  }
  const linear=normalized.match(/^(-?\d+(?:\.\d+)?)x\+(-?\d+(?:\.\d+)?)=(-?\d+(?:\.\d+)?)$/);
  if(linear){
    const [,a,b,c]=linear.map(Number);
    return Math.abs(a*answer+b-c)<1e-7?{status:'verified'}:{status:'failed',reason:'Équation non satisfaite'};
  }
  return {status:'unverified',reason:'Aucun oracle indépendant pour ce format'};
}
for(let round=0;round<rounds;round++){
 const seed=round+1;const math=Object.create(Math);let state=seed;
 math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 const el=()=>({children:[],dataset:{},style:{setProperty(){}},appendChild(c){this.children.push(c)}});
 const ctx=vm.createContext({Math:math,document:{createElement:el,getElementById(){return el()}}});
 vm.runInContext(scripts[0],ctx,{timeout:3000});
 const keys=Array.from(vm.runInContext('Object.keys(MODULES)',ctx));
 if(round===0){for(const key of keys){const info=JSON.parse(vm.runInContext(`JSON.stringify({title:MODULES[${JSON.stringify(key)}].title,group:MODULES[${JSON.stringify(key)}].group})`,ctx));result.modules.push({key,...info,generated:0,verified:0,unverified:0,failed:0,examples:[]})}}
 assert.deepEqual(keys,result.modules.map(m=>m.key),'Le catalogue a changé entre les tirages');
 for(const mod of result.modules){
  try{
   const questions=vm.runInContext(`MODULES[${JSON.stringify(mod.key)}].gen()`,ctx,{timeout:2000});
   if(!Array.isArray(questions)||questions.length===0)throw Error('Aucune question générée');
   for(const q of questions){
    mod.generated++;result.totals.generated++;
    const verdict=check(q);
    mod[verdict.status]++;result.totals[verdict.status]++;
    if(verdict.status!=='verified'&&mod.examples.length<3)mod.examples.push({seed,question:String(q.html||'').slice(0,250),answer:q.ans,reason:verdict.reason});
   }
  }catch(e){mod.failed++;result.totals.failed++;if(mod.examples.length<3)mod.examples.push({seed,error:String(e)})}
 }
}
result.catalogueCount=result.modules.length;
result.fullyVerified=result.modules.filter(m=>m.generated>0&&m.unverified===0&&m.failed===0).length;
result.notFullyVerified=result.modules.filter(m=>m.generated===0||m.unverified>0||m.failed>0).map(m=>m.key);
fs.mkdirSync('audit-reports',{recursive:true});
fs.writeFileSync('audit-reports/math-audit.json',JSON.stringify(result,null,2));
fs.writeFileSync('audit-reports/math-audit.md',`# Audit mathématique — état de couverture\n\nCatalogue : ${result.catalogueCount} / cible ${target}. Modules entièrement vérifiés par cet oracle : ${result.fullyVerified}.\n\nQuestions : ${JSON.stringify(result.totals)}\n\n⚠️ Les questions non reconnues ne sont jamais comptées comme vérifiées.\n\n| Module | Générées | Vérifiées | Non vérifiées | Erreurs |\n|---|---:|---:|---:|---:|\n`+result.modules.map(m=>`| ${m.key} | ${m.generated} | ${m.verified} | ${m.unverified} | ${m.failed} |`).join('\n')+'\n');
console.log(JSON.stringify({catalogueCount:result.catalogueCount,fullyVerified:result.fullyVerified,totals:result.totals,notFullyVerified:result.notFullyVerified},null,2));
if(result.catalogueCount!==target||result.totals.failed||result.fullyVerified!==target)process.exitCode=1;
