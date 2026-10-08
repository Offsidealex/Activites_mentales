(function(){
  "use strict";
  const style=document.createElement("style");
  style.textContent=".trash-btn{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;background:#050505;border:1px solid #f59e0b;border-radius:8px;cursor:pointer;transition:.15s}.trash-btn svg{width:19px;height:19px;fill:#f59e0b}.trash-btn:hover{background:#171008;transform:scale(1.06)}.trash-btn:hover svg{fill:#ffb020}";
  document.head.appendChild(style);
  function esc(v){return String(v??"").replace(/[&<>"']/g,function(ch){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch];});}
  window.renderClassesTab=function(){
    const select=document.getElementById("manage-classe");
    const root=document.getElementById("classes-content");
    if(!select||!root||!window.allData)return;
    const filter=select.value;
    const selectedCode=select.options[select.selectedIndex]?.textContent?.trim()||"";
    const students=allData.eleves.filter(e=>!filter||String(e.classe_id)===filter||allData.classes.some(c=>String(c.id)===String(e.classe_id)&&c.code===filter)).map(e=>({...e,classe:allData.classes.find(c=>c.id===e.classe_id)?.code||"—"})).sort((a,b)=>a.classe.localeCompare(b.classe)||a.prenom.localeCompare(b.prenom,"fr"));
    // Safety net: selected class label must match every displayed row.
    const visible=filter ? students.filter(e=>e.classe===selectedCode || String(allData.classes.find(c=>c.code===e.classe)?.id)===filter) : students;
    if(!visible.length){root.innerHTML='<div class="empty">Aucun compte élève dans cette classe.</div>';return;}
    root.innerHTML='<div class="table-wrap"><table><thead><tr><th>Élève</th><th>Classe</th><th style="text-align:center">Action</th></tr></thead><tbody>'+visible.map(e=>'<tr><td><strong>'+esc(e.prenom)+'</strong></td><td>'+esc(e.classe)+'</td><td style="text-align:center"><button class="trash-btn" type="button" title="Supprimer ce compte" aria-label="Supprimer '+esc(e.prenom)+'" onclick="removeStudentAccount(\''+e.id+'\')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg></button></td></tr>').join("")+'</tbody></table></div>';
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