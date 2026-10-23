// Independent checks for fixed-format arithmetic and measurement questions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('const MODULES ='));
assert(script);
const keys=['notif_sci','divisibilite','frac_equiv','frac_nombre','conv_long','conversions2','aires','perimetres','problemes_conv'];
const units={mm:.001,cm:.01,dm:.1,m:1,km:1000,g:.001,kg:1,mL:.001,cL:.01,dL:.1,L:1,'cm²':.0001,'dm²':.01,'m²':1,'dm³':1};
const numeric=s=>Number(s.replace(/\s/g,'').replace(',','.'));
function expected(key,q){
 const t=String(q.html).replace(/<[^>]*>/g,'').trim();
 if(key==='notif_sci'){const v=Number(q.ans);if(!Number.isFinite(v)||v===0)return null;const m=String(q.ans).match(/^([+-]?\d+(?:\.\d+)?)e([+-]?\d+)$/i);return m&&Math.abs(Number(m[1]))>=1&&Math.abs(Number(m[1]))<10?numeric(t):null;}
 if(key==='frac_equiv'){const fr=[...String(q.html).matchAll(/<span class="fr">\\s*<span class="n">(.*?)<\\/span>\\s*<span class="d">(\\d+)<\\/span>\\s*<\\/span>/g)];if(fr.length!==2)return null;const numerator=Number(fr[0][1]),denominator=Number(fr[0][2]),target=Number(fr[1][2]);return Number.isFinite(numerator)&&denominator!==0?numerator*target/denominator:null;}
 if(key==='divisibilite'){const m=t.match(/^([\d ]+) est divisible par (\d+)\s*\?/);return m?(numeric(m[1])%Number(m[2])===0?'oui':'non'):null;}
 if(key==='frac_nombre'){const names={'moitié':.5,'tiers':1/3,'quart':.25,'cinquième':.2};const m=t.match(/(?:Le|La|Les) (trois quarts|deux tiers|trois cinquièmes|moitié|tiers|quart|cinquième) de (\d+)/i);if(!m)return null;const n={'trois quarts':.75,'deux tiers':2/3,'trois cinquièmes':.6,...names}[m[1].toLowerCase()];return n*Number(m[2]);}
 if(['conv_long','conversions2','problemes_conv'].includes(key)){const m=t.match(/([\d ,]+)\s*(cm²|dm²|m²|dm³|mL|cL|dL|mm|cm|dm|km|kg|g|L|m)\b/i);const dest=t.match(/(?:→|en )\s*(mm|cm|dm|km|m|kg|g|mL|cL|dL|L|cm²|dm²|m²|dm³)\b/i);if(!m||!dest)return null;const source=m[2],target=dest[1];if(!(source in units)||!(target in units))return null;return numeric(m[1])*units[source]/units[target];}
 if(key==='perimetres'){const vals=[...t.matchAll(/(?:côté|L|l)\s*=\s*([\d,]+)/g)].map(m=>numeric(m[1]));return t.startsWith('Carré')&&vals.length===1?4*vals[0]:t.startsWith('Rectangle')&&vals.length===2?2*(vals[0]+vals[1]):null;}
 if(key==='aires'){const vals=[...t.matchAll(/(?:L|l|b|h|r)\s*=\s*([\d,]+)/g)].map(m=>numeric(m[1]));return t.startsWith('Rectangle')&&vals.length===2?vals[0]*vals[1]:t.startsWith('Triangle')&&vals.length===2?vals[0]*vals[1]/2:t.startsWith('Disque')&&vals.length===1?Math.round(Math.PI*vals[0]**2*10)/10:null;}
 return null;
}
const counts={},examples={};const rounds=Number(process.env.AUDIT_ROUNDS||30);
for(let seed=1;seed<=rounds;seed++){
 let state=seed;const math=Object.create(Math);math.random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
 const element=()=>({children:[],dataset:{},style:{setProperty(){}},appendChild(c){this.children.push(c)}});
 const ctx=vm.createContext({Math:math,document:{createElement:element,getElementById(){return element()}}});
 vm.runInContext(script,ctx,{timeout:3000});
 for(const key of keys){counts[key]??={verified:0,unverified:0,failed:0};
  const questions=vm.runInContext('MODULES['+JSON.stringify(key)+'].gen()',ctx,{timeout:2000});
  for(const q of questions){let exp=expected(key,q),actual=key==='divisibilite'?String(q.ans).toLowerCase():Number(q.ans);
   const status=exp===null?'unverified':key==='divisibilite'?exp===actual?'verified':'failed':Number.isFinite(actual)&&Math.abs(exp-actual)<1e-7*Math.max(1,Math.abs(exp))?'verified':'failed';
   counts[key][status]++;if(status!=='verified'&&(examples[key]||[]).length<3)(examples[key]??=[]).push({seed,html:q.html,answer:q.ans,expected:exp,status});
  }
 }
}
fs.mkdirSync('audit-reports',{recursive:true});fs.writeFileSync('audit-reports/math-phase3.json',JSON.stringify({rounds,counts,examples},null,2));
console.log(JSON.stringify(counts,null,2));if(Object.values(counts).some(c=>c.failed||c.unverified||!c.verified))process.exitCode=1;
