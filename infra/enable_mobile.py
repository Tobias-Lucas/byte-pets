from pathlib import Path
root = Path(__file__).resolve().parents[1]
app = root/'web/src/app.js'
s = app.read_text()
s = s.replace("APP.studentIdentity=null;APP.outcome=null;", "APP.mobileMore=false;APP.studentIdentity=null;APP.outcome=null;")
needle = "function renderProfilePanel(){"
assert needle in s
insert = '''// Navigation specifically designed for phones. All actions reuse the desktop API/rules.
function renderMobileDock(){
 const staff=staffRole();
 const entries=staff?
  [['overview','Painel','school'],['students','Alunos','friends'],['classes','Turmas','school'],['tests','Testes','challenges']]:
  [['home','Início','home'],['worlds','Mundos','worlds'],['games','Jogos','games'],['challenges','Desafios','challenges']];
 const current=staff?APP.staffSection:APP.page;
 const tabs=entries.map(([key,label,icon])=>staff?
  `<button class="dock-item ${current===key?'active':''}" data-action="staff-jump" data-target="school-${key}" aria-label="${label}" ${current===key?'aria-current="page"':''}>${uiIcon(icon)}<span>${label}</span></button>`:
  `<button class="dock-item ${current===key?'active':''}" data-page="${key}" aria-label="${label}" ${current===key?'aria-current="page"':''}>${uiIcon(icon)}<span>${label}</span></button>`
 ).join('');
 const extras=staff?
  [['reports','Resultados','badges'],['visits','Visitas','home'],...(staff==='manager'?[['teachers','Professores','friends'],['settings','Configurações','worlds']]:[])]:
  [['shop','Loja','shop'],['badges','Medalhas','badges'],['friends','Amigos','friends'],['school','Escola','school']];
 const more=APP.mobileMore?`<div class="mobile-more-shade" data-action="mobile-more"><div class="mobile-more-sheet" role="dialog" aria-label="Mais opções"><div class="mobile-more-head"><strong>Explorar BytePets</strong><button data-action="mobile-more" aria-label="Fechar">✕</button></div><div class="mobile-more-grid">${extras.map(([key,label,icon])=>staff?`<button data-action="staff-jump" data-target="school-${key}" class="mobile-more-option">${uiIcon(icon)}<span>${label}</span></button>`:`<button data-page="${key}" class="mobile-more-option">${uiIcon(icon)}<span>${label}</span></button>`).join('')}<button data-action="logout" class="mobile-more-option logout-option">⎋ <span>Sair da conta</span></button></div></div></div>`:'';
 return `<nav class="mobile-dock" aria-label="Menu inferior do BytePets">${tabs}<button class="dock-item ${APP.mobileMore?'active':''}" data-action="mobile-more" aria-label="Outras opções" aria-expanded="${APP.mobileMore}">${uiIcon('school')}<span>Mais</span></button></nav>${more}`;
}
window.BytePetsMobile={goBack:async()=>{
 if(APP.mobileMore){APP.mobileMore=false;render();return;}
 if(!APP.me){return;}
 if(staffRole()){if(APP.staffSection!=='overview'){APP.staffSection='overview';render();}return;}
 if(APP.game){APP.game=null;APP.outcome=null;render();return;}
 if(APP.moduleId){APP.moduleId=null;APP.challengeRun=null;APP.outcome=null;render();return;}
 if(APP.page!=='home')await openPage('home');
},refresh:()=>location.reload()};
'''
s=s.replace(needle,insert+needle)
s=s.replace("<main>${content}</main>${APP.staffStudentDetail", "<main>${content}</main>${renderMobileDock()}${APP.staffStudentDetail")
# hide more sheet on moving between pages / tabs
s=s.replace("APP.navOpen=false;if(page==='challenges')", "APP.navOpen=false;APP.mobileMore=false;if(page==='challenges')")
# handler before existing toggle-nav action
s=s.replace(" case 'toggle-nav':APP.navOpen=!APP.navOpen;render();break;", " case 'mobile-more':APP.mobileMore=!APP.mobileMore;render();break;\n case 'toggle-nav':APP.navOpen=!APP.navOpen;render();break;")
s=s.replace("case 'staff-jump':case 'staff-switch':{", "case 'staff-jump':case 'staff-switch':{APP.mobileMore=false;")
app.write_text(s)
html=root/'web/index.html'
h=html.read_text()
h=h.replace('name="theme-color" content="#090e26"','name="theme-color" content="#090e26"').replace('<link rel="stylesheet" href="/styles.css">','<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/pets/student_avatar.png"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/mobile.css">')
html.write_text(h)
print('Patched mobile navigation')
