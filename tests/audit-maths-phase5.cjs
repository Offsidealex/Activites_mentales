// Independent probability audit, phase 5.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const page=fs.readFileSync('index.html','utf8');
const script=[...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(x=>x.includes('const MODULES ='));assert(script);
const keys=['probas_simples','probas_des','probas','probas_contraire','probas_composees'];
function gcd(a,b){return b?gcd(b,a%b):a}
function fraction(n,d){const g=gcd(n,d);return [n/g,d/g]}
function oracle(key,t){
 if(key==='probas_contraire'){const m=t.match(/P\(A\) = (\d+)\/(\d+)/);return m?fraction(+m[2]- +m[1],+m[2]):null}
 if(key==='probas_simples'){
 const m=t.match(/(?:Sac|Urne) : (.*?)\. Tirer une (\w+)/);if(!m)return null;
 const groups=[...m[1].matchAll(/(\d+) (rouges?|bleues?|vertes?|jaunes?|noires?|blanches?)/g)];
 const target=m[2].slice(0,3);const total=groups.reduce((a,g)=>a+ +g[1],0);
 const good=groups.filter(g=>g[2].startsWith(target)).reduce((a,g)=>a+ +g[1],0);
 return total?fraction(good,total):null;
 }
 if(key==='probas_des'){
 if(t.startsWith('1 dé :')){
 const ev=t.slice(7);let fn=null;
 if(/obtenir un [367]$/.test(ev)){const v=+ev.slice(-1);fn=n=>n===v}
 else if(ev.includes('nombre pair'))fn=n=>n%2===0;
 else if(ev.includes('nombre impair'))fn=n=>n%2!==0;
 else if(ev.includes('multiple de 3'))fn=n=>n%3===0;
 else if(ev.includes('multiple de 2'))fn=n=>n%2===0;
 else if(ev.includes('&gt; 4'))fn=n=>n>4;
 else if(ev.includes('≥ 5'))fn=n=>n>=5;
 else if(ev.includes('&lt; 3'))fn=n=>n<3;
 else if(ev.includes('entre 1 et 6'))fn=n=>true;
 return fn?fraction([1,2,3,4,5,6].filter(fn).length,6):null;
 }
 if(t.startsWith('2 dés :')){
 const ev=t.slice(8),m=ev.match(/somme = (\d+)/);
 const fn=m?([a,b])=>a+b===+m[1]:ev.includes('double 6')?([a,b])=>a===6&&b===6:ev.includes('un double')?([a,b])=>a===b:ev.includes('au moins un 6')?([a,b])=>a===6||b===6:null;
 if(!fn)return null;let count=0;for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(fn([a,b]))count++;
 return fraction(count,36);
 }
 }
 if(key==='probas_contraire')return null;
 return null;
}
const counts={},examples={},rounds=Number(process.env.AUDIT_ROUNDS||30);
for(let seed=1;seed<=rounds;seed++){
 let state=seed;const math=Object.create(Math);math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
 const el=()=>({children:[],dataset:{},style:{setProperty(){}},appendChild(x){this.children.push(x)}});
 const ctx=vm.createContext({Math:math,document:{createElement:el,getElementById:el}});
 vm.runInContext(script,ctx,{timeout:3000});
 for(const key of keys){counts[key]??={verified:0,unverified:0,failed:0};
 const questions=vm.runInContext('MODULES['+JSON.stringify(key)+'].gen()',ctx,{timeout:2000});
 for(const q of questions){const e=oracle(key,String(q.html)),a=q.ans;
 const status=!e?'unverified':e[0]*a.d===a.n*e[1]?'verified':'failed';
 counts[key][status]++;if(status!=='verified'&&(examples[key]||[]).length<4)(examples[key]??=[]).push({html:q.html,ans:a,expected:e,status});
 }}
}
fs.mkdirSync('audit-reports',{recursive:true});fs.writeFileSync('audit-reports/math-phase5.json',JSON.stringify({rounds,counts,examples},null,2));console.log(JSON.stringify(counts,null,2));
if(Object.values(counts).some(c=>c.failed||c.unverified))process.exitCode=1;
