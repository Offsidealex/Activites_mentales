const fs=require('node:fs');
const a=JSON.parse(fs.readFileSync('audit-reports/math-audit.json'));
const p=JSON.parse(fs.readFileSync('audit-reports/math-phase2.json'));
const t=JSON.parse(fs.readFileSync('audit-reports/math-phase3.json'));
const u=JSON.parse(fs.readFileSync('audit-reports/math-phase4.json'));
const v5=JSON.parse(fs.readFileSync('audit-reports/math-phase5.json'));
const v6=JSON.parse(fs.readFileSync('audit-reports/math-phase6.json'));
const v7=JSON.parse(fs.readFileSync('audit-reports/math-phase7.json'));
const keys=new Set(a.modules.map(m=>m.key));
const unknown=[...Object.keys(p.counts),...Object.keys(t.counts),...Object.keys(u.counts),...Object.keys(v5.counts),...Object.keys(v6.counts),...Object.keys(v7.counts)].filter(k=>!keys.has(k));
const modules=a.modules.map(m=>{
 const q=p.counts[m.key],r=t.counts[m.key],v=u.counts[m.key],w=v5.counts[m.key],z=v6.counts[m.key],s=v7.counts[m.key];
 const initial=m.generated>0&&m.unverified===0&&m.failed===0;
 const phase2=!!q&&q.verified>0&&q.unverified===0&&q.failed===0;
 const phase3=!!r&&r.verified>0&&r.unverified===0&&r.failed===0;
 const phase4=!!v&&v.verified>0&&v.unverified===0&&v.failed===0;
 const phase5=!!w&&w.verified>0&&w.unverified===0&&w.failed===0;
 const phase6=!!z&&z.verified>0&&z.unverified===0&&z.failed===0;
 const phase7=!!s&&s.verified>0&&s.unverified===0&&s.failed===0;
 return {key:m.key,verified:initial||phase2||phase3||phase4||phase5||phase6||phase7,source:phase7?'phase7':phase6?'phase6':phase5?'phase5':phase4?'phase4':phase3?'phase3':phase2?'phase2':initial?'initial':null,
  initial:{generated:m.generated,verified:m.verified,unverified:m.unverified,failed:m.failed},phase2:q||null,phase3:r||null,phase4:v||null,phase5:w||null,phase6:z||null,phase7:s||null};
});
const report={target:a.target,catalogueCount:a.catalogueCount,fullyVerified:modules.filter(m=>m.verified).length,
 notFullyVerified:modules.filter(m=>!m.verified).map(m=>m.key),unknownPhase2Keys:unknown,modules};
fs.writeFileSync('audit-reports/math-consolidated.json',JSON.stringify(report,null,2));
fs.writeFileSync('audit-reports/math-consolidated.md','# Couverture mathématique consolidée\n\n'+report.fullyVerified+' / '+report.catalogueCount+' modules entièrement vérifiés. Les échantillons ne sont pas additionnés entre audits.\n\n| Module | Validation | Phase 1 non vérifiées | Phase 2 vérifiées | Phase 2 erreurs |\n|---|---|---:|---:|---:|\n'+modules.map(m=>'| '+m.key+' | '+(m.source||'non couvert')+' | '+m.initial.unverified+' | '+(m.phase2?.verified??'—')+' | '+(m.phase2?.failed??'—')+' |').join('\n')+'\n');
console.log(JSON.stringify({catalogueCount:report.catalogueCount,fullyVerified:report.fullyVerified,notFullyVerified:report.notFullyVerified,unknownPhase2Keys:unknown},null,2));
if(report.catalogueCount!==report.target||unknown.length||a.totals.failed||[...Object.values(p.counts),...Object.values(t.counts),...Object.values(u.counts),...Object.values(v5.counts),...Object.values(v6.counts),...Object.values(v7.counts)].some(c=>c.failed||c.unverified||!c.verified)||report.fullyVerified!==report.target)process.exitCode=1;
