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

 if(key==='probas'){
  const deck=[];for(const suit of ['trèfle','pique','cœur','carreau'])for(const rank of ['7','8','9','10','Valet','Dame','Roi','As'])deck.push({suit,rank,red:suit==='cœur'||suit==='carreau'});
  const ev=t.toLowerCase();let test=null,m;
  if((m=ev.match(/tirer le ([78]) de (trèfle|pique)/)))test=c=>c.rank===m[1]&&c.suit===m[2];
  else if((m=ev.match(/tirer un ([78]) (rouge|noir)/)))test=c=>c.rank===m[1]&&c.red===(m[2]==='rouge');
  else if(ev.includes('un trèfle'))test=c=>c.suit==='trèfle';
  else if(ev.includes('un pique'))test=c=>c.suit==='pique';
  else if(ev.includes('une carte rouge'))test=c=>c.red;
  else if(ev.includes('une carte noire'))test=c=>!c.red;
  else if(ev.includes('un roi'))test=c=>c.rank==='Roi';
  else if(ev.includes('un as'))test=c=>c.rank==='As';
  else if(ev.includes('un 2 rouge')||ev.includes('un 2 noir'))test=()=>false;
  else if(ev.includes('un habillé'))test=c=>['Valet','Dame','Roi'].includes(c.rank);
  else if(ev.includes('carte à numéro'))test=c=>['7','8','9','10'].includes(c.rank);
  else if(ev.includes('rouge ou une noire'))test=()=>true;
  else if(ev.includes('rouge et une noire'))test=()=>false;
  return test?fraction(deck.filter(test).length,32):null;
 }
 if(key==='probas_composees'){
  if(t.startsWith('Dé :')){
   const ev=t.slice(5).toLowerCase();let fn=null;
   if(ev.includes('un 2 ou un 5'))fn=n=>n===2||n===5;
   else if(ev.includes('pair ou un 5'))fn=n=>n%2===0||n===5;
   else if(ev.includes('pair et supérieur à 3'))fn=n=>n%2===0&&n>3;
   else if(ev.includes('multiple de 2 ou de 3'))fn=n=>n%2===0||n%3===0;
   else if(ev.includes('multiple de 2 et de 3'))fn=n=>n%2===0&&n%3===0;
   return fn?fraction([1,2,3,4,5,6].filter(fn).length,6):null;
  }
  if(t.startsWith('Deux pièces équilibrées'))return fraction(t.includes('au moins une face')?3:1,4);
  if(t.startsWith('Deux dés :')){
   const ev=t.slice(10);let count=0,fn=null;
   if(ev.includes('deux nombres pairs'))fn=(a,b)=>a%2===0&&b%2===0;
   else if(ev.includes('sur chacun'))fn=(a,b)=>a===6&&b===6;
   else if(ev.includes('au moins un 6'))fn=(a,b)=>a===6||b===6;
   if(!fn)return null;
   for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(fn(a,b))count++;
   return fraction(count,36);
  }
  const m=t.match(/Sac : (\d+) rouges et (\d+) bleues\. Deux tirages (avec|sans) remise : (.*)/);
  if(!m)return null;
  const red=+m[1],blue=+m[2],n=red+blue,withReplacement=m[3]==='avec';
  let first,second;
  if(m[4].includes('deux rouges')){first=red;second=red-(withReplacement?0:1)}
  else if(m[4].includes('deux bleues')){first=blue;second=blue-(withReplacement?0:1)}
  else if(m[4].includes('une rouge puis une bleue')){first=red;second=blue}
  else return null;
  return fraction(first*second,n*(n-(withReplacement?0:1)));
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
if(Object.values(counts).some(c=>c.failed||c.unverified||!c.verified))process.exitCode=1;
