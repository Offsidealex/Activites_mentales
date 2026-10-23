// Phase 6: independently solve missing entries in proportional fractions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('const MODULES ='));assert(script);
const keys=['pcx1','pcx2','pcx3'],counts={},examples={},rounds=Number(process.env.AUDIT_ROUNDS||30);
const num=s=>Number(String(s).replace(',','.').trim());
function oracle(markup){
 const fracs=[...markup.matchAll(/<span class="fr">\s*<span class="n">([\s\S]*?)<\/span>\s*<span class="d">([\s\S]*?)<\/span>\s*<\/span>/g)].map(m=>[m[1],m[2]].map(x=>x.replace(/<[^>]+>/g,'').trim()));
 if(fracs.length!==2)return null;
 const [[a,b],[c,d]]=fracs;
 const vals=[a,b,c,d].map(x=>x==='?'?null:num(x));
 if(vals.filter(x=>x===null).length!==1||vals.some(x=>x!==null&&!Number.isFinite(x)))return null;
 if(vals[0]===null)return vals[1]*vals[2]/vals[3];
 if(vals[1]===null)return vals[0]*vals[3]/vals[2];
 if(vals[2]===null)return vals[0]*vals[3]/vals[1];
 return vals[1]*vals[2]/vals[0];
}
for(let seed=1;seed<=rounds;seed++){
 let state=seed;const math=Object.create(Math);math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
 const el=()=>({children:[],dataset:{},style:{setProperty(){}},appendChild(c){this.children.push(c)}});
 const ctx=vm.createContext({Math:math,document:{createElement:el,getElementById:el}});vm.runInContext(script,ctx,{timeout:3000});
 for(const key of keys){counts[key]??={verified:0,unverified:0,failed:0};const questions=vm.runInContext('MODULES['+JSON.stringify(key)+'].gen()',ctx,{timeout:2000});
 for(const q of questions){const e=oracle(String(q.html)),a=Number(q.ans),tolerance=key==='pcx3'?0.051:key==='pcx2'?0.21:1e-8;
 const status=e===null||!Number.isFinite(e)?'unverified':Math.abs(e-a)<=tolerance?'verified':'failed';
 counts[key][status]++;if(status!=='verified'&&(examples[key]||[]).length<6)(examples[key]??=[]).push({html:q.html,ans:q.ans,expected:e,status});}
 }
}
fs.mkdirSync('audit-reports',{recursive:true});fs.writeFileSync('audit-reports/math-phase6.json',JSON.stringify({rounds,counts,examples},null,2));console.log(JSON.stringify(counts,null,2));
if(Object.values(counts).some(c=>c.failed||c.unverified||!c.verified))process.exitCode=1;
