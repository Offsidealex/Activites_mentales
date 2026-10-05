(function(){
  "use strict";
  function esc(v){return String(v??"").replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];});}
  window.renderClassesTab=function(){
    const select=document.getElementById("manage-classe");
    const root=document.getElementById("classes-content");
    if(!select||!root||!window.allData)return;
    const filter=select.value;
    const students=allData.eleves.filter(e=>!filter||e.classe_id===filter).map(e=>({...e,classe:allData.classes.find(c=>c.id===e.classe_id)?.code||"—"})).sort((a,b)=>a.classe.localeCompare(b.classe)||a.prenom.localeCompare(b.prenom,"fr"));
    if(!students.length){root.innerHTML='<div class="empty">Aucun compte élève dans cette classe.</div>';return;}
    root.innerHTML='<div class="table-wrap"><table><thead><tr><th>Élève</th><th>Classe</th><th style="text-align:center">Action</th></tr></thead><tbody>'+students.map(e=>'<tr><td><strong>'+esc(e.prenom)+'</strong></td><td>'+esc(e.classe)+'</td><td style="text-align:center"><button class="trash-btn" type="button" title="Supprimer ce compte" onclick="removeStudentAccount(\''+e.id+'\')">🗑️</button></td></tr>').join("")+'</tbody></table></div>';
  };
  window.removeStudentAccount=async function(eleveId){
    const e=allData.eleves.find(x=>x.id===eleveId); if(!e)return;
    const cl=allData.classes.find(c=>c.id===e.classe_id)?.code||"—";
    if(!confirm("Supprimer définitivement le compte de "+e.prenom+" ("+cl+") ?\n\nSes résultats seront également supprimés. Cette action est irréversible."))return;
    const res=await fetch(SUPABASE_URL+"/functions/v1/student-auth",{method:"POST",headers:{apikey:SUPABASE_ANON_KEY,Authorization:"Bearer "+profToken,"Content-Type":"application/json"},body:JSON.stringify({action:"delete-student",eleveId})});
    const data=await res.json();
    if(!res.ok||data.error){alert(data.error||"Suppression impossible.");return;}
    alert("Le compte de "+e.prenom+" a été supprimé.");
    await loadAll();
  };
})();