// Phase 7: independent geometry, square roots and symbolic algebra checks.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('const MODULES ='));assert(script);
const keys=['factoriser','pyth_cote','geo_perimetre','geo_aire','geo_angles','geo_echelle','expressions','reductions','dev_simple','dev_double','carre','racine','pyth_verif','pyth_hyp','angles'];
const rounds=Number(process.env.AUDIT_ROUNDS||30),counts={},examples={};
const num=s=>Number(String(s).replace(/\s/g,'').replace(',','.'));
const clean=s=>String(s).replace(/<span class="fr">\s*<span class="n">([\s\S]*?)<\/span>\s*<span class="d">([\s\S]*?)<\/span>\s*<\/span>/g,'(($1)/($2))').replace(/<[^>]*>/g,'').replace(/[−–]/g,'-').replace(/²/g,'^2').replace(/³/g,'^3').replace(/×/g,'*').replace(/(\d),(?=\d)/g,'$1.');
function evaluate(src,vars={}){
 const s=clean(src).replace(/\s/g,'');let i=0;
 function atom(){
  if(s[i]==='('){i++;const v=expr();if(s[i++]!==')')throw Error('parenthesis');return v;}
  const m=s.slice(i).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
  if(m){i+=m[0].length;return Number(m[0]);}
  if(/[a-z]/i.test(s[i]||'')){const k=s[i++];if(!(k in vars))throw Error('unknown variable '+k);return vars[k];}
  throw Error('atom at '+s.slice(i));
 }
 function power(){let v=atom();if(s[i]==='^'){i++;v**=unary();}return v;}
 function unary(){if(s[i]==='+'){i++;return unary();}if(s[i]==='-'){i++;return -unary();}return power();}
 function term(){let v=unary();while(i<s.length){const c=s[i];if(c==='*'||c==='/'){i++;const rhs=unary();v=c==='*'?v*rhs:v/rhs;}else if(c==='('||/[a-z]/i.test(c)||/\d/.test(c)){v*=unary();}else break;}return v;}
 function expr(){let v=term();while(s[i]==='+'||s[i]==='-'){const c=s[i++],rhs=term();v+=c==='+'?rhs:-rhs;}return v;}
 const value=expr();if(i!==s.length||!Number.isFinite(value))throw Error('unparsed '+s.slice(i));return value;
}
function oracle(key,q){
 const t=clean(q.html);
 let m;
 if(key==='factoriser'||key==='reductions'||key==='dev_simple'||key==='dev_double'){
  const source=t.replace(/^Factoriser\s*:\s*/i,'');
  const answer=String(q.ans);
  if(key==='factoriser'&&!/\([^)]*\)/.test(answer))return {status:'failed',expected:'factorised form'};
  for(const x of [-3,-1,0,2,5])for(const b of [-2,1,4]){
   if(Math.abs(evaluate(source,{x,b})-evaluate(answer,{x,b}))>1e-7)return {status:'failed',expected:'equivalent polynomial'};
  }
  return {status:'verified'};
 }
 if(key==='expressions'){
  m=t.match(/^a\s*=\s*(-?\d+)(?:\s*,\s*b\s*=\s*(-?\d+))?\s*→\s*(.+)$/);
  if(!m)return null;
  return evaluate(m[3],{a:num(m[1]),...(m[2]===undefined?{}:{b:num(m[2])})});
 }
 if(key==='geo_perimetre'){m=t.match(/Rectangle\s*:\s*longueur\s*(\d+)\s*cm,\s*largeur\s*(\d+)\s*cm/i);return m?2*(num(m[1])+num(m[2])):null;}
 if(key==='geo_aire'){m=t.match(/Triangle\s*:\s*base\s*(\d+)\s*cm,\s*hauteur\s*(\d+)\s*cm/i);return m?num(m[1])*num(m[2])/2:null;}
 if(key==='geo_angles'){m=t.match(/Angle (complémentaire|supplémentaire) de (\d+)°/i);return m?(m[1]==='complémentaire'?90:180)-num(m[2]):null;}
 if(key==='geo_echelle'){m=t.match(/segment de (\d+) cm.*coefficient (\d+)/i);return m?num(m[1])*num(m[2]):null;}
 if(key==='angles'){m=t.match(/Angles\s*:\s*(\d+)°\s*et\s*(\d+)°/i);return m?180-num(m[1])-num(m[2]):null;}
 if(key==='carre'){m=t.match(/^([\d.,]+)\^2$/);return m?num(m[1])**2:null;}
 if(key==='racine'){m=t.match(/^√([\d.,]+)$/);return m?Math.round(Math.sqrt(num(m[1]))*10)/10:null;}
 if(key==='pyth_cote'){m=t.match(/hypoténuse\s*(\d+)\s*cm,\s*un côté\s*(\d+)\s*cm/i);return m?Math.sqrt(num(m[1])**2-num(m[2])**2):null;}
 if(key==='pyth_hyp'){m=t.match(/AB\s*=\s*(\d+),\s*AC\s*=\s*(\d+)/);return m?Math.round(Math.hypot(num(m[1]),num(m[2]))*10)/10:null;}
 if(key==='pyth_verif'){m=t.match(/AB\s*=\s*(\d+),\s*AC\s*=\s*(\d+),\s*BC\s*=\s*(\d+)/);return m?(num(m[1])**2+num(m[2])**2===num(m[3])**2?'oui':'non'):null;}
 return null;
}
for(let seed=1;seed<=rounds;seed++){
 let state=seed;const math=Object.create(Math);math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
 const el=()=>({children:[],dataset:{},style:{setProperty(){}},appendChild(c){this.children.push(c)}});
 const ctx=vm.createContext({Math:math,document:{createElement:el,getElementById:el}});vm.runInContext(script,ctx,{timeout:3000});
 for(const key of keys){counts[key]??={verified:0,unverified:0,failed:0};const questions=vm.runInContext('MODULES['+JSON.stringify(key)+'].gen()',ctx,{timeout:2000});
  for(const q of questions){let expected=null,status;
   try{expected=oracle(key,q);
    if(expected&&typeof expected==='object'&&expected.status){status=expected.status;}
    else if(expected===null||!Number.isFinite(Number(expected))&&typeof expected!=='string')status='unverified';
    else if(typeof expected==='string')status=String(q.ans).toLowerCase()===expected?'verified':'failed';
    else status=Number.isFinite(Number(q.ans))&&Math.abs(Number(q.ans)-expected)<1e-7*Math.max(1,Math.abs(expected))?'verified':'failed';
   }catch(e){status='unverified';expected=String(e.message);}
   counts[key][status]++;if(status!=='verified'&&(examples[key]||[]).length<6)(examples[key]??=[]).push({seed,html:q.html,ans:q.ans,expected,status});
  }
 }
}
fs.mkdirSync('audit-reports',{recursive:true});fs.writeFileSync('audit-reports/math-phase7.json',JSON.stringify({rounds,counts,examples},null,2));
console.log(JSON.stringify(counts,null,2));if(Object.values(counts).some(c=>c.failed||c.unverified||!c.verified))process.exitCode=1;
