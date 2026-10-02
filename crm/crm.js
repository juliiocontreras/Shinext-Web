import { auth, db } from "/assets/js/firebase-client.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { collection, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { dashboardView } from "/crm/modules/dashboard.js";
import { recruitmentView } from "/crm/modules/recruitment.js";
import { operationsView } from "/crm/modules/operations.js";
import { accountingView } from "/crm/modules/accounting.js";
import { purchasingView } from "/crm/modules/purchasing.js";
import { salesView } from "/crm/modules/sales.js";
import { contentView } from "/crm/modules/content.js";

const page=document.body.dataset.crmPage;
const roleModules={
 director:["dashboard","recruitment","operations","accounting","purchasing","sales","content"],
 recruitment:["dashboard","recruitment"],
 operations:["dashboard","operations"],
 accounting:["dashboard","accounting"],
 purchasing:["dashboard","purchasing"],
 sales:["dashboard","sales"]
};
const moduleDefs={
 dashboard:{label:"Panel",view:dashboardView},
 recruitment:{label:"Reclutamiento",view:recruitmentView},
 operations:{label:"Operaciones",view:operationsView},
 accounting:{label:"Contabilidad",view:accountingView},
 purchasing:{label:"Compras",view:purchasingView},
 sales:{label:"Ventas",view:salesView},
 content:{label:"Contenido",view:contentView}
};

function status(el,msg,kind=""){if(!el)return;el.textContent=msg;el.dataset.kind=kind;}
async function getCollaborator(user){
 const token=await user.getIdTokenResult(true);
 const role=String(token.claims.role||"");
 if(!roleModules[role]||role==="worker") throw new Error("Esta cuenta no tiene acceso al Shinext CRM.");
 let profile={};
 try{const snap=await getDoc(doc(db,"collaborators",user.uid)); if(snap.exists()) profile=snap.data();}catch{}
 return {role,profile};
}
function effectiveModules(role,profile){
 const allowed=new Set(roleModules[role]||[]);
 const grants=Array.isArray(profile.permissionGrants)?profile.permissionGrants:[];
 const revokes=Array.isArray(profile.permissionRevokes)?profile.permissionRevokes:[];
 const map={review_applications:"recruitment",approve_applications:"recruitment",manage_services:"operations",view_financial_summary:"accounting",manage_payments:"accounting",manage_supplies:"purchasing",manage_inventory:"purchasing",manage_sales:"sales",manage_content:"content"};
 grants.forEach(p=>{if(map[p])allowed.add(map[p]);});
 revokes.forEach(p=>{if(map[p])allowed.delete(map[p]);});
 allowed.add("dashboard");
 return [...allowed];
}
async function loadModule(key){
 const def=moduleDefs[key]||moduleDefs.dashboard;
 const view=def.view();
 document.querySelector("#crm-section-title").textContent=view.title;
 document.querySelector("#crm-section-kicker").textContent=view.kicker;
 const content=document.querySelector("#crm-content");
 content.innerHTML=view.html;
 document.querySelectorAll("[data-crm-module]").forEach(b=>b.classList.toggle("active",b.dataset.crmModule===key));
 if(view.collection){
   try{
     const snap=await getDocs(collection(db,view.collection));
     const list=document.querySelector("#module-list");
     list.innerHTML=snap.empty?'<div class="crm-empty">No hay registros para mostrar.</div>':snap.docs.map(d=>view.renderItem({id:d.id,...d.data()})).join("");
   }catch(e){
     const list=document.querySelector("#module-list");
     if(list)list.innerHTML='<div class="crm-empty">No tienes acceso a esta información o no pudo cargarse.</div>';
   }
 }
 if(typeof view.mount==="function") await view.mount();
}
async function initLogin(){
 const form=document.querySelector("#crm-login-form"),msg=document.querySelector("#crm-login-status"),btn=document.querySelector("#crm-login-button");
 onAuthStateChanged(auth,async user=>{if(!user)return;try{await getCollaborator(user);location.replace("/crm/");}catch{}});
 form.addEventListener("submit",async e=>{e.preventDefault();btn.disabled=true;status(msg,"Verificando acceso…");
 try{const cred=await signInWithEmailAndPassword(auth,form.email.value.trim().toLowerCase(),form.password.value);await getCollaborator(cred.user);location.replace("/crm/");}
 catch(err){try{await signOut(auth);}catch{} status(msg,err?.message||"No pudimos iniciar sesión.","error");btn.disabled=false;}});
}
async function initApp(){
 onAuthStateChanged(auth,async user=>{
   if(!user){location.replace("/crm/login.html");return;}
   try{
     const {role,profile}=await getCollaborator(user);
     document.querySelector("#crm-user-role").textContent=role==="director"?"Dirección":role.charAt(0).toUpperCase()+role.slice(1);
     document.querySelector("#crm-user-name").textContent=profile.displayName||user.displayName||user.email||"Colaborador Shinext";
     document.querySelector("#crm-today").textContent=new Intl.DateTimeFormat("es-MX",{dateStyle:"medium"}).format(new Date());
     const modules=effectiveModules(role,profile),nav=document.querySelector("#crm-nav");
     nav.innerHTML=modules.map(key=>`<button type="button" data-crm-module="${key}">${moduleDefs[key].label}</button>`).join("");
     nav.querySelectorAll("[data-crm-module]").forEach(b=>b.addEventListener("click",()=>loadModule(b.dataset.crmModule)));
     document.querySelector("#crm-loading").hidden=true;document.querySelector("#crm-app").hidden=false;
     await loadModule("dashboard");
   }catch{try{await signOut(auth);}catch{} location.replace("/crm/login.html");}
 });
 document.querySelector("#crm-logout")?.addEventListener("click",async()=>{await signOut(auth);location.replace("/crm/login.html");});
 document.querySelector("#crm-menu-toggle")?.addEventListener("click",()=>document.querySelector(".crm-sidebar")?.classList.toggle("open"));
}
if(page==="login")initLogin(); else initApp();