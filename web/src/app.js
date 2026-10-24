const root=document.getElementById('app');
const APP={content:null,me:null,page:'home',authMode:'register',role:'student',shopFilter:'all',food:'apple',effect:null,petAnimation:'idle',game:null,hint:false,moveQueue:[],moduleId:null,questionIndex:0,answer:null,schoolId:null,mediaPath:'',visitor:null,snake:null,modal:null,schoolReport:null,foodMenu:false,bridgeRot:{},bridgeSelected:null,bridgeWalking:null,challengeFeedback:null};
// School context and boot modes are managed separately from player progress.
APP.setup=null;APP.setupSchoolMode=false;APP.authContext='register';APP.teacherToken=new URLSearchParams(location.search).get('teacherInvite')||'';
APP.teacherSchoolName='';APP.schoolRoster=null;APP.teacherInviteUrl='';APP.newActivation=null;APP.schoolReport=null;
APP.mobileMore=false;APP.studentIdentity=null;APP.outcome=null;APP.currentVisitors=[];APP.staffSection='overview';APP.mentorMessages=[];
APP.staffReportModule='all';APP.staffStudentDetail=null;APP.navOpen=false;APP.arcadeIndex=0;APP.worldPage=0;APP.shopPage=0;APP.socialPage=0;APP.badgePage=0;APP.showSkins=false;APP.modulePage=0;APP.challengeRun=null;APP.challengeView='question';APP.reviewIndex=0;APP.lastFeedback=null;APP.lastGameType=null;APP.staffSection='overview';APP.staffPage=0;APP.staffMobileView='list';APP.staffClassIndex=0;
let visitBeatTimer=null;
let snakeTimer=null;
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('pt-BR');
const cpath=(p)=>p||'';
function clientUUID(){if(globalThis.crypto?.randomUUID)return crypto.randomUUID();if(globalThis.crypto?.getRandomValues){const b=new Uint8Array(16);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('')}return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`} 
async function api(path,method='GET',data){
 let res=await fetch('/api'+path,{method,headers:data===undefined?{}:{'Content-Type':'application/json'},credentials:'same-origin',body:data===undefined?undefined:JSON.stringify(data)});
 let result=await res.json().catch(()=>({error:'Resposta inválida do servidor'}));if(!res.ok)throw new Error(result.error||'Falha na operação');return result;
}
function toast(msg,isError=false){document.querySelector('.notification')?.remove();let el=document.createElement('div');el.className='notification'+(isError?' error':'');el.setAttribute('role','status');el.textContent=msg;document.body.append(el);setTimeout(()=>el.remove(),3500)}
function scrollUp(){window.scrollTo({top:0,behavior:'smooth'})}
const coin=()=>APP.me?.pet?.coins||0;
const petImg=(anim,skin='normal')=>'/assets/pets/'+(skin==='crystal'||skin==='forest'?'skins/'+skin+'/':'')+(anim||'idle')+'.png';
const staffRole=()=>APP.me?.schools?.find(x=>x.role==='manager'||x.role==='teacher')?.role||null;
const staffSprite=()=>staffRole()==='manager'?petImg('mentor_admin'):petImg('mentor_teacher');
const gameThumb=(name)=>'/assets/games/'+name+'.webp';
const item=(id)=>APP.content?.items?.find(x=>x.id===id);
const world=(id)=>APP.content?.worlds?.find(x=>x.id===id);
const owned=(id,w='')=>APP.me?.inventory?.find(x=>x.item_id===id&&x.world_id===w)?.quantity||0;
const equipped=(w,slot)=>APP.me?.equipment?.find(x=>x.world_id===w&&x.slot===slot)?.item_id;
const unlocked=(id)=>APP.me?.unlocked?.includes(id);

const ICONS={home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',worlds:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 4-5 14 0 18M12 3c5 4 5 14 0 18"/>',games:'<rect x="2" y="8" width="20" height="11" rx="4"/><path d="M7 11v5M4.5 13.5h5M16 12h.01M19 15h.01"/>',challenges:'<path d="M8 3h8v3a4 4 0 0 0 4 4h1V4h-5M8 3H3v6h1a4 4 0 0 0 4-4V3Z"/><path d="M12 13v6m-5 2h10"/>',shop:'<path d="M3 8h18l-2 12H5zM3 8l2-5h14l2 5M9 12v3m6-3v3"/>',badges:'<circle cx="12" cy="9" r="6"/><path d="m8 14-1 8 5-3 5 3-1-8"/>',friends:'<circle cx="9" cy="8" r="4"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M16 5a4 4 0 0 1 0 7m1 3a5 5 0 0 1 5 5"/>',school:'<path d="m2 9 10-6 10 6-10 6zM6 12v6q6 5 12 0v-6M22 9v8"/>'};
function uiIcon(id){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" aria-hidden="true">${ICONS[id]||ICONS.home}</svg>`}
function nav(id,label){return `<button class="nav ${APP.page===id?'active':''}" data-page="${id}">${uiIcon(id)} <span>${label}</span></button>`}

function heading(title,sub){return `<div class="page-head"><div class="eyebrow">◆ BYTEPETS / ${esc(title).toUpperCase()}</div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>`}
function button(action,text,cls='secondary',attrs=''){return `<button type="button" class="button ${cls}" data-action="${action}" ${attrs}>${text}</button>`}
function stat(label,value,style=''){return `<div class="stat-row"><div class="names"><span>${label}</span><span>${Math.round(value)}%</span></div><div class="meter ${style}"><i style="width:${Math.max(0,Math.min(100,value))}%"></i></div></div>`}
function scene(data,readOnly=false){
 const p=data.pet,w=world(p.world_id)||APP.content.worlds[0],equip=data.equipment||[];
 const windowId=equip.find(x=>x.world_id===w.id&&x.slot==='window_view')?.item_id;
 const view=windowId?item(windowId)?.image:w.window;
 const withDefaults=[...equip];if(!withDefaults.some(x=>x.world_id===w.id&&x.slot==='bed'))withDefaults.push({world_id:w.id,slot:'bed',item_id:w.id+'_bed_1'});
 const sprites=withDefaults.filter(x=>x.world_id===w.id&&x.slot!=='window_view').map(eq=>{
  const it=item(eq.item_id),slot=APP.content.slots.find(s=>s.id===eq.slot);if(!it||!slot)return '';
  let width={bed:350,lamp:180,companion:166,rug:400,wall_decor:248}[eq.slot]||210;
  return `<img class="scene-decor" src="${it.image}" alt="${esc(it.name)}" style="left:${slot.anchor.x/1280*100}%;top:${slot.anchor.y/720*100}%;width:${width/1280*100}%;z-index:${slot.z}" loading="eager">`;
 }).join('');
 const weak=p.health<=0,anim=weak?'weak':p.sleeping?'sleep':(!readOnly&&APP.petAnimation!=='idle'?APP.petAnimation:(p.hygiene<25?'dirty':'idle'));
 const foodItems=APP.content.items.filter(i=>i.kind==='food'&&owned(i.id)>0);
 return `<div class="hero-stage world-${esc(w.id)} ${p.sleeping?'is-sleeping':''}" aria-label="Habitat ${esc(w.name)} com mascote separado e decorações">
  <div class="window-view"><img src="${view}" alt="Vista da janela do mundo"></div>
  <img class="base-scene" src="${w.image}" alt="Cenário ${esc(w.name)}">
  ${sprites}
  <img class="pet-layer ${esc(p.skin==='normal'?'':p.skin)} ${esc(anim)}" src="${petImg(anim,p.skin)}" alt="Mascote ${esc(p.name)}">
  ${readOnly&&data.visitor?`<div class="visit-avatar own-visitor"><img src="${data.visitor.sprite}" alt="Mascote visitante"><span>${esc(data.visitor.name)}</span></div>`:''}
  ${!readOnly?(APP.currentVisitors||[]).slice(0,3).map((v,i)=>`<div class="visit-avatar resident-visitor visitor-${i}"><img src="${v.sprite}" alt="Mascote de ${esc(v.username)}"><span>${esc(v.name)}</span></div>`).join(''):''}
  ${!readOnly&&p.poop?`<button class="scene-poop" data-action="care" data-care="collect" aria-label="Recolher cocô"><img src="/assets/pets/poop.png" alt="Cocô para recolher"></button>`:''}
  ${!readOnly&&p.sleeping?'<span class="scene-sleep-z" aria-label="Mascote dormindo">Z z z</span>':''}
  ${weak?'<img class="scene-ghost" src="/assets/pets/ghost.png" alt="Fantasma: pet fraco">':''}
  ${!readOnly&&APP.effect?`<span class="pet-effect">${esc(APP.effect)}</span>`:''}
  ${readOnly?`<div class="scene-owner-name">🏠 ${esc(p.name)} · ${esc(data.account?.username||'Proprietário')}</div>`:''}
  <div class="scene-caption">✦ ${esc(w.name)} ${readOnly?'<span class="tag">Visita</span>':''}</div>
  ${!readOnly&&APP.foodMenu?`<div class="food-popover" role="dialog" aria-label="Escolha um alimento"><strong>Escolha um alimento</strong><div class="food-grid">${foodItems.length?foodItems.map(f=>`<button data-action="choose-food" data-id="${f.id}" class="food-option" title="${esc(f.name)}"><img src="${f.image}" alt=""><span>${esc(f.name)}</span><small>×${owned(f.id)}</small></button>`).join(''):`<p>Sem alimentos. Visite a loja.</p>`}</div><button class="food-close" data-action="feed-menu">Fechar ×</button></div>`:''}
 </div>`;
}
function renderSetupChoice(){return `<div class="setup-shell"><div class="setup-header"><span class="brand-title">✦ BytePets</span><h1>Escolha como vai jogar</h1><p>Crie seu mundo e comece uma aventura de descobertas.</p></div><div class="setup-grid">
 <button class="setup-card" data-action="setup-normal"><img src="/assets/worlds/refugio-preview.png" alt="Refugio Pixel"><strong>Uso normal</strong><span>Crie seu jogador, cuide do pet e explore os desafios.</span><em>Comecar aventura →</em></button>
 <button class="setup-card school-card" data-action="setup-school"><img src="/assets/worlds/jardim-preview.png" alt="Aventura escolar"><strong>Uso estudantil</strong><span>Instituicao, matriculas, turmas e professores.</span><em>Configurar escola →</em></button>
 </div><div class="setup-footer">A escolha define a configuracao desta instalacao. Para mudar depois, sera preciso uma migracao administrativa.</div></div>`}
function renderSchoolBootstrap(){return `<div class="setup-shell"><div class="setup-header"><span class="brand-title">✦ BytePets</span><h1>Configurar sua escola</h1><p>Somente o primeiro administrador pode iniciar esta instalacao escolar.</p></div><form id="setup-school-form" class="panel setup-form stack"><div class="eyebrow">PASSO 1 / ORGANIZACAO</div><label class="form-label">Nome da instituicao</label><input class="field" name="schoolName" required minlength="3" maxlength="90" placeholder="Ex.: Escola Aurora"><div class="eyebrow">PASSO 2 / ADMINISTRADOR</div><div class="two-cols"><div><label class="form-label">Usuario administrador</label><input class="field" name="username" required pattern="[a-zA-Z0-9_]{3,20}" placeholder="Ex.: coord_aurora"></div><div><label class="form-label">Senha (mín. 8 caracteres)</label><input class="field" name="password" type="password" minlength="8" required autocomplete="new-password"></div><div><label class="form-label">Confirmar senha</label><input class="field" name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password" placeholder="Repita sua senha"></div></div><p class="tiny-info">O guia da administracao e Orion, uma coruja sabia. Gestores nao precisam cuidar de um pet.</p><button class="button full" type="submit">Criar escola e administrador</button>${button('setup-back','← Voltar','ghost')}</form></div>`}
function renderAuth(){
 const school=APP.setup?.mode==='school',teacher=school&&APP.authContext==='teacher'&&!!APP.teacherToken;
 const enrolled=school&&APP.authContext==='student'&&APP.authMode==='register',creating=!school&&APP.authMode==='register';
 const title=teacher?'Cadastro de professor':enrolled?'Minha primeira aventura':creating?'Criar meu BytePet':'Entrar no BytePets';
 const ready=!enrolled||!!APP.studentIdentity;
 return `<div class="auth-wrap"><div class="auth-showcase"><img class="auth-scene" src="/assets/worlds/refugio-preview.png" alt=""><img class="auth-pet" src="${teacher?petImg('mentor_teacher'):'/assets/pets/student_avatar.png'}" alt="Mascote BytePets"><div class="copy"><div class="eyebrow">APRENDA • EXPLORE • EVOLUA</div><h1>Um amigo digital.<br>Mil descobertas.</h1><p>Vamos explorar juntos?</p></div></div>
 <div class="panel auth-form"><div class="eyebrow">✦ ${school?'AVENTURA ESCOLAR':'MODO LIVRE'}</div><h1>${title}</h1>
 ${teacher?`<p>Escola: <strong>${esc(APP.teacherSchoolName||'Sua escola')}</strong>. Seu acesso precisa de aprovacao.</p>`:enrolled?'<p>Seu codigo secreto foi entregue pela escola. O nome registrado na matricula nao pode ser alterado aqui.</p>':'<p>Crie uma conta para comecar a jogar.</p>'}
 <div class="auth-switch">${button('login-mode','Ja tenho conta',(!teacher&&!enrolled&&APP.authMode==='login')?'':'ghost')}${school?button('student-register-mode','Sou aluno',enrolled?'':'ghost'):button('register-mode','Criar conta',creating?'':'ghost')}</div>
 ${enrolled&&!ready?`<form id="student-code-form" class="student-code-form stack"><img src="/assets/pets/idle.png" alt="BytePet" class="code-mascot"><label class="form-label" for="student-code">CODIGO DO ALUNO</label><input class="field student-code-input" id="student-code" name="studentCode" required autocomplete="off" maxlength="80" placeholder="Seu codigo secreto"><button class="button full" type="submit">Verificar codigo →</button><p class="tiny muted">A escola entregou esse codigo para voce ou seu responsavel.</p></form>`:''}
 ${enrolled&&ready?`<div class="verified-student"><span>✓ Codigo encontrado</span><b>${esc(APP.studentIdentity.schoolName)}</b><small>${esc(APP.studentIdentity.studentName)} · ${esc(APP.studentIdentity.className)}</small>${button('student-change-code','Trocar codigo','ghost sm')}</div>`:''}
 ${ready?`<form id="auth-form" class="stack">
 <label class="form-label" for="username">${enrolled?'ESCOLHA SEU APELIDO':'USUARIO / APELIDO'}</label><input class="field" id="username" name="username" pattern="[a-zA-Z0-9_]{3,20}" required autocomplete="username" placeholder="Ex.: explorador_byte" maxlength="20">
 <label class="form-label" for="password">SENHA</label><input class="field" id="password" type="password" name="password" minlength="8" required autocomplete="${creating||enrolled||teacher?'new-password':'current-password'}" placeholder="Pelo menos 8 caracteres">
 ${creating||enrolled||teacher?`<label class="form-label" for="password-confirm">CONFIRMAR SENHA</label><input class="field" id="password-confirm" type="password" name="passwordConfirm" minlength="8" required autocomplete="new-password" placeholder="Digite a mesma senha">`:''}
 ${creating||enrolled?`<label class="form-label" for="petname">NOME DO MASCOTE</label><input class="field" id="petname" name="petName" placeholder="Ex.: Lumi" maxlength="20" minlength="2" required>`:''}
 <button class="button full" type="submit">${teacher?'Solicitar aprovacao':enrolled?'Criar meu BytePet!':creating?'Comecar aventura':'Entrar'}</button></form>`:''}
 ${school&&!teacher?'<p class="tiny muted">Professores entram somente pelo link de convite da escola.</p>':''}
 <p class="tiny-info">Alpha local. Requer autorizacao dos responsaveis e protecoes extras antes de uso publico infantil.</p></div></div>`;
}
function renderPending(){const a=APP.me.approval;return `<div class="setup-shell"><div class="panel pending"><img src="/assets/pets/mentor_teacher.png" alt="Mascote do professor" width="120"><h1>${a.status==='pending'?'Aguardando aprovacao':'Cadastro nao aprovado'}</h1><p>Solicitacao para ${esc(a.school_name)}. A equipe gestora precisa analisar o seu cadastro.</p>${button('pending-refresh','Atualizar situacao','secondary')}${button('logout','Sair','ghost')}</div></div>`}
function renderHeader(){
 const role=staffRole(),p=APP.me.pet;
 if(role)return `<header class="topbar staff-topbar"><div class="brand"><div class="brand-mark">✦</div><div><div class="brand-title">BytePets</div><small>AMBIENTE INSTITUCIONAL</small></div></div><nav class="tabs ${APP.navOpen?'menu-open':''}" aria-label="Ferramentas administrativas">
 <button class="nav ${APP.staffSection==='overview'?'active':''}" data-action="staff-jump" data-target="school-overview">${uiIcon('school')}<span>Painel escolar</span></button>
 <button class="nav ${APP.staffSection==='students'?'active':''}" data-action="staff-jump" data-target="school-students">${uiIcon('friends')} <span>Alunos</span></button>
 ${role==='manager'?`<button class="nav ${APP.staffSection==='teachers'?'active':''}" data-action="staff-jump" data-target="school-teachers">${uiIcon('friends')} <span>Professores</span></button>`:''}
 <button class="nav ${APP.staffSection==='classes'?'active':''}" data-action="staff-jump" data-target="school-classes">${uiIcon('school')} <span>Turmas</span></button>
 <button class="nav ${APP.staffSection==='tests'?'active':''}" data-action="staff-jump" data-target="school-tests">${uiIcon('challenges')} <span>Testes</span></button>
 <button class="nav ${APP.staffSection==='reports'?'active':''}" data-action="staff-jump" data-target="school-reports">${uiIcon('badges')} <span>Resultados</span></button>
 <button class="nav ${APP.staffSection==='visits'?'active':''}" data-action="staff-jump" data-target="school-visits">${uiIcon('home')} <span>Visitas</span></button>
 ${role==='manager'?`<button class="nav ${APP.staffSection==='settings'?'active':''}" data-action="staff-jump" data-target="school-settings">${uiIcon('worlds')} <span>Configurações</span></button>`:''}
 </nav><div class="account-mini"><button class="menu-toggle" data-action="toggle-nav" aria-label="Abrir menu">☰</button><span class="staff-identity"><img src="${staffSprite()}" alt="${role==='manager'?'Mascote administrador':'Mascote professor'}">${role==='manager'?'Administracao':'Professor'}</span>${button('logout','Sair','ghost sm')}</div></header>`;
 return `<header class="topbar"><div class="brand"><div class="brand-mark">✦</div><div><div class="brand-title">BytePets</div><small>APRENDA • EXPLORE • EVOLUA</small></div></div><nav class="tabs ${APP.navOpen?'menu-open':''}" aria-label="Navegação principal">${nav('home','Início')}${nav('worlds','Mundos')}${nav('games','Jogos')}${nav('challenges','Desafios')}${nav('shop','Loja')}${nav('badges','Medalhas')}${nav('friends','Amigos')}${nav('school','Escola')}</nav><div class="account-mini"><button class="menu-toggle" data-action="toggle-nav" aria-label="Abrir menu">☰</button><span class="coin-pill">◉ <strong>${fmt(p.coins)}</strong></span><span class="level-pill">NV. ${p.level}</span>${button('logout','Sair','ghost sm')}</div></header>`;
}
// Navigation specifically designed for phones. All actions reuse the desktop API/rules.
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
function renderProfilePanel(){const p=APP.me.pet;return `<div class="panel pet-hud"><div class="profile-line"><img src="${p.skin==='normal'?'/assets/pets/student_avatar.png':petImg('idle',p.skin)}" alt="pet"><div><div class="pet-name">${esc(p.name)}</div><div class="minor muted">Nível ${p.level} • ${esc(APP.me.account.username)}</div></div></div>
 ${stat('♥ Vida',p.health,'rose')}${stat('🍎 Fome',p.hunger,'yellow')}${stat('⚡ Energia',p.energy)}${stat('✦ Higiene',p.hygiene,'purple')}${stat('☻ Felicidade',p.happiness)}
 <div class="divider"></div><div class="inline-between"><b>✦ Experiência</b><span class="gold">${p.xp%100}/100 XP</span></div><div class="meter"><i style="width:${p.xp%100}%"></i></div>
 ${p.sleeping?'<p class="tiny-info">Seu pet descansa até ser acordado ou recuperar a energia.</p>':''}
 ${p.health<=0?'<p class="tiny-info danger-text">Seu pet está fraquinho. Alimente-o para se recuperar gradualmente.</p>':''}
 </div>`}
function renderHome(){const p=APP.me.pet,w=world(p.world_id);return `<div class="home-layout"><section class="home-stage panel panel-glow"><div class="stage-header"><div><h2 class="section-title">✦ ${esc(w.name)}</h2><div class="section-sub">Um mundo para cuidar, criar e descobrir</div></div>${button('go-worlds','◉ Trocar mundo','secondary sm')}</div>
 ${scene(APP.me)}
 ${renderMentorMessages()}
 <div class="pet-action-bar" aria-label="Interações do mascote">
  <button class="pet-action ${APP.foodMenu?'active':''}" data-action="feed-menu" ${p.sleeping?'disabled':''}><img src="/assets/food/apple.png" alt=""><span>Alimentar</span></button>
  <button class="pet-action" data-action="care" data-care="clean" ${p.sleeping?'disabled':''}><img src="/assets/ui/broom.png" alt=""><span>Limpar</span></button>
  <button class="pet-action" data-action="care" data-care="play" ${p.sleeping?'disabled':''}><span class="action-icon heart">♥</span><span>Carinho</span></button>
  <button class="pet-action" data-action="care" data-care="${p.sleeping?'wake':'sleep'}"><span class="action-icon">${p.sleeping?'☀':'☾'}</span><span>${p.sleeping?'Acordar':'Dormir'}</span></button>

 </div><div class="home-links">${button('go-games','Jogar','secondary')}${button('go-challenges','Desafios','secondary')}${button('go-shop','Decorar','gold')}${button('go-friends','Visitar amigos','ghost')}</div></section>
 <aside class="home-side">${renderProfilePanel()}<div class="panel quick-quests"><div class="eyebrow">PRÓXIMAS MISSÕES</div><h2>Seu progresso</h2><div class="quest-line"><span>◆</span> Resolva um jogo lógico</div><div class="quest-line"><span>✦</span> Cuide do seu pet</div><div class="quest-line"><span>★</span> Colecione medalhas</div>${button('go-badges','Ver medalhas →','secondary full')}</div></aside></div>`}
function renderWorlds(){
 const current=APP.me.pet.world_id,small=window.innerWidth<700;APP.worldPage=Math.min(APP.worldPage,APP.content.worlds.length-1);
 const ws=small?[APP.content.worlds[APP.worldPage]]:APP.content.worlds;
 return `<section class="worlds-screen"><div class="compact-heading"><h1>Explorar mundos</h1><p>Novos cenários, desafios e decorações!</p></div><div class="worlds-grid">${ws.map(w=>{
  const allowed=unlocked(w.id);return `<article class="card cover"><img src="${w.preview}" alt="${esc(w.name)}"><div class="content"><div class="inline-between"><h2>${esc(w.name)}</h2><span class="tag">${current===w.id?'Atual':allowed?'Liberado':'Bloqueado'}</span></div><p class="minor muted">${esc(w.description)}</p>${button('travel',current===w.id?'✓ Você está aqui':allowed?'Viajar →':`🔒 Nível ${w.minLevel}`,current===w.id?'ghost full':allowed?'full':'ghost full',`data-id="${w.id}" ${(current===w.id||!allowed)?'disabled':''}`)}</div></article>`}).join('')}</div>${small?`<div class="game-carousel-controls">${button('worlds-page','← Anterior','ghost',`data-step="-1" ${APP.worldPage===0?'disabled':''}`)}<span>${APP.worldPage+1}/${APP.content.worlds.length}</span>${button('worlds-page','Próximo →','ghost',`data-step="1" ${APP.worldPage===APP.content.worlds.length-1?'disabled':''}`)}</div>`:''}</section>`;
}
function renderShop(){
 const current=APP.me.pet.world_id,filter=APP.shopFilter;
 const items=APP.content.items.filter(i=>filter==='all'?(i.kind==='food'||i.worldId===current):filter==='food'?i.kind==='food':i.worldId===current&&i.slot===filter);
 const per=window.innerWidth<700?2:8, pages=Math.max(1,Math.ceil(items.length/per));APP.shopPage=Math.min(APP.shopPage,pages-1);
 return `<section class="shop-screen"><div class="compact-heading"><h1>Loja Pixel</h1><p>Decore seus mundos e escolha alimentos para o pet.</p></div><div class="shop-filters">${[['all','Todos'],['food','Comidas'],['bed','Camas'],['lamp','Luzes'],['companion','Companheiros'],['rug','Tapetes'],['wall_decor','Quadros'],['window_view','Janelas']].map(([k,title])=>button('shop-filter',title,filter===k?'sm':'ghost sm',`data-filter="${k}"`)).join('')}</div><div class="shop-grid">${items.slice(APP.shopPage*per,(APP.shopPage+1)*per).map(it=>{
 const has=owned(it.id,it.kind==='decor'?current:''),active=equipped(current,it.slot)===it.id;
 return `<article class="shop-item"><img src="${it.image}" alt="${esc(it.name)}"><div class="name">${esc(it.name)}</div><div class="gold">◉ ${it.price}</div><div class="muted minor">Na bolsa: ${has}</div>${it.kind==='decor'&&has?button('equip',active?'✓ Equipado':'Equipar',active?'ghost sm':'secondary sm',`data-id="${it.id}" ${active?'disabled':''}`):button('buy','Comprar','gold sm',`data-id="${it.id}" data-world="${it.kind==='decor'?current:''}"`)}</article>`}).join('')}</div>${pages>1?`<div class="module-pager">${button('shop-page','Anterior','ghost sm',`data-step="-1" ${APP.shopPage===0?'disabled':''}`)}${APP.shopPage+1} / ${pages}${button('shop-page','Próxima','ghost sm',`data-step="1" ${APP.shopPage===pages-1?'disabled':''}`)}</div>`:''}</section>`;
}
function renderBadges(){
 const medals=APP.me.badges||[],cosmetics=APP.me.cosmetics.skins,per=window.innerWidth<700?2:6,pages=Math.max(1,Math.ceil(medals.length/per));APP.badgePage=Math.min(APP.badgePage,pages-1);
 return `<section class="medals-screen"><div class="compact-heading"><h1>Diário de conquistas</h1><p>Medalhas por módulo e skins liberadas pelo conhecimento.</p><div class="inline">${button('badges-tab','Medalhas',APP.showSkins?'ghost sm':'sm',`data-tab="medals"`)}${button('badges-tab','Skins',APP.showSkins?'sm':'ghost sm',`data-tab="skins"`)}</div></div>${!APP.showSkins?`<div class="badge-list">${medals.slice(APP.badgePage*per,(APP.badgePage+1)*per).map(b=>`<article class="badge-card"><div class="badge-icon">${b.label.includes('OURO')?'🥇':b.label.includes('PRATA')?'🥈':b.label.includes('BRONZE')?'🥉':'🏅'}</div><h2>${esc(b.label)}</h2><p class="muted minor">${esc(b.issuer)}</p></article>`).join('')||'<div class="panel">Resolva um teste completo para receber a sua primeira medalha.</div>'}</div>${pages>1?`<div class="module-pager">${button('badges-page','Anterior','ghost sm',`data-step="-1" ${APP.badgePage===0?'disabled':''}`)}${APP.badgePage+1}/${pages}${button('badges-page','Próxima','ghost sm',`data-step="1" ${APP.badgePage>=pages-1?'disabled':''}`)}</div>`:''}`:`<div class="skin-grid">${cosmetics.map(k=>`<div class="mini-card"><img src="${petImg('idle',k.id)}" alt="${esc(k.title)}"><div class="grow"><strong>${esc(k.title)}</strong><small class="muted">${k.unlocked?'Desbloqueada':'Conquiste mais níveis e medalhas'}</small></div>${button('skin',APP.me.pet.skin===k.id?'✓':k.unlocked?'Usar':'🔒','sm',`data-id="${k.id}" ${(!k.unlocked||APP.me.pet.skin===k.id)?'disabled':''}`)}</div>`).join('')}</div>`}</section>`;
}
function mazePreview(round,moves){let [x,y]=round.start;for(const m of moves){const delta={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]}[m];if(delta){const nx=x+delta[0],ny=y+delta[1];if(nx>=0&&ny>=0&&nx<round.grid&&ny<round.grid&&!round.walls.some(w=>w[0]===nx&&w[1]===ny)){x=nx;y=ny}}}return {x,y}}
function bridgeShape(tile){return `<img class="wood-bridge-sprite" src="/assets/games/tiles/bridge-${tile.kind==='straight'?'straight':'corner'}.png" alt="">`}
function renderBridges(round){const tiles=new Map(round.tiles.map(t=>[t.id,t])),selected=APP.bridgeSelected;
 const walk=APP.bridgeWalking?.path?.[APP.bridgeWalking.step]||(APP.bridgeWalking?.falling?APP.bridgeWalking.fallAt:null);
 return `<div class="bridge-shell"><div class="bridge-board" style="--grid:${round.grid}" role="group" aria-label="Quebra-cabeça das pontes de madeira">
 ${Array.from({length:round.grid*round.grid},(_,i)=>{const x=i%round.grid,y=Math.floor(i/round.grid),key=x+'_'+y,t=tiles.get(key),start=round.start[0]===x&&round.start[1]===y,end=round.goal[0]===x&&round.goal[1]===y,isWalk=walk&&walk[0]===x&&walk[1]===y;
 const rot=t?(APP.bridgeRot[key]??t.rot):0;
 return `<button ${!t?'disabled':''} class="bridge-cell ${t?'has-bridge':''} ${selected===key?'selected':''} ${start||end?'bridge-island':''}" ${t?`data-action="bridge-select" data-id="${key}"`:''} aria-label="${t?'Ponte de madeira em '+(x+1)+','+(y+1):start?'Início do pet':end?'Destino':'Água'}">
 ${t?`<span class="bridge-shape" style="transform:rotate(${rot*90}deg)">${bridgeShape(t)}</span>`:''}
 ${start||isWalk?`<img class="bridge-character ${isWalk?'bridge-moving':''}" src="${petImg('idle')}" alt="Pet">`:''}
 ${end?'<span class="bridge-star" aria-label="Destino">★</span>':''}
 ${!t&&!start&&!end?'<span class="water-wave" aria-hidden="true">≈</span>':''}
 </button>`}).join('')}
 </div><div class="bridge-controls"><div class="control-group"><button class="rotation-button" data-action="bridge-rotate" data-dir="-1" ${!selected||APP.bridgeWalking?'disabled':''} title="Girar ponte para a esquerda">↶</button><span class="tiny muted">${selected?'Ponte selecionada':'Toque numa ponte'}</span><button class="rotation-button" data-action="bridge-rotate" data-dir="1" ${!selected||APP.bridgeWalking?'disabled':''} title="Girar ponte para a direita">↷</button></div><div class="inline controls-cta">${button('bridge-reset','Reiniciar','ghost')}${button('bridge-submit','▶ Testar caminho','gold',APP.bridgeWalking?'disabled':'')}</div></div></div>`
}
function renderGameActive(){const g=APP.game,r=g.round;let stage='';
 if(g.type==='pattern')stage=`<div class="game-title"><span class="eyebrow">DECIFRE O CÓDIGO</span><h2>${esc(r.title)}</h2></div><div class="pattern-sequence">${r.sequence.map(v=>`<span>${esc(v)}</span>`).join('')}</div><div class="round-options">${r.options.map(v=>`<button class="round-tile" data-action="game-answer" data-answer="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
 if(g.type==='bridges')stage=`<div class="game-title"><span class="eyebrow">GIRE AS PONTES</span><h2>${esc(r.title)}</h2></div>${renderBridges(r)}`;
 if(g.type==='snake')stage=`<div class="game-title"><span class="eyebrow">BYTE SNAKE</span><h2>${esc(r.title)}</h2></div><div class="snake-status"><span id="snake-msg">Capture o numero indicado: <b id="snake-target">${r.targets[0]}</b></span><span id="snake-counter" class="gold">0/${r.targets.length}</span></div><canvas id="snake-canvas" class="snake-canvas" width="360" height="360" aria-label="Jogo da cobrinha em grade"></canvas><div class="snake-inputs"><div class="dpad" aria-label="Controle da cobrinha"><button data-action="snake-direction" data-dir="U" class="dpad-up" aria-label="Cima">↑</button><button data-action="snake-direction" data-dir="L" class="dpad-left" aria-label="Esquerda">←</button><button data-action="snake-direction" data-dir="R" class="dpad-right" aria-label="Direita">→</button><button data-action="snake-direction" data-dir="D" class="dpad-down" aria-label="Baixo">↓</button></div><div class="keyboard-hint">⌨ Setas ou WASD<br><button class="button ghost sm" data-action="snake-retry">↻ Reiniciar</button></div></div>`;
 return `<section class="game-fullscreen panel panel-glow"><header class="game-toolbar"><span class="pill">✦ +24 XP &nbsp; ◉ +18 PixelCoins</span><div class="inline">${button('toggle-hint',APP.hint?'Ocultar dica':'💡 Dica','ghost sm')}${button('cancel-game','← Jogos','ghost sm')}</div></header><div id="game-hint" class="compact-hint" ${APP.hint?'':'hidden'}>${esc(r.hint)}</div><div class="game-center game-${g.type}">${stage}</div></section>`;
}
function renderGames(){if(APP.game)return renderGameActive();
 const games=[{id:'pattern',title:'Laboratório de Padrões',desc:'Descubra a regra e complete o código.',skills:'Padrões e dedução'},{id:'bridges',title:'Labirinto de Pontes',desc:'Gire pontes e conecte as ilhas.',skills:'Planejamento e lógica'},{id:'snake',title:'ByteSnake Matemática',desc:'Colete números pares!',skills:'Numeracia e atenção'}];
 const small=window.innerWidth<700;APP.arcadeIndex=Math.max(0,Math.min(games.length-1,APP.arcadeIndex));
 const shown=small?[games[APP.arcadeIndex]]:games;
 return `<section class="arcade-screen"><div class="compact-heading"><h1>Arcade BytePets</h1><p>Desafios jogáveis para aprender pensando.</p><span class="pill">Partidas hoje: ${APP.me.gameDaily.used}/${APP.me.gameDaily.limit}</span></div><div class="arcade-grid">${shown.map(g=>`<article class="arcade-card"><img src="${gameThumb(g.id)}" alt="Cena do jogo ${esc(g.title)}"><div class="arcade-info"><h2>${esc(g.title)}</h2><p>${esc(g.desc)}</p><span class="tiny status">${esc(g.skills)}</span>${button('start-game','▶ Jogar','full',`data-type="${g.id}" ${APP.me.gameDaily.remaining<=0?'disabled title="Limite diário atingido"':''}`)}</div></article>`).join('')}</div>${small?`<div class="game-carousel-controls">${button('arcade-page','← Anterior','ghost',`data-step="-1" ${APP.arcadeIndex===0?'disabled':''}`)}<span>${APP.arcadeIndex+1} de ${games.length}</span>${button('arcade-page','Próximo →','ghost',`data-step="1" ${APP.arcadeIndex===games.length-1?'disabled':''}`)}</div>`:''}</section>`;
}
function answerValue(q){
 if(APP.answer!==null&&APP.answer!==undefined)return APP.answer;
 if(q.type==='multiple')return [];
 if(q.type==='matching')return {};
 if(q.type==='ordering')return [...q.options];
 return q.type==='boolean'?null:'';
}
function renderQuestionControls(q){const a=answerValue(q);if(q.type==='single'){return q.options.map(opt=>`<button class="quiz-answer ${a===opt?'selected':''}" data-action="answer-select" data-value="${esc(opt)}"><span class="radio-mark"></span>${esc(opt)}</button>`).join('')}
 if(q.type==='boolean')return `<div class="two-cols">${((q.options||['Verdadeiro','Falso']).map(label=>[String(label).toLowerCase().includes('verdadeiro'),label])).map(([b,title])=>`<button class="quiz-answer ${a===b?'selected':''}" data-action="answer-boolean" data-value="${b}"><span class="radio-mark"></span>${title}</button>`).join('')}</div>`;
 if(q.type==='multiple')return q.options.map(opt=>`<button class="quiz-answer ${a.includes(opt)?'selected':''}" data-action="answer-multiple" data-value="${esc(opt)}">${a.includes(opt)?'☑':'□'} ${esc(opt)}</button>`).join('');
 if(q.type==='short')return `<label for="short-answer" class="form-label">Sua resposta</label><input id="short-answer" class="field" type="text" maxlength="100" placeholder="Escreva aqui..." value="${esc(a)}">`;
 if(q.type==='ordering')return `<div class="stack">${a.map((id,i)=>`<div class="mini-card"><span class="gold">${i+1}.</span><div class="grow">${esc(typeof id==='object'?id.label||id.id:id)}</div>${button('answer-order','↑','ghost sm',`data-index="${i}" data-shift="-1" ${i===0?'disabled':''}`)}${button('answer-order','↓','ghost sm',`data-index="${i}" data-shift="1" ${i===a.length-1?'disabled':''}`)}</div>`).join('')}</div>`;
 if(q.type==='matching'&&q.options?.left&&q.options?.right){return `<div class="stack">${q.options.left.map(o=>`<div class="mini-card"><div class="grow">${esc(o.label||o.id)} ${o.image?`<img width="54" height="54" src="${o.image}" alt="">`:''}</div>⇄<select class="field" data-match="${esc(o.id)}"><option value="">Escolha...</option>${q.options.right.map(r=>`<option value="${esc(r.id)}" ${a[o.id]===r.id?'selected':''}>${esc(r.label||r.id)}</option>`).join('')}</select></div>`).join('')}</div>`;}
 return '<p>Formato ainda não configurado.</p>';
}
function displayAnswer(ans){
 if(ans===null||ans===undefined)return 'Sem resposta';
 if(typeof ans==='boolean')return ans?'Verdadeiro':'Falso';
 if(Array.isArray(ans))return ans.join(' → ');
 if(typeof ans==='object')return Object.entries(ans).map(([a,b])=>`${a}: ${b}`).join('; ');
 return String(ans);
}
function tierInfo(tier){return {ouro:['OURO','🥇','Excelente! Você dominou este módulo.','gold'],prata:['PRATA','🥈','Ótimo progresso! Refaça para conquistar o ouro.','silver'],bronze:['BRONZE','🥉','Você completou a missão! Cada tentativa ensina mais.','bronze']}[tier]||['SEM MEDALHA','☆','Continue praticando.',''];}
function renderTestFeedback(){
 const o=APP.outcome;if(!o)return '';const finished=o.complete;
 return `<section class="test-feedback panel ${o.correct?'correct':'incorrect'}"><div class="outcome-stars">${o.correct?'✦ ★ ✦':'✧ ✦ ✧'}</div><img src="${petImg(o.correct?'happy':'idle',APP.me.pet.skin)}" alt="Mascote animador"><h1>${o.correct?'PARABÉNS!':'QUASE LÁ!'}</h1><strong>${o.correct?'Resposta correta!':'Você concluiu esta questão. Vamos aprender com ela!'}</strong><div class="explanation-box"><span>💡 Entenda a resposta</span><p>${esc(o.explanation||'Continue investigando e experimentando.')}</p>${!o.correct?`<p><b>Resposta correta:</b> ${esc(displayAnswer(o.correctAnswer))}</p>`:''}</div>
 ${button('outcome-next',finished?'Ver resultado do módulo →':'Próxima questão →','gold')}</section>`;
}
function renderTestSummary(){const r=APP.challengeRun;const tier=r.medalTier,info=tierInfo(tier),pct=r.percent??0;
 const last=APP.lastFeedback;
 return `<section class="test-summary panel"><div class="medal-graphic ${info[3]}">${info[1]}</div><div><span class="eyebrow">MÓDULO CONCLUÍDO</span><h1>Medalha de ${info[0]}</h1><p>${esc(info[2])}</p><div class="score-highlight"><strong>${r.correctCount} / ${r.total}</strong><span>respostas corretas · ${pct}%</span></div>${last?`<div class="explanation-box"><b>Última questão</b><p>${esc(last.explanation||'Continue explorando este assunto.')}</p>${!last.correct?`<small>Resposta correta: ${esc(displayAnswer(last.correctAnswer))}</small>`:''}</div>`:''}<div class="summary-actions">${button('review-module','Rever teste e explicações','secondary')}${tier==='ouro'?'':button('retake-module','Refazer teste completo','gold',`data-id="${r.module.id}"`)}${button('back-modules','Voltar aos módulos','ghost')}</div></div></section>`;
}
function renderTestReview(){const r=APP.challengeRun;if(r.status!=='completed')return '';
 APP.reviewIndex=Math.min(Math.max(0,APP.reviewIndex),r.total-1);const q=r.questions[APP.reviewIndex];
 return `<section class="test-review panel"><div class="inline-between"><div><span class="eyebrow">REVISÃO DO TESTE</span><h2>${esc(r.module.title)}</h2></div><span class="pill">${APP.reviewIndex+1}/${r.total}</span></div><div class="review-counters">${r.questions.map((x,i)=>`<button class="review-chip ${x.correct?'good':'bad'} ${i===APP.reviewIndex?'active':''}" data-action="review-jump" data-index="${i}" aria-label="Revisar questão ${i+1}">${x.correct?'✓':'×'} ${i+1}</button>`).join('')}</div><div class="review-question"><h3>${esc(q.prompt)}</h3>${q.mediaPath?`<img class="quiz-media" src="${q.mediaPath}" alt="Imagem da questão">`:''}<p><b>Sua resposta:</b> ${esc(displayAnswer(q.chosen))}</p><p><b>Resposta correta:</b> ${esc(displayAnswer(q.correctAnswer))}</p><div class="explanation-box"><b>Por quê?</b><p>${esc(q.explanation||'Reveja os conceitos deste desafio.')}</p></div></div><div class="review-actions">${button('review-prev','← Anterior','secondary',APP.reviewIndex===0?'disabled':'')}${button('review-next','Próxima →','secondary',APP.reviewIndex===r.total-1?'disabled':'')}${button('review-summary','Resultado do módulo','gold')}</div></section>`;
}
function renderChallenges(){
 if(!APP.modules)return '<div class="panel">Carregando desafios...</div>';
 if(!APP.moduleId){const total=APP.modules.length,per=window.innerWidth<700?1:6,start=Math.min(APP.modulePage||0,Math.max(0,Math.ceil(total/per)-1)),groups=APP.modules.slice(start*per,(start+1)*per);const pages=Math.ceil(total/per);
  return `<section class="modules-screen"><div class="compact-heading"><h1>Desafios de aprendizagem</h1><p>Conclua testes, aprenda com os erros e conquiste medalhas.</p></div><div class="module-tiles">${groups.map(m=>`<article class="card module-card"><div class="eyebrow">${esc(m.subject)}</div><h2>${esc(m.title)}</h2><p class="muted minor">${esc(m.description)}</p><div class="module-stats"><span>${m.completed?`Melhor tentativa: ${m.bestPercent}%`:`${m.total} questões`}</span><span>${m.medalTier?tierInfo(m.medalTier)[1]+' '+tierInfo(m.medalTier)[0]:'☆ Nova missão'}</span></div>${button('open-module',m.completed?'Rever teste':'Iniciar teste','full',`data-id="${m.id}"`)}${m.completed&&m.medalTier!=='ouro'?button('retake-module','Refazer teste','secondary full',`data-id="${m.id}"`):''}</article>`).join('')}</div>${pages>1?`<div class="module-pager">${button('modules-page','Anterior','ghost sm',`data-step="-1" ${start===0?'disabled':''}`)}${start+1} / ${pages}${button('modules-page','Próxima','ghost sm',`data-step="1" ${start>=pages-1?'disabled':''}`)}</div>`:''}</section>`;}
 if(!APP.challengeRun)return '<div class="panel">Carregando tentativa...</div>';
 if(APP.challengeView==='review')return renderTestReview();
 if(APP.challengeView==='summary')return renderTestSummary();
 if(APP.outcome?.kind==='quiz')return renderTestFeedback();
 const r=APP.challengeRun;
 if(r.status==='completed')return renderTestSummary();
 const q=r.questions[r.answered];if(!q)return '<div class="panel">Preparando resultado...</div>';
 APP.questionIndex=r.answered;
 const progress=Math.round(r.answered/r.total*100);
 return `<section class="test-screen"><div class="test-toolbar"><div><span class="eyebrow">TESTE • ${esc(r.module.subject)}</span><h2>${esc(r.module.title)}</h2></div><span class="pill">Questão ${r.answered+1} de ${r.total}</span></div><div class="test-progress"><i style="width:${progress}%"></i></div><div class="test-question-panel panel"><h1>${esc(q.prompt)}</h1>${q.mediaPath?`<img class="quiz-media" src="${q.mediaPath}" alt="Imagem de apoio">`:''}<div class="quiz-options">${renderQuestionControls(q)}</div><div class="test-actions">${button('back-modules','Sair do teste','ghost')}${button('submit-answer','Responder','gold')}</div><small>Você pode alterar a resposta antes de clicar em Responder.</small></div></section>`;
}
function renderFriends(){if(!APP.social)return '<div class="panel">Carregando amigos...</div>';
 const s=APP.social;if(APP.visitor)return `<section class="friends-visit"><div class="inline-between">${heading('Visita a '+APP.visitor.account.username,'Veja o pet e as decorações do amigo.')} ${button('close-visitor','Sair','ghost sm')}</div><div class="panel">${scene(APP.visitor,true)}</div></section>`;
 const per=window.innerWidth<700?3:5;
 const maximum=Math.max(1,Math.ceil(Math.max(s.friends.length,s.classmates.length,s.requests.length)/per));APP.socialPage=Math.min(APP.socialPage,maximum-1);
 const offset=APP.socialPage*per;
 return `<section class="friends-screen"><div class="compact-heading"><h1>Amigos e turma</h1><p>Visitas autorizadas a outros BytePets.</p></div><div class="friends-columns"><section class="panel"><h2>Amigos</h2><form id="friend-form" class="inline"><input class="field" name="username" placeholder="Apelido do amigo" maxlength="20" required><button class="button" type="submit">Convidar</button></form><div class="friends-list">${s.friends.slice(offset,offset+per).map(x=>`<div class="staff-list-row"><strong>${esc(x.username)}</strong><small>Nível ${x.level}</small>${button('visit','Visitar','secondary sm',`data-id="${x.id}"`)}</div>`).join('')||'<p class="muted">Nenhum amigo nesta página.</p>'}</div><h3>Pedidos recebidos</h3>${s.requests.slice(offset,offset+per).map(x=>`<div class="staff-list-row"><strong>${esc(x.username)}</strong>${button('accept-friend','Aceitar','gold sm',`data-id="${x.id}"`)}</div>`).join('')||'<p class="muted minor">Sem pedidos pendentes.</p>'}</section><section class="panel"><h2>Colegas da turma</h2><p class="muted minor">Somente colegas que permitiram visitas.</p><div class="friends-list">${s.classmates.slice(offset,offset+per).map(x=>`<div class="staff-list-row"><strong>${esc(x.username)}</strong><small>Nível ${x.level}</small>${button('visit','Visitar','secondary sm',`data-id="${x.id}"`)}</div>`).join('')||'<p class="muted">Nenhum colega disponível.</p>'}</div><label class="mini-card"><input type="checkbox" id="allow-visits" ${APP.me.account.allow_visits?'checked':''}> Permitir visitas dos colegas</label><small class="muted">Somente apelido, mascote e decoração; não há chat livre.</small></section></div>${maximum>1?`<div class="module-pager">${button('friends-page','Anterior','ghost sm',`data-step="-1" ${APP.socialPage===0?'disabled':''}`)}${APP.socialPage+1}/${maximum}${button('friends-page','Próxima','ghost sm',`data-step="1" ${APP.socialPage===maximum-1?'disabled':''}`)}</div>`:''}</section>`;
}
function renderStaffVisit(){
 if(!APP.visitor)return '';
 return `<div class="staff-visit-screen"><div class="inline-between"><div>${heading('Visita a '+APP.visitor.account.username,'O guia institucional aparece ao lado do BytePet do estudante.')}</div>${button('close-visitor','← Encerrar visita','ghost')}</div><div class="panel panel-glow">${scene(APP.visitor,true)}<div class="scene-bottom"><span class="pill">Visita autorizada • sem cuidados ou alteracoes no pet</span>${button('open-mentor-note','Enviar um recado educativo','secondary',`data-id="${APP.visitor.account.id}"`)}</div></div></div>`;
}
function renderMentorMessages(){
 if(!APP.mentorMessages?.length)return '';
 return `<section class="panel mentor-inbox"><div class="eyebrow">RECADINHOS PEDAGOGICOS</div><h2>Seus professores mandaram mensagens!</h2>${APP.mentorMessages.slice(0,3).map(m=>`<div class="mini-card"><img src="/assets/pets/mentor_teacher.png" alt="Professor" width="58"><div class="grow"><b>${esc(m.sender_username)}</b><p>${esc(m.message)}</p></div>${!m.read_at?button('mentor-read','Entendi','secondary sm',`data-id="${m.id}"`):'<span class="pill">Lido ✓</span>'}</div>`).join('')}</section>`;
}
function staffPager(list,per=5){
 const max=Math.max(0,Math.ceil(list.length/per)-1);
 APP.staffPage=Math.min(APP.staffPage,max);
 return {rows:list.slice(APP.staffPage*per,(APP.staffPage+1)*per),max};
}
function staffPageControls(max){return max>0?`<div class="staff-page-controls">${button('staff-pager','← Anterior','ghost sm',`data-step="-1" ${APP.staffPage<=0?'disabled':''}`)}<span>Página ${APP.staffPage+1} / ${max+1}</span>${button('staff-pager','Próxima →','ghost sm',`data-step="1" ${APP.staffPage>=max?'disabled':''}`)}</div>`:'';}
function renderSchool(){
 const schools=APP.me.schools||[],active=schools.find(s=>s.id===APP.schoolId),role=active?.role;
 if(!role)return `<section class="panel school-student-screen">${heading('Minha escola','Aprendizagens da sua turma')}<div class="mini-card">${(APP.me.classes||[]).map(c=>esc(c.name)).join(' · ')||'Aguarde sua turma'} ${button('go-challenges','Abrir desafios','gold sm')}</div></section>`;
 const sd=APP.schoolData,roster=APP.schoolRoster;
 if(!sd)return `<div class="panel">Carregando escola...</div>`;
 const manager=role==='manager',list=roster?.roster||[],teachers=roster?.teachers||[],requests=roster?.requests||[],classes=roster?.classes||sd.classes||[];
 const links=manager?[['overview','Visão geral'],['students','Alunos'],['teachers','Professores'],['classes','Turmas'],['tests','Testes'],['reports','Resultados'],['visits','Visitas'],['settings','Configurações']]:[['overview','Visão geral'],['students','Alunos'],['classes','Minhas turmas'],['tests','Testes'],['reports','Resultados'],['visits','Visitas']];
 const section=APP.staffSection||'overview';
 let body='';
 if(section==='overview'){
  body=`<div class="staff-overview-grid">
  ${[['Turmas',classes.length,'school'],['Alunos',list.length,'friends'],['Professores',sd.teachers.length,'school'],['Módulos',sd.modules.length,'challenges']].map(([t,v,k])=>`<div class="panel staff-metric">${uiIcon(k)}<span>${t}</span><strong>${v}</strong></div>`).join('')}
  </div><div class="staff-feature-grid">
  ${links.filter(([k])=>k!=='overview').map(([k,t])=>`<button class="staff-feature panel" data-action="staff-switch" data-section="${k}">${uiIcon(k==='students'?'friends':k==='tests'?'challenges':k==='reports'?'badges':k==='visits'?'home':'school')}<strong>${t}</strong><span>${k==='students'?'Matrículas e perfis':k==='teachers'?'Educadores e convites':k==='classes'?'Lista e cadastro de turmas':k==='settings'?'Limite diário de jogos':k==='tests'?'Módulos e questões':k==='reports'?'Avaliações da turma':'Habitats autorizados'}</span>→</button>`).join('')}</div>`;
 }else if(section==='students'){
  const page=staffPager(list,5);
  body=`<div class="staff-content-grid"><section class="panel staff-content-primary"><div class="inline-between"><h2>Alunos cadastrados</h2><span class="pill">${list.length} matrícula(s)</span></div>
  ${page.rows.map(a=>`<div class="staff-list-row"><div><strong>${esc(a.student_name)}</strong><small>${esc(a.enrollment)} · ${esc(a.class_name)}</small></div><span class="pill">${a.account_id?'Ativo':'Aguardando'}</span>${manager&&!a.account_id?button('reissue-student-code','Novo código','ghost sm',`data-id="${a.id}"`):''}</div>`).join('')||'<p class="muted">Nenhum aluno cadastrado.</p>'}
  ${staffPageControls(page.max)}</section>
  ${manager?`<form id="roster-form" class="panel staff-form-panel"><h2>Nova matrícula</h2><p class="muted minor">O aluno utiliza apenas o código entregue pela escola.</p><label class="form-label">Nome institucional</label><input class="field" name="studentName" placeholder="Nome completo" minlength="3" maxlength="120" required><label class="form-label">Número de matrícula</label><input class="field" name="enrollment" pattern="[0-9]{4,20}" placeholder="Ex.: 20260024" required><label class="form-label">Turma</label><select class="field" name="classId" required><option value="">Selecionar</option>${sd.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="button full" type="submit">Cadastrar aluno</button>${APP.newActivation?`<div class="activation-result"><strong>Código do estudante</strong><p class="student-secret">${esc(APP.newActivation.studentCode||APP.newActivation.activationCode)}</p><small>Entregue ao responsável. Não será exibido novamente.</small></div>`:''}</form>`:''}</div>`;
 }else if(section==='classes'){
  const page=staffPager(classes,5);
  body=`<div class="staff-content-grid"><section class="panel staff-content-primary"><div class="inline-between"><div><h2>Turmas da instituição</h2><p class="muted minor">Consulte professores vinculados e alunos por turma.</p></div><span class="pill">${classes.length} turma(s)</span></div>
   <div class="staff-list-head"><span>Turma</span><span>Alunos</span><span>Professor(es)</span></div>
   ${page.rows.map(c=>{const t=roster?.assignments?.filter(a=>a.class_id===c.id).map(a=>teachers.find(x=>x.id===a.account_id)?.username).filter(Boolean)||[];return `<div class="staff-class-row"><strong>${esc(c.name)}</strong><span>${list.filter(x=>x.class_id===c.id).length}</span><span>${t.length?esc(t.join(', ')):'A definir'}</span></div>`}).join('')||'<div class="staff-empty">Nenhuma turma cadastrada. Crie a primeira turma ao lado.</div>'}
   ${staffPageControls(page.max)}</section>
   ${manager?`<form id="create-class-form" class="panel staff-form-panel"><h2>+ Criar turma</h2><p class="muted minor">Organize estudantes e vincule os professores depois.</p><label class="form-label">Nome da turma</label><input class="field" name="name" maxlength="55" minlength="2" placeholder="Ex.: 5º ano A" required><button class="button full" type="submit">Criar turma</button><div class="staff-hint">Ao criar, ela aparecerá nesta lista e no cadastro dos alunos.</div></form>`:`<section class="panel staff-form-panel"><h2>Minhas turmas</h2><p class="muted">Consulte a relação de alunos em Alunos e seus resultados em Resultados.</p></section>`}</div>`;
 }else if(section==='teachers'){
  const teacherPage=staffPager(teachers,5);
  body=`<div class="staff-content-grid"><section class="panel staff-content-primary"><div class="inline-between"><h2>Professores cadastrados</h2><span class="pill">${teachers.length} aprovado(s)</span></div>
   ${teacherPage.rows.map(t=>{const assigned=roster?.assignments?.filter(a=>a.account_id===t.id).map(a=>classes.find(x=>x.id===a.class_id)?.name).filter(Boolean)||[];return `<div class="staff-list-row"><img class="teacher-list-avatar" src="/assets/pets/mentor_teacher.png" alt="Mascote professor"><div class="grow"><strong>${esc(t.username)}</strong><small>${assigned.length?'Turmas: '+esc(assigned.join(' · ')):'Sem turma atribuída'}</small></div><span class="pill">Ativo</span></div>`}).join('')||'<p class="muted">Nenhum professor aprovado. Gere um convite para começar.</p>'}
   ${staffPageControls(teacherPage.max)}<h3>Solicitações aguardando aprovação</h3>${requests.slice(0,3).map(x=>`<div class="staff-list-row"><strong>${esc(x.username)}</strong>${button('approve-teacher','Aprovar','gold sm',`data-id="${x.id}"`)}${button('reject-teacher','Rejeitar','ghost sm',`data-id="${x.id}"`)}</div>`).join('')||'<p class="muted minor">Nenhuma solicitação pendente.</p>'}</section>
   <div class="staff-stack"><section class="panel staff-form-panel"><h2>Convite para professor</h2><p class="muted minor">Convites individuais válidos por sete dias; exigem aprovação.</p>${button('create-teacher-invite','Gerar link de cadastro','secondary full')}${APP.teacherInviteUrl?`<input class="field" readonly aria-label="Link do professor" value="${esc(APP.teacherInviteUrl)}">`:''}</section>
   <form id="assign-teacher-form" class="panel staff-form-panel"><h2>Vincular professor a turma</h2><select class="field" name="teacherId" required><option value="">Selecione o professor</option>${teachers.map(x=>`<option value="${x.id}">${esc(x.username)}</option>`).join('')}</select><select class="field" name="classId" required><option value="">Selecione a turma</option>${classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="button full" type="submit">Vincular professor</button></form></div></div>`;
 }else if(section==='tests'){
  body=`<div class="staff-content-grid"><section class="panel"><div class="inline-between"><h2>Módulos e testes</h2><span class="pill">${sd.modules.length}</span></div>
  ${sd.modules.slice(0,6).map(m=>`<div class="staff-list-row"><div><strong>${esc(m.title)}</strong><small>${esc(m.subject)} · ${m.published?'Publicado':'Rascunho'}</small></div>${button('edit-school-module',m.published?'Ver':'Editar','secondary sm',`data-id="${m.id}"`)}</div>`).join('')||'<p class="muted">Nenhum módulo criado.</p>'}
  </section><div class="staff-stack">${APP.schoolModuleId?renderSchoolEditor(sd):`<form id="create-module-form" class="panel staff-form-panel"><h2>Criar módulo</h2><label class="form-label">Título</label><input class="field" name="title" placeholder="Ex.: Ciências e natureza" required><label class="form-label">Disciplina</label><input class="field" name="subject" placeholder="Ex.: Biologia" required><label class="form-label">Objetivo</label><textarea class="field" name="description" placeholder="Objetivo educacional"></textarea><button class="button full" type="submit">Criar módulo</button></form>`}</div></div>`;
 }else if(section==='reports'){
  const report=APP.schoolReport?.schoolId===APP.schoolId?APP.schoolReport:null;
  const classIndex=Math.min(APP.staffClassIndex||0,Math.max(0,(report?.classes?.length||1)-1));
  const c=report?.classes?.[classIndex],filteredModule=APP.staffReportModule||'all';
  const students=c?.students||[],page=staffPager(students,5);
  const summary=c?.summary||{students:0,assignedModules:0,averagePercent:0};
  body=`<section class="panel staff-reports"><div class="inline-between"><div><h2>Resultados por turma e módulo</h2><p class="muted minor">Melhor tentativa completa, medalha e pontuação de cada aluno.</p></div>${button('load-school-report','↻ Atualizar dados','secondary sm')}</div>
   ${report?`<div class="report-filters"><label>Turma<select id="report-class" class="field">${report.classes.map((t,i)=>`<option value="${i}" ${i===classIndex?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label>Módulo<select id="report-module" class="field"><option value="all">Todos os módulos</option>${(c?.modules||[]).map(m=>`<option value="${m.id}" ${filteredModule===m.id?'selected':''}>${esc(m.title)}</option>`).join('')}</select></label></div>
   <div class="report-summary-grid"><span><b>${summary.students}</b> alunos</span><span><b>${summary.assignedModules}</b> módulos</span><span><b>${summary.averagePercent}%</b> média de acertos</span></div>
   <div class="staff-result-table"><div class="report-head"><span>Aluno</span><span>Acertos</span><span>Pontuação</span><span>Medalha</span><span>Detalhes</span></div>
   ${page.rows.map(a=>{const g=filteredModule==='all'?null:a.grades.find(x=>x.moduleId===filteredModule);const ratio=g?`${g.correct}/${g.total}`:`${a.passed}/${a.total}`;const points=g?`${g.score}/${g.maxScore}`:`${a.points}/${a.maxPoints}`;const tier=g?.medalTier||null;return `<div class="report-line"><strong>${esc(a.studentName)}<small>${esc(a.enrollment||a.username)}</small></strong><span>${ratio}</span><span>${points}</span><span class="report-medal">${tier?{ouro:'🥇 Ouro',prata:'🥈 Prata',bronze:'🥉 Bronze'}[tier]:'—'}</span>${button('staff-student-detail','Ver boletim','secondary sm',`data-id="${a.id}"`)}</div>`}).join('')||'<p class="muted">Nenhum aluno cadastrado nesta turma.</p>'}</div>${staffPageControls(page.max)}
   <p class="muted tiny">Notas calculadas apenas de testes integralmente concluídos. Testes não realizados aparecem com zero e sem medalha.</p>
   `:'<div class="staff-empty">Carregando resultados…</div>'}</section>`;
 }else if(section==='settings'){
  body=manager?`<div class="staff-settings-layout"><form id="daily-limit-form" class="panel staff-settings-card"><div class="eyebrow">CONFIGURAÇÕES DA INSTITUIÇÃO</div><h2>Limite diário de jogos</h2><p class="muted">Defina quantas partidas cada aluno pode iniciar por dia. Os desafios escolares não entram neste limite.</p><label class="form-label" for="daily-game-limit">Partidas por aluno / dia</label><select class="field" id="daily-game-limit" name="limit" required>${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===Number(sd.school.daily_game_limit||5)?'selected':''}>${n} partida${n===1?'':'s'}</option>`).join('')}</select><p class="tiny-info">Atual: ${sd.school.daily_game_limit||5} partida(s). A contagem é diária, no horário de Belém.</p><button class="button full" type="submit">Salvar limite de jogos</button></form><section class="panel staff-settings-card"><h2>Política de uso equilibrado</h2><p>Depois de atingir o limite, o aluno recebe uma mensagem para descansar. O uso de testes escolares permanece disponível.</p><div class="staff-hint">Apenas administradores podem alterar este limite. Professores visualizam os jogos disponíveis dos seus alunos.</div></section></div>`:'<div class="panel">Configurações disponíveis somente para a administração.</div>';
 }else if(section==='visits'){
  const approved=list.filter(x=>x.account_id);const page=staffPager(approved,5);
  body=`<section class="panel"><h2>Visitas pedagógicas</h2><p class="muted minor">O mascote institucional acompanha o aluno, sem alterar o pet ou suas moedas.</p>${page.rows.map(x=>`<div class="staff-list-row"><img src="/assets/pets/student_avatar.png" width="44" height="44" alt=""><div><strong>${esc(x.student_name)}</strong><small>${esc(x.class_name)}</small></div>${button('visit','Visitar','secondary sm',`data-id="${x.account_id}"`)}${button('open-mentor-note','Recado','ghost sm',`data-id="${x.account_id}"`)}</div>`).join('')||'<p class="muted">Nenhum aluno ativo.</p>'}${staffPageControls(page.max)}</section>`;
 }
 return `<div class="staff-screen"><div class="staff-screen-title"><img src="${staffSprite()}" alt="Guia institucional"><div><div class="eyebrow">${manager?'ORION • ADMINISTRAÇÃO':'LUNA • PROFESSOR'}</div><h1>${links.find(x=>x[0]===section)?.[1]||'Painel escolar'}</h1><p>${esc(sd.school.name)} · ${manager?'Gestão institucional':'Turmas vinculadas'}</p></div><span class="staff-marker">${manager?'GESTOR':'DOCENTE'}</span></div><div class="staff-screen-body mobile-view-${APP.staffMobileView}">${(section==='students'&&manager||section==='teachers'&&manager||section==='classes'&&manager||section==='tests')?`<div class="staff-mobile-tabs">${button('staff-mobile-tab','Consultar',APP.staffMobileView==='list'?'sm':'ghost sm',`data-tab="list"`)}${button('staff-mobile-tab',section==='students'?'Cadastrar':section==='classes'?'Criar turma':section==='tests'?'Criar / Editar':'Gerenciar',APP.staffMobileView==='edit'?'sm':'ghost sm',`data-tab="edit"`)}</div>`:''}${body}</div></div>`;
}
function renderSchoolEditor(sd){
 const m=sd.modules.find(x=>x.id===APP.schoolModuleId);if(!m)return '';
 if(m.published)return `<section class="panel staff-form-panel"><h2>${esc(m.title)}</h2><p>Este módulo está publicado e suas questões foram preservadas para manter as notas.</p>${button('editor-cancel','Criar outro módulo','secondary')}</section>`;
 const draft=APP.questionDraft||{},step=APP.editorStep||'details';
 const tabs=`<div class="editor-tabs">${[['details','1. Dados'],['answers','2. Respostas'],['publish','3. Publicar']].map(([k,t])=>button('editor-tab',t,step===k?'sm':'ghost sm',`data-step="${k}"`)).join('')}</div>`;
 const title=`<div class="editor-heading"><div class="eyebrow">EDITOR PEDAGÓGICO</div><h2>${esc(m.title)}</h2>${tabs}</div>`;
 if(step==='details')return `<section class="panel editor-stage">${title}<form id="question-meta" class="editor-form"><label>Tipo de questão</label><select class="field" name="type">${[['single','Escolha única'],['multiple','Múltipla escolha'],['boolean','Verdadeiro ou falso'],['short','Resposta curta'],['matching','Associação'],['ordering','Ordenar etapas']].map(([k,t])=>`<option value="${k}" ${draft.type===k?'selected':''}>${t}</option>`).join('')}</select><label>Enunciado</label><textarea class="field" name="prompt" required maxlength="800" placeholder="O que o aluno precisa responder?">${esc(draft.prompt||'')}</textarea><label>Explicação pedagógica</label><textarea class="field" name="explanation" placeholder="Explique por que a resposta está correta">${esc(draft.explanation||'')}</textarea><label>Pontos (1 a 50)</label><input class="field" type="number" min="1" max="50" name="score" value="${esc(draft.score||10)}"><label>Imagem de apoio (opcional)</label><div class="inline"><input class="field" id="question-file" type="file" accept="image/png,image/jpeg,image/webp">${button('upload-school-image','Adicionar imagem','secondary sm')}${APP.mediaPath?`<img width="42" height="42" src="${APP.mediaPath}" alt="Prévia">`:''}</div><div class="editor-footer">${button('editor-cancel','← Módulos','ghost')}${button('editor-next','Avançar para respostas →','gold')}</div></form></section>`;
 if(step==='answers')return `<section class="panel editor-stage">${title}<form id="teacher-question-form" class="editor-form"><p class="muted minor">${draft.type==='boolean'?'Use VERDADEIRO ou FALSO no gabarito.':draft.type==='matching'?'Use JSON para pares de associação.':'Separe as alternativas por linha e indique o gabarito.'}</p><label>Alternativas (uma por linha)</label><textarea class="field editor-options" name="options" placeholder="Alternativa A
Alternativa B
Alternativa C">${esc(draft.options||'')}</textarea><label>Resposta correta / gabarito</label><textarea class="field" name="answer" required placeholder="Ex.: Alternativa A">${esc(draft.answer||'')}</textarea><div class="editor-footer">${button('editor-back','← Dados da questão','ghost')}<button class="button gold" type="submit">✓ Salvar questão</button></div><p class="muted tiny">Após salvar, você poderá adicionar outra questão ou publicar o módulo.</p></form></section>`;
 return `<section class="panel editor-stage">${title}<div class="editor-publish"><h3>Publicar e atribuir para uma turma</h3><p class="muted">Revise as questões antes da publicação. Depois, o gabarito ficará protegido para manter avaliações consistentes.</p><form id="publish-form" class="stack"><label>Turma</label><select class="field" name="classId" required><option value="">Selecione a turma</option>${sd.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button class="button gold" type="submit">Publicar teste nesta turma</button></form><div class="editor-footer">${button('editor-tab','← Voltar ao editor','secondary',`data-step="details"`)}${button('editor-cancel','Voltar aos módulos','ghost')}</div></div></section>`;
}
function renderReportStudentDetail(){
 const c=APP.schoolReport?.classes?.[APP.staffClassIndex||0],a=c?.students?.find(s=>s.id===APP.staffStudentDetail);
 if(!a)return '';
 return `<div class="modal-backdrop staff-grade-modal" role="dialog" aria-modal="true" aria-label="Boletim do aluno"><section class="panel modal"><div class="inline-between"><div><span class="eyebrow">BOLETIM DE APRENDIZAGEM</span><h2>${esc(a.studentName)}</h2><p class="muted minor">${esc(c?.name)} · ${esc(a.enrollment||a.username)}</p></div>${button('staff-student-detail-close','Fechar ×','ghost sm')}</div><div class="grade-modal-list">${a.grades.map(g=>`<div class="grade-modal-row"><div><strong>${esc(g.moduleTitle)}</strong><small>${esc(g.subject)} · ${g.attempts} tentativa(s) concluída(s)</small></div><span>${g.correct}/${g.total} · ${g.percent}%</span><span>${g.medalTier?{ouro:'🥇 Ouro',prata:'🥈 Prata',bronze:'🥉 Bronze'}[g.medalTier]:'Não realizado'}</span></div>`).join('')||'<p>Nenhum módulo atribuído.</p>'}</div></section></div>`;
}
function renderOutcome(){
 const o=APP.outcome;if(!o)return '';
 const win=o.success;
 return `<div class="outcome-stage panel ${win?'outcome-success':'outcome-retry'}"><div class="outcome-stars">${win?'✦ ★ ✦ ★ ✦':'✧ ✦ ✧'}</div><img src="${petImg(win?'happy':'idle')}" alt="BytePet ${win?'feliz':'encorajando voce'}"><div class="eyebrow">${o.kind==='quiz'?'DESAFIO DE APRENDIZAGEM':'JOGO DE RACIOCINIO'}</div><h1>${win?'PARABENS!':'QUASE LA!'}</h1><p class="outcome-title">${esc(o.title|| (win?'Muito bem!':'Voce consegue!'))}</p><p>${win?'Voce deu mais um passo na sua aventura.':(o.explanation||'Respire, observe e tente outra estrategia. Cada tentativa ensina algo novo.')}</p>
 ${win?`<div class="outcome-rewards"><span>✦ +${o.xp??24} XP</span><span>◉ +${o.coins??18} PixelCoins</span>${o.medal?'<span>🏅 Nova medalha!</span>':''}</div>`:''}
 <div class="outcome-actions">${win?(o.kind==='quiz'?button('outcome-next','Proxima questao →','gold'):button('outcome-new-game','Jogar novamente','gold')):button('outcome-retry','↻ Tentar novamente','gold')}${button('outcome-back',o.kind==='quiz'?'Voltar aos modulos':'Voltar aos jogos','secondary')}</div></div>`;
}
function render(){if(APP.page!=='games'&&snakeTimer){clearInterval(snakeTimer);snakeTimer=null}
 if(!APP.me){root.innerHTML=APP.setup?.configured?(renderAuth()):(APP.setupSchoolMode?renderSchoolBootstrap():renderSetupChoice());return;}
 if(APP.me.approval&&APP.me.approval.status!=='approved'){root.innerHTML=renderPending();return;}
 const staff=staffRole();if(staff)APP.page='school';
 const views={home:renderHome,worlds:renderWorlds,games:renderGames,challenges:renderChallenges,shop:renderShop,badges:renderBadges,friends:renderFriends,school:renderSchool};
 const content=APP.outcome?.kind==='game'&&!staff?renderOutcome():staff&&APP.visitor?renderStaffVisit():(views[APP.page]||renderHome)();
 root.innerHTML=`<div class="app ${staff?'staff-app':''}">${renderHeader()}<main>${content}</main>${renderMobileDock()}${APP.staffStudentDetail?renderReportStudentDetail():''}${APP.modal==='mentor-note'?`<div class="mentor-modal-backdrop"><div class="panel mentor-modal"><img src="${staffSprite()}" alt="Mascote guia"><h2>Enviar recado educativo</h2><p class="muted minor">Sem mensagens livres. Escolha uma frase segura para o aluno.</p>${[['congratulations','Parabens pelo esforco!'],['activity','Tem atividade nova!'],['encouragement','Continue tentando!'],['help','Converse comigo na escola']].map(([key,label])=>button('mentor-message-send',label,'secondary full',`data-key="${key}"`)).join('')}${button('close-mentor-modal','Cancelar','ghost')}</div></div>`:''}</div>`;
 if(!APP.outcome&&APP.game?.type==='snake'&&APP.page==='games'){if(!snakeTimer)startSnakeLoop();else APP.snake?.draw?.()}
}
async function refresh(){APP.me=await api('/me');render()}
async function loadSchoolData(){
 if(!APP.schoolId)return;
 const [summary,roster]=await Promise.all([api('/schools/'+APP.schoolId),api('/schools/'+APP.schoolId+'/roster')]);
 APP.schoolData=summary;APP.schoolRoster=roster;
}
async function openPage(page){if(APP.visitor){await api('/visits/leave','POST').catch(()=>{});}if(staffRole())page='school';APP.page=page;APP.game=null;APP.moduleId=null;APP.visitor=null;APP.outcome=null;APP.answer=null;if(snakeTimer){clearInterval(snakeTimer);snakeTimer=null}
 APP.navOpen=false;APP.mobileMore=false;if(page==='challenges')APP.modules=await api('/modules');
 if(page==='friends')APP.social=await api('/social');
 if(page==='school'){APP.schoolId=APP.schoolId||APP.me.schools?.find(s=>s.role==='manager'||s.role==='teacher')?.id||null;if(APP.schoolId){await loadSchoolData();if(APP.staffSection==='reports')APP.schoolReport=await api('/schools/'+APP.schoolId+'/reports');}}
 render();scrollUp()}
async function chooseModule(id,forceNew=false){
 APP.moduleId=id;APP.answer=null;APP.outcome=null;APP.challengeFeedback=null;APP.lastFeedback=null;APP.reviewIndex=0;
 let result;
 if(!forceNew){const latest=await api('/modules/'+id+'/runs/latest');result=latest.run;}
 if(!result||forceNew){const started=await api('/modules/'+id+'/runs','POST',{});result=started.run;}
 APP.challengeRun=result;APP.challengeView=result.status==='completed'?'review':'question';APP.questionIndex=result.answered||0;
 render();
}
function animate(anim,effect){APP.petAnimation=anim;APP.effect=effect;render();setTimeout(()=>{APP.petAnimation='idle';APP.effect=null;if(APP.page==='home')render()},1700)}
function currentQuestion(){return APP.challengeRun?.questions?.[APP.challengeRun.answered]||null}
function captureAnswer(){const q=currentQuestion();if(!q)return null;
 if(q.type==='short')return document.getElementById('short-answer')?.value.trim()||'';
 if(q.type==='matching'){const result={};document.querySelectorAll('[data-match]').forEach(s=>{if(s.value)result[s.dataset.match]=s.value});return result;}
 return answerValue(q);
}
function startSnakeLoop(){const canvas=document.getElementById('snake-canvas');if(!canvas||snakeTimer)return;
 const c=canvas.getContext('2d');if(!c)return;
 const N=12,S=30,targets=APP.game.round.targets;
 APP.snake={body:[[5,5],[4,5],[3,5]],dir:[1,0],next:[1,0],foods:[],collected:[],busy:false};
 function placeFoods(){
  const sn=APP.snake,values=[targets[sn.collected.length],1,3,5,7,9].filter((x,i,a)=>a.indexOf(x)===i);
  const taken=new Set(sn.body.map(v=>v.join(',')));sn.foods=[];
  for(const value of values.slice(0,4)){
   let cell=null;
   for(let i=0;i<180;i++){const x=Math.floor(Math.random()*N),y=Math.floor(Math.random()*N);if(!taken.has(x+','+y)&&Math.abs(x-sn.body[0][0])+Math.abs(y-sn.body[0][1])>1){cell={x,y,number:value};break}}
   if(cell){sn.foods.push(cell);taken.add(cell.x+','+cell.y)}
  }
 }
 placeFoods();
 function draw(){const sn=APP.snake;if(!sn)return;
  c.clearRect(0,0,360,360);c.fillStyle='#07152d';c.fillRect(0,0,360,360);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
   c.fillStyle=(x+y)%2?'#152e5a':'#112850';c.fillRect(x*S+1,y*S+1,S-2,S-2);
   c.fillStyle='#2868a0';c.fillRect(x*S+1,y*S+1,S-2,1);
  }
  for(const {x,y,number} of sn.foods){const good=number===targets[sn.collected.length];
   c.fillStyle=good?'#075b81':'#69305d';c.fillRect(x*S+2,y*S+2,26,26);
   c.strokeStyle=good?'#6afaff':'#ef88c7';c.lineWidth=2;c.strokeRect(x*S+2,y*S+2,26,26);
   c.fillStyle='#f6ffff';c.textAlign='center';c.textBaseline='middle';c.font='bold 18px sans-serif';c.fillText(String(number),x*S+15,y*S+16);
  }
  for(let i=sn.body.length-1;i>=0;i--){const [x,y]=sn.body[i];c.fillStyle=i===0?'#c0fcff':'#43d0ef';c.fillRect(x*S+3,y*S+3,24,24);c.fillStyle='#9cffff';c.fillRect(x*S+6,y*S+6,18,5);if(i===0){c.fillStyle='#102e6e';c.fillRect(x*S+10,y*S+14,3,3);c.fillRect(x*S+18,y*S+14,3,3);c.fillStyle='#e96ac3';c.fillRect(x*S+14,y*S+20,5,2)}}
 }
 function end(message){if(snakeTimer){clearInterval(snakeTimer);snakeTimer=null;}APP.snake.busy=true;APP.outcome={kind:'game',success:false,title:message+' Tente outra vez.'};render();}
 function tick(){const sn=APP.snake;if(!sn||sn.busy)return;const d=sn.next;
  if(d[0]!==-sn.dir[0]||d[1]!==-sn.dir[1])sn.dir=d;
  const head=[sn.body[0][0]+sn.dir[0],sn.body[0][1]+sn.dir[1]];
  if(head.some(v=>v<0||v>=N)||sn.body.slice(0,-1).some(q=>q[0]===head[0]&&q[1]===head[1])){end('Voce bateu!');return;}
  sn.body.unshift(head);const food=sn.foods.find(f=>f.x===head[0]&&f.y===head[1]);
  if(!food){sn.body.pop();draw();return;}
  if(food.number!==targets[sn.collected.length]){end('Este nao era o numero '+targets[sn.collected.length]+'!');draw();return;}
  sn.collected.push(food.number);
  const counter=document.getElementById('snake-counter');if(counter)counter.textContent=sn.collected.length+'/'+targets.length;
  if(sn.collected.length===targets.length){sn.busy=true;clearInterval(snakeTimer);snakeTimer=null;
   api('/games/finish','POST',{sessionId:APP.game.sessionId,answer:sn.collected}).then(r=>{APP.me=r.state;APP.game=null;APP.snake=null;APP.outcome={kind:'game',success:true,title:'ByteSnake concluido!'};render()}).catch(e=>toast(e.message,true));return;
  }
  const next=document.getElementById('snake-target');if(next)next.textContent=String(targets[sn.collected.length]);
  placeFoods();draw();
 }
 APP.snake.draw=draw;draw();snakeTimer=setInterval(tick,420);
}
async function execute(action,el){switch(action){
 case 'setup-normal':await api('/setup','POST',{mode:'normal'});APP.setup={configured:true,mode:'normal'};APP.authMode='register';render();break;
 case 'setup-school':APP.setupSchoolMode=true;render();break;
 case 'setup-back':APP.setupSchoolMode=false;render();break;
 case 'student-register-mode':APP.authMode='register';APP.authContext='student';render();break;
 case 'pending-refresh':APP.me=await api('/me');if(APP.me.approval?.status==='approved'){APP.schoolId=APP.me.schools?.find(x=>x.role==='teacher')?.id||null;if(APP.schoolId)await loadSchoolData();APP.page='school'}render();toast(APP.me.approval?.status==='pending'?'Aguardando aprovacao.':'Situacao atualizada.');break;
 case 'create-teacher-invite':{const r=await api('/schools/'+APP.schoolId+'/teacher-invites','POST');APP.teacherInviteUrl=location.origin+r.path;render();toast('Convite gerado. Copie o link antes de sair desta tela.');break;}
 case 'approve-teacher':case 'reject-teacher':await api('/schools/'+APP.schoolId+'/teacher-requests/'+el.dataset.id,'POST',{approve:action==='approve-teacher'});await loadSchoolData();render();toast('Solicitacao atualizada.');break;

 case 'register-mode':APP.authMode='register';APP.authContext='register';render();break;
 case 'login-mode':APP.authMode='login';APP.authContext='login';render();break;
 case 'logout':{if(APP.visitor)await api('/visits/leave','POST').catch(()=>{});await api('/logout','POST');APP.visitor=null;APP.outcome=null;APP.me=null;APP.page='home';APP.authMode='login';APP.authContext='login';render();break;}
 case 'feed-menu': APP.foodMenu=!APP.foodMenu;render();break;
 case 'choose-food':{const fid=el.dataset.id;assertClient(fid&&owned(fid)>0,'Escolha um alimento na bolsa.');const result=await api('/pet/care','POST',{action:'feed',itemId:fid});APP.me=result.state;APP.foodMenu=false;animate('eat','♥ ♥');toast('Que delícia! Seu pet ganhou energia para recuperar a vida.');break}
 case 'care':{const action=el.dataset.care;const result=await api('/pet/care','POST',{action});APP.me=result.state;APP.foodMenu=false;if(action==='sleep'){APP.petAnimation='idle';APP.effect=null;render();toast('Boa noite! Ele vai descansar até acordar ou recuperar a energia.')}else if(action==='wake'){render();toast('Seu pet acordou!')}else{animate(result.anim,action==='clean'?'✦ ✧':action==='collect'?'✦':'♥ ♥');toast(action==='collect'?'Sujeira recolhida! +3 XP':action==='clean'?'Tudo limpo! Seu BytePet tomou banho.':'Que carinho bom!')}}break;
 case 'go-worlds':await openPage('worlds');break;
 case 'go-games':await openPage('games');break;
 case 'go-challenges':await openPage('challenges');break;
 case 'go-shop':await openPage('shop');break;
 case 'go-friends':await openPage('friends');break;
 case 'go-badges':await openPage('badges');break;
 case 'travel':APP.me=await api('/world/travel','POST',{worldId:el.dataset.id});await openPage('home');toast('Você viajou para '+world(el.dataset.id).name);break;
 case 'buy':APP.me=await api('/shop/buy','POST',{itemId:el.dataset.id,worldId:el.dataset.world||''});render();toast('Item comprado e enviado para seu inventário.');break;
 case 'equip':APP.me=await api('/world/equip','POST',{itemId:el.dataset.id,worldId:APP.me.pet.world_id});render();toast('Decoração equipada neste mundo.');break;
 case 'shop-filter':APP.shopFilter=el.dataset.filter;APP.shopPage=0;render();break;
 case 'skin':APP.me=await api('/pet/skin','POST',{skin:el.dataset.id});render();toast('Skin equipada!');break;
 case 'start-game':APP.outcome=null;APP.lastGameType=el.dataset.type;APP.game=await api('/games/start','POST',{type:el.dataset.type});APP.me.gameDaily=APP.game.daily;APP.hint=false;APP.bridgeSelected=null;APP.bridgeWalking=null;APP.bridgeRot=Object.fromEntries((APP.game.round.tiles||[]).map(t=>[t.id,t.rot]));APP.moveQueue=[];render();scrollUp();break;
 case 'cancel-game':APP.outcome=null;APP.game=null;APP.hint=false;if(snakeTimer){clearInterval(snakeTimer);snakeTimer=null}render();break;
 case 'toggle-hint':APP.hint=!APP.hint;document.getElementById('game-hint')?.toggleAttribute('hidden',!APP.hint);el.textContent=APP.hint?'Ocultar dica':'💡 Dica';break;
 case 'game-answer':{const r=await api('/games/finish','POST',{sessionId:APP.game.sessionId,answer:el.dataset.answer});APP.me=r.state;APP.outcome={kind:'game',success:r.correct,title:r.correct?'Padrao descoberto!':'Observe a sequencia e tente novamente.',xp:24,coins:18};if(r.correct)APP.game=null;render();break}
 case 'bridge-select':APP.bridgeSelected=el.dataset.id;render();break;
 case 'bridge-rotate':{if(!APP.bridgeSelected)break;const id=APP.bridgeSelected;APP.bridgeRot[id]=(APP.bridgeRot[id]+Number(el.dataset.dir)+4)%4;render();break;}
 case 'bridge-reset':APP.bridgeRot=Object.fromEntries((APP.game.round.tiles||[]).map(t=>[t.id,t.rot]));APP.bridgeSelected=null;render();break;
 case 'bridge-submit':{
  const r=await api('/games/finish','POST',{sessionId:APP.game.sessionId,answer:APP.bridgeRot});
  APP.me=r.state;APP.bridgeWalking={path:r.walkPath||[APP.game.round.start],fallAt:r.fallAt||null,step:0,falling:false};render();
  let step=0;const timer=setInterval(()=>{
   if(!APP.bridgeWalking||APP.page!=='games'){clearInterval(timer);return;}
   if(step<APP.bridgeWalking.path.length-1){step++;APP.bridgeWalking.step=step;render();return;}
   clearInterval(timer);
   if(!r.correct){APP.bridgeWalking.falling=true;APP.bridgeWalking.step=APP.bridgeWalking.path.length;render();}
   setTimeout(()=>{APP.bridgeWalking=null;if(r.correct)APP.game=null;APP.outcome={kind:'game',success:Boolean(r.correct),title:r.correct?'Seu BytePet atravessou a ponte!':'Seu BytePet caiu na água. Vamos consertar as pontes!',xp:r.correct?24:0,coins:r.correct?18:0};render();},r.correct?600:1050);
  },360);break;}

 case 'maze-step':if(APP.moveQueue.length<APP.game.round.maxSteps)APP.moveQueue.push(el.dataset.dir);render();break;
 case 'maze-clear':APP.moveQueue=[];render();break;
 case 'maze-submit':{const r=await api('/games/finish','POST',{sessionId:APP.game.sessionId,answer:APP.moveQueue});APP.me=r.state;if(r.correct)APP.game=null;APP.outcome={kind:'game',success:r.correct,title:r.correct?'Chegou ao destino!':'Encontre um novo caminho.'};render();break}
 case 'snake-retry':{if(snakeTimer){clearInterval(snakeTimer);snakeTimer=null}APP.snake=null;render();break}
 case 'snake-direction':{const d={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]}[el.dataset.dir];if(APP.snake)APP.snake.next=d;break}
 case 'open-module':await chooseModule(el.dataset.id);break;
 case 'back-modules':APP.moduleId=null;APP.challengeRun=null;APP.challengeView='question';APP.outcome=null;APP.modules=await api('/modules');render();break;
 case 'next-question':{APP.questionIndex=(APP.questionIndex+1)%APP.moduleQuestions.questions.length;APP.answer=null;APP.challengeFeedback=null;render();break}
 case 'jump-question':APP.questionIndex=Number(el.dataset.index);APP.answer=null;APP.challengeFeedback=null;render();break;
 case 'answer-select':APP.answer=el.dataset.value;render();break;
 case 'answer-boolean':APP.answer=el.dataset.value==='true';render();break;
 case 'answer-multiple':{const arr=Array.isArray(APP.answer)?[...APP.answer]:[];const v=el.dataset.value;APP.answer=arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];render();break}
 case 'answer-order':{const q=currentQuestion();let a=Array.isArray(APP.answer)?[...APP.answer]:[...q.options];const i=Number(el.dataset.index),j=i+Number(el.dataset.shift);[a[i],a[j]]=[a[j],a[i]];APP.answer=a;render();break;}
 case 'submit-answer':{
  const q=APP.challengeRun?.questions?.[APP.challengeRun.answered];if(!q)throw new Error('Nenhuma questão disponível.');
  const ans=captureAnswer();
  if(ans===null||ans===undefined||ans===''||(Array.isArray(ans)&&ans.length===0)|| (q.type==='matching'&&Object.keys(ans||{}).length!==(q.options?.left?.length||0)))throw new Error('Escolha uma resposta antes de continuar.');
  const response=await api('/test-runs/'+APP.challengeRun.id+'/answers','POST',{questionId:q.id,answer:ans,requestId:clientUUID()});
  APP.me=response.state;APP.challengeRun=response.run;APP.lastFeedback={correct:response.correct,explanation:response.explanation,correctAnswer:response.correctAnswer};
  APP.modules=await api('/modules');APP.answer=null;
  if(response.complete){APP.challengeView='summary';APP.outcome=null;}
  else APP.outcome={kind:'quiz',correct:response.correct,explanation:response.explanation,correctAnswer:response.correctAnswer,complete:false};
  render();break;
 }
 case 'select-school':APP.schoolId=el.dataset.id;await loadSchoolData();APP.schoolReport=null;APP.schoolModuleId=null;render();break;
 case 'edit-school-module':APP.schoolModuleId=el.dataset.id;APP.mediaPath='';APP.editorStep='details';APP.questionDraft={};render();break;
 case 'load-school-report':APP.schoolReport=await api('/schools/'+APP.schoolId+'/reports');APP.staffStudentDetail=null;render();toast('Resultados atualizados.');break;
 case 'upload-school-image':{
  const fi=document.getElementById('question-file')?.files?.[0];assertClient(fi,'Escolha uma imagem.');assertClient(fi.size<=1_800_000,'Limite de 1,8 MB por imagem.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(fi)});const r=await api('/schools/'+APP.schoolId+'/media','POST',{data});APP.mediaPath=r.path;const preview=document.createElement('img');preview.src=r.path;preview.alt='Prévia da imagem normalizada';preview.width=60;preview.height=60;el.parentElement?.append(preview);toast('Imagem padronizada em 384×384 WebP.');break;}
 case 'visit':{const ownerId=el.dataset.id;const target=await api('/visit/'+ownerId);await api('/visit/'+ownerId,'POST',{});APP.visitor=target;APP.page=staffRole()?'school':'friends';APP.outcome=null;render();scrollUp();break;}
 case 'close-visitor':await api('/visits/leave','POST');APP.visitor=null;render();break;
 case 'mobile-more':APP.mobileMore=!APP.mobileMore;render();break;
 case 'toggle-nav':APP.navOpen=!APP.navOpen;render();break;
 case 'staff-jump':case 'staff-switch':{APP.mobileMore=false;
  const names={'school-overview':'overview','school-students':'students','school-teachers':'teachers','school-classes':'classes','school-settings':'settings','school-tests':'tests','school-reports':'reports','school-visits':'visits'};
  APP.staffSection=el.dataset.section||names[el.dataset.target]||'overview';APP.staffPage=0;APP.staffMobileView='list';APP.staffStudentDetail=null;APP.navOpen=false;
  if(APP.schoolId)await loadSchoolData();
  if(APP.staffSection==='reports'&&APP.schoolId){APP.schoolReport=await api('/schools/'+APP.schoolId+'/reports');APP.staffClassIndex=0;APP.staffReportModule='all';}
  APP.visitor=null;APP.outcome=null;history.replaceState(null,'','#escola/'+APP.staffSection);render();break;
 }
 case 'editor-next':{
 const form=document.getElementById('question-meta');if(form&&!form.reportValidity())break;
 APP.questionDraft={...APP.questionDraft,...Object.fromEntries(new FormData(form))};APP.editorStep='answers';render();break;
 }
 case 'editor-back':{
 const form=document.getElementById('teacher-question-form');if(form)APP.questionDraft={...APP.questionDraft,...Object.fromEntries(new FormData(form))};APP.editorStep='details';render();break;
 }
 case 'editor-tab':{
 if(APP.editorStep==='details'){
  const f=document.getElementById('question-meta');if(f)APP.questionDraft={...APP.questionDraft,...Object.fromEntries(new FormData(f))};
 }else if(APP.editorStep==='answers'){
  const f=document.getElementById('teacher-question-form');if(f)APP.questionDraft={...APP.questionDraft,...Object.fromEntries(new FormData(f))};
 }
 APP.editorStep=el.dataset.step;render();break;
 }
 case 'editor-cancel':APP.schoolModuleId=null;APP.editorStep='details';APP.questionDraft={};render();break;
 case 'staff-mobile-tab':APP.staffMobileView=el.dataset.tab;render();break;
 case 'staff-pager':APP.staffPage=Math.max(0,APP.staffPage+Number(el.dataset.step));render();break;
 case 'staff-class':APP.staffClassIndex=Number(el.dataset.index);APP.staffReportModule='all';APP.staffPage=0;render();break;
 case 'staff-student-detail':APP.staffStudentDetail=el.dataset.id;render();break;
 case 'staff-student-detail-close':APP.staffStudentDetail=null;render();break;
 case 'arcade-page':APP.arcadeIndex=Math.max(0,Math.min(2,APP.arcadeIndex+Number(el.dataset.step)));render();break;
 case 'worlds-page':APP.worldPage=Math.max(0,Math.min(APP.content.worlds.length-1,APP.worldPage+Number(el.dataset.step)));render();break;
 case 'shop-page':APP.shopPage=Math.max(0,APP.shopPage+Number(el.dataset.step));render();break;
 case 'friends-page':APP.socialPage=Math.max(0,APP.socialPage+Number(el.dataset.step));render();break;
 case 'badges-page':APP.badgePage=Math.max(0,APP.badgePage+Number(el.dataset.step));render();break;
 case 'badges-tab':APP.showSkins=el.dataset.tab==='skins';APP.badgePage=0;render();break;
 case 'modules-page':APP.modulePage=Math.max(0,(APP.modulePage||0)+Number(el.dataset.step));render();break;
 case 'review-module':APP.challengeView='review';APP.reviewIndex=0;APP.outcome=null;render();break;
 case 'review-summary':APP.challengeView='summary';render();break;
 case 'review-next':APP.reviewIndex=Math.min(APP.challengeRun.total-1,APP.reviewIndex+1);render();break;
 case 'review-prev':APP.reviewIndex=Math.max(0,APP.reviewIndex-1);render();break;
 case 'review-jump':APP.reviewIndex=Number(el.dataset.index);render();break;
 case 'retake-module':{const current=APP.modules?.find(m=>m.id===(el.dataset.id||APP.moduleId));if(current?.medalTier==='ouro'||(APP.challengeRun?.module?.id===(el.dataset.id||APP.moduleId)&&APP.challengeRun?.medal?.tier==='ouro'))throw new Error('Você já conquistou ouro! Use Rever teste e explicações.');await chooseModule(el.dataset.id||APP.moduleId,true);break;}
 case 'student-change-code':APP.studentIdentity=null;render();break;
 case 'reissue-student-code':{const r=await api('/schools/'+APP.schoolId+'/roster/'+el.dataset.id+'/reissue','POST');APP.newActivation={studentCode:r.studentCode};render();toast('Novo codigo gerado. O anterior deixa de funcionar.');break;}
 case 'mentor-read':await api('/mentor/messages/'+el.dataset.id+'/read','POST');APP.mentorMessages=APP.mentorMessages.map(m=>m.id===el.dataset.id?{...m,read_at:Math.floor(Date.now()/1000)}:m);render();break;
 case 'open-mentor-note':APP.mentorTarget=el.dataset.id;APP.modal='mentor-note';render();break;
 case 'mentor-message-send':await api('/mentor/messages','POST',{studentId:APP.mentorTarget,key:el.dataset.key});APP.modal=null;toast('Recado enviado ao estudante!');render();break;
 case 'close-mentor-modal':APP.modal=null;render();break;
 case 'outcome-retry':case 'outcome-new-game':{const type=APP.lastGameType||APP.game?.type;APP.outcome=null;APP.game=null;APP.snake=null;APP.bridgeWalking=null;if(snakeTimer){clearInterval(snakeTimer);snakeTimer=null}if(type){APP.lastGameType=type;APP.game=await api('/games/start','POST',{type});APP.me.gameDaily=APP.game.daily;APP.hint=false;APP.bridgeSelected=null;APP.bridgeRot=Object.fromEntries((APP.game.round.tiles||[]).map(t=>[t.id,t.rot]));}render();break;}

 case 'outcome-back':{const destination=APP.outcome?.kind==='quiz'?'challenges':'games';APP.outcome=null;APP.game=null;if(destination==='challenges')APP.moduleId=null;await openPage(destination);break;}
 case 'outcome-next':APP.outcome=null;APP.questionIndex=APP.challengeRun?.answered||0;APP.answer=null;APP.challengeView=APP.challengeRun?.status==='completed'?'summary':'question';render();break;
 case 'accept-friend':await api('/social/friends/'+el.dataset.id+'/accept','POST');APP.social=await api('/social');render();toast('Amizade aceita.');break;
 }
}
function assertClient(condition,msg){if(!condition)throw new Error(msg)}
root.addEventListener('click',async e=>{const btn=e.target.closest('[data-page],[data-action]');if(!btn||btn.disabled)return;try{if(btn.dataset.page)await openPage(btn.dataset.page);else await execute(btn.dataset.action,btn)}catch(error){toast(error.message,true)}});
root.addEventListener('change',async e=>{if(e.target.id==='report-class'){APP.staffClassIndex=Number(e.target.value);APP.staffReportModule='all';APP.staffPage=0;render();return;}if(e.target.id==='report-module'){APP.staffReportModule=e.target.value;APP.staffPage=0;render();return;}if(e.target.name==='role')APP.role=e.target.value;
 if(e.target.id==='food-select')APP.food=e.target.value;
 if(e.target.id==='allow-visits'){try{APP.me=await api('/social/visits','POST',{allow:e.target.checked});toast('Permissão de visita atualizada.')}catch(error){toast(error.message,true)}}
});
root.addEventListener('submit',async e=>{const form=e.target;const id=form.id;if(!id)return;e.preventDefault();const values=Object.fromEntries(new FormData(form));try{if((id==='setup-school-form'||(id==='auth-form'&&form.querySelector('[name=passwordConfirm]')))&&values.password!==values.passwordConfirm)throw new Error('As senhas não coincidem. Confira e tente novamente.');
 if(id==='setup-school-form'){
  const r=await api('/setup','POST',{mode:'school',schoolName:values.schoolName,username:values.username,password:values.password,petName:values.petName});
  APP.setup={configured:true,mode:'school'};APP.me=r.state;APP.schoolId=r.state.schools.find(s=>s.role==='manager')?.id;APP.setupSchoolMode=false;APP.page='school';await loadSchoolData();render();toast('Escola configurada! Codigo: '+r.schoolCode);return;
 }
 if(id==='student-code-form'){
  APP.studentIdentity=await api('/student/verify-code','POST',{studentCode:values.studentCode});
  APP.studentIdentity.code=values.studentCode.trim();render();toast('Matricula encontrada! Agora escolha seu apelido e senha.');return;
 }
 if(id==='auth-form'){
  let r;if(APP.setup?.mode==='school'&&APP.authContext==='student'&&APP.authMode==='register')r=await api('/student/register','POST',{...values,studentCode:APP.studentIdentity?.code});
  else if(APP.setup?.mode==='school'&&APP.authContext==='teacher'&&APP.teacherToken)r=await api('/teacher/register','POST',{...values,inviteToken:APP.teacherToken});
  else if(APP.setup?.mode==='normal'&&APP.authMode==='register')r=await api('/register','POST',values);
  else r=await api('/login','POST',values);
  APP.me=r.state;APP.studentIdentity=null;APP.schoolId=APP.me.schools?.find(s=>['manager','teacher'].includes(s.role))?.id||null;
  APP.page=APP.schoolId?'school':'home';
  if(APP.schoolId)await loadSchoolData();
  else{APP.mentorMessages=(await api('/mentor/messages').catch(()=>({messages:[]}))).messages||[];APP.currentVisitors=(await api('/visits/active').catch(()=>({visitors:[]}))).visitors||[]}
  if(APP.authContext==='teacher'){history.replaceState({},'',location.pathname);APP.teacherToken=''}
  render();toast(APP.me.approval?.status==='pending'?'Cadastro enviado para aprovacao.':'Bem-vindo ao BytePets!');return;
 }
 if(id==='friend-form'){await api('/social/friends/request','POST',{username:values.username});toast('Pedido de amizade enviado.');form.reset();return}
 if(id==='roster-form'){
  APP.newActivation=await api('/schools/'+APP.schoolId+'/roster','POST',values);
  await loadSchoolData();render();toast('Matricula cadastrada. Guarde o codigo individual.');return;
 }
 if(id==='assign-teacher-form'){
  await api('/schools/'+APP.schoolId+'/teacher-classes','POST',values);
  await loadSchoolData();render();toast('Professor vinculado a turma.');return;
 }
 if(id==='daily-limit-form'){
  await api('/schools/'+APP.schoolId+'/game-limit','POST',{limit:Number(values.limit)});
  await loadSchoolData();render();toast('Limite diario atualizado.');return;
 }
 if(id==='create-school-form'){const s=await api('/schools','POST',{name:values.name});APP.schoolId=s.id;APP.me=await api('/me');await loadSchoolData();APP.schoolReport=null;render();toast('Escola criada com sucesso.');return}
 if(id==='create-class-form'){const c=await api('/schools/'+APP.schoolId+'/classes','POST',{name:values.name});await loadSchoolData();APP.schoolReport=null;render();toast('Turma criada! Código: '+c.joinCode);return}
 if(id==='join-class-form'){await api('/classes/join','POST',{code:values.code});APP.me=await api('/me');APP.modules=await api('/modules');render();toast('Turma vinculada.');return}
 if(id==='create-module-form'){const m=await api('/schools/'+APP.schoolId+'/modules','POST',values);await loadSchoolData();APP.schoolModuleId=m.id;APP.schoolReport=null;APP.editorStep='details';APP.questionDraft={};render();toast('Módulo criado como rascunho.');return}
 if(id==='teacher-question-form'){
  const allValues={...APP.questionDraft,...values};
  const type=allValues.type,lines=(allValues.options||'').split('\n').map(x=>x.trim()).filter(Boolean);let opts=lines,answer=(allValues.answer||'').trim();
  if(type==='multiple'||type==='short'||type==='ordering')answer=answer.split(',').map(x=>x.trim()).filter(Boolean);
  if(type==='boolean')answer=answer.toLowerCase()==='true'||answer.toLowerCase()==='verdadeiro';
  if(type==='matching'){try{opts=JSON.parse(allValues.options);answer=JSON.parse(allValues.answer)}catch{throw new Error('Associação requer JSON válido para opções e gabarito.')}}
  await api('/modules/'+APP.schoolModuleId+'/questions','POST',{type,prompt:allValues.prompt,options:opts,answer,explanation:allValues.explanation,score:Number(allValues.score),mediaPath:APP.mediaPath});APP.mediaPath='';APP.questionDraft={type:APP.questionDraft.type,score:APP.questionDraft.score};APP.editorStep='details';render();toast('Questão adicionada ao rascunho. Adicione outra ou publique na etapa 3.');return;
 }
 if(id==='publish-form'){await api('/modules/'+APP.schoolModuleId+'/publish','POST',{classIds:[values.classId]});await loadSchoolData();APP.schoolReport=null;render();toast('Módulo publicado para a turma.');return}
 }catch(error){toast(error.message,true)}});
// Visible energy recovery while the pet is sleeping. The API is authoritative.
setInterval(async()=>{
 if(!APP.me?.pet?.sleeping||APP.page!=='home'||APP.visitor||staffRole())return;
 try{APP.me=await api('/me');if(APP.page==='home'&&!APP.visitor)render();}catch{}
},8000);
document.addEventListener('keydown',e=>{if(!APP.game||APP.game.type!=='snake'||!APP.snake)return;if(e.target.closest('input,textarea,select,[contenteditable]'))return;const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],W:[0,-1],a:[-1,0],A:[-1,0],s:[0,1],S:[0,1],d:[1,0],D:[1,0]}[e.key];if(d){e.preventDefault();APP.snake.next=d}});
async function boot(){try{
 APP.content=await api('/content');APP.setup=await api('/setup');
 if(APP.setup.mode==='school'){APP.authMode='login';APP.authContext='login'}
 if(APP.teacherToken&&APP.setup.mode==='school'){
  try{const invitation=await api('/teacher-invite?token='+encodeURIComponent(APP.teacherToken));APP.teacherSchoolName=invitation.schoolName;APP.authContext='teacher';APP.authMode='register'}
  catch{APP.teacherToken='';toast('Convite invalido ou expirado',true)}
 }
 APP.me=await api('/me').catch(e=>{if(e.message.includes('Entre')||e.message.includes('expirada'))return null;throw e});
 if(APP.me){APP.schoolId=APP.me.schools?.find(s=>['manager','teacher'].includes(s.role))?.id||null;if(APP.schoolId){APP.page='school';await loadSchoolData()}else{APP.mentorMessages=(await api('/mentor/messages').catch(()=>({messages:[]}))).messages||[];APP.currentVisitors=(await api('/visits/active').catch(()=>({visitors:[]}))).visitors||[]}}
 render();
 }catch(error){root.innerHTML=`<div class="auth-wrap"><div class="panel">Nao foi possivel iniciar BytePets: ${esc(error.message)}</div></div>`}}
boot();
// Atualiza o estado vital após o tempo transcorrido, preservando a tela durante jogos e formulários.
setInterval(async()=>{
 if(!APP.me||APP.page!=='home'||APP.petAnimation!=='idle'||document.visibilityState==='hidden')return;
 try{const before=APP.me.pet,latest=await api('/me');if(!APP.me||APP.me.account.id!==latest.account.id)return;
  APP.me=latest;const changed=['health','hunger','energy','hygiene','happiness'].some(k=>Math.round(before[k])!==Math.round(latest.pet[k]));
  if(changed||before.poop!==latest.pet.poop)render();
 }catch{ /* sem conexão: mantém o último estado exibido */ }
},20000);

// Visitas ativas: presenca com expiracao automatica, atualizada sem expor dados pessoais.
setInterval(async()=>{
 if(!APP.me||document.visibilityState==='hidden')return;
 try{
  if(APP.visitor){await api('/visits/heartbeat','POST',{ownerId:APP.visitor.account.id});return;}
  if(!staffRole()&&APP.page==='home'){
   const next=(await api('/visits/active')).visitors||[];
   if(JSON.stringify(next)!==JSON.stringify(APP.currentVisitors)){APP.currentVisitors=next;if(APP.petAnimation==='idle')render()}
  }
 }catch{/* a visita expira sozinha, sem revelar perfis */}
},12000);
