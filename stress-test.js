/* ============================================================
   Stress + smoke test del Compositore Versioni Clienti
   Come si usa:  node stress-test.js
   Legge index.html, estrae lo <script> e collauda la logica
   (tetti d'uso, popup upgrade, avanzamento giorni, proroga)
   sui tre piani di prova 7 / 15 / 30 giorni.
   Nessuna dipendenza esterna: usa un finto DOM.
============================================================ */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let js = html.match(/<script>([\s\S]*)<\/script>/)[1];

/* --- finto DOM minimo --- */
const DOM = {};
function makeEl(id){
  return new Proxy(function(){}, {
    get(t,p){
      if(p==='style') return new Proxy({},{get:()=>()=>{},set:()=>true});
      if(p==='classList') return {add(){},remove(){},toggle(){},contains(){return false}};
      if(p==='files') return []; if(p==='value') return ''; if(p==='checked') return false;
      if(p==='hidden') return false; if(p==='offsetWidth') return 1;
      if(p==='innerHTML') return DOM[id]||'';
      if(p==='querySelector') return ()=>makeEl(); if(p==='querySelectorAll') return ()=>[];
      if(p==='closest') return ()=>makeEl();
      if(p==='previousElementSibling'||p==='parentElement') return makeEl();
      if(p==='getAttribute') return ()=>''; if(p==='hasAttribute') return ()=>false;
      if(typeof p==='string') return (...a)=>makeEl();
      return undefined;
    },
    set(t,p,v){ if(p==='innerHTML') DOM[id]=v; return true; }
  });
}
global.document = {getElementById:(id)=>makeEl(id),querySelector:()=>makeEl(),querySelectorAll:()=>[],createElement:()=>makeEl(),addEventListener(){},removeEventListener(){},body:makeEl(),fonts:{add(){}},activeElement:makeEl()};
global.window = {scrollTo(){}};
global.URL = {createObjectURL:()=>'blob:x'};

js = js.replace(/renderStepper\(\); go\(.intro.\);\s*$/,'');
eval(js);

let _up = 0;
openUpgrade = function(){ _up++; };   // conta i popup di upgrade

let pass=0, fail=0;
function A(cond,msg){ if(cond){pass++;} else {fail++; console.log('  ✗ FAIL:',msg);} }
function freshPlans(){ PLANS={7:{days:7,cap:50},15:{days:15,cap:25},30:{days:30,cap:12}}; }

/* --- SMOKE: tutte le schermate, anche senza prova scelta --- */
S={screen:'intro',account:{name:'T',email:'a@b'},profile:null,uses:[],trial:null,features:{},theme:{primary:'#0C6CD3',accent:'#EF8216',bg:'#FBF7EF',text:'#211C18',font:'inter'},day:1,usedToday:0,extended:false,active:false};
['intro','account','profile','trial','features','summary','theme','ready','dashboard','end','upok','winback'].forEach(function(s){
  try{ go(s); A(true); }catch(e){ A(false,'go('+s+') crash: '+e.message); }
});
console.log('SMOKE: 12 schermate navigate senza crash');

/* --- STRESS per ogni piano --- */
[7,15,30].forEach(function(p){
  freshPlans();
  S={screen:'dashboard',account:{name:'T',email:'a@b'},profile:'agenzia',uses:[],trial:p,features:{},theme:{primary:'#0C6CD3',accent:'#EF8216',bg:'#FBF7EF',text:'#211C18',font:'inter'},day:1,usedToday:0,extended:false,active:true};
  activateGroup('acc'); activateGroup('con'); resolveDeps();
  S._mods=activeFnsFlat();
  var cap=PLANS[p].cap;
  console.log('--- PIANO '+p+'gg (cap '+cap+'/giorno, '+PLANS[p].days+' giorni) ---');

  _up=0; S.usedToday=0; S._warnedToday=false;
  for(var i=0;i<cap+40;i++){ useFeature(i % S._mods.length); }
  A(S.usedToday===cap, p+'gg: si ferma esatto al tetto '+cap+' (val='+S.usedToday+')');
  A(_up>=1, p+'gg: popup di upgrade comparso (conteggio='+_up+')');

  var g=0; while(S.screen!=='end' && g<500){ advanceDay(); g++; }
  A(S.screen==='end', p+'gg: avanza fino a fine prova');
  A(g===PLANS[p].days, p+'gg: numero giorni corretto = '+g);

  renderEnd();
  var canExtend = S.trial!==30 && !S.extended;
  if(p===30){ A(canExtend===false,'30gg: proroga NON disponibile'); }
  else { A(canExtend===true, p+'gg: proroga disponibile'); }

  if(p!==30){
    var before=PLANS[p].days; extendTrial();
    A(PLANS[p].days===before+7, p+'gg: proroga aggiunge 7 giorni ('+before+'->'+PLANS[p].days+')');
    A(S.screen==='dashboard', p+'gg: dopo proroga torna in dashboard');
  } else {
    var d30=PLANS[30].days; extendTrial();
    A(PLANS[30].days===d30, '30gg: extendTrial non prolunga nulla');
  }
});

/* --- dipendenze e contrasto --- */
freshPlans();
S.features={}; S.features['agenti']=true; resolveDeps(); A(isGroupActive(groupById('acc')),'dip Automazioni->Accessibilita');
S.features={}; S.features['raccogli']=true; resolveDeps(); A(isGroupActive(groupById('crm')),'dip Fiere->CRM');
A(bestTextOn('#EF8216')==='#111111','testo scuro sul pulsante arancio');
A(contrastRatio('#211C18','#FBF7EF')>4.5,'default testo/sfondo accessibile');

/* ===== NUOVE FUNZIONI: Licenze, Premium, Notifiche, Idee ===== */
freshPlans();
S={screen:'dashboard',account:{name:'Bea Test',email:'a@b'},profile:'agenzia',uses:[],trial:7,features:{},theme:{primary:'#0C6CD3',accent:'#EF8216',bg:'#FBF7EF',text:'#211C18',font:'inter'},day:1,usedToday:0,extended:false,active:true,licenze:5,premium:true,interest:{},ideas:[],confirmedIdeas:0};
IDEAS = IDEAS_SEED.map(function(o){return Object.assign({},o);});
console.log('--- PREMIUM: notifiche, licenze, idee ---');

['notifiche','proposte'].forEach(function(s){ try{ go(s); A(true);}catch(e){ A(false,'go('+s+') crash: '+e.message);} });
A(true); // schermate premium navigate

S.premium=false; A(premiumGuard()===false,'premiumGuard blocca senza premium');
S.premium=true;  A(premiumGuard()===true, 'premiumGuard passa con premium');

S.interest={}; signalInterest('firma'); A('firma' in S.interest, 'signalInterest registra l\'interesse');

IDEAS = IDEAS_SEED.map(function(o){return Object.assign({},o);});
var other=IDEAS.find(function(i){return !i.mine;}); var before=other.conf; confirmIdea(other.id);
A(other.conf===before+1, 'confirmIdea +1 su idea altrui');

IDEAS.unshift({id:'mine1',title:'x',founder:'Bea',conf:0,status:'val',mine:true});
confirmIdea('mine1'); A(IDEAS.find(function(i){return i.id==='mine1';}).conf===0, 'ideatore NON vota la propria idea');
S.confirmedIdeas=0; simulaConfermaMia('mine1'); simulaConfermaMia('mine1'); simulaConfermaMia('mine1');
A(IDEAS.find(function(i){return i.id==='mine1';}).status==='conf', 'idea mia diventa confermata a soglia');
A(S.confirmedIdeas===1, 'confirmedIdeas incrementa a conferma');

try{ renderReward(); renderLeaderboard(); renderNotifiche(); renderPremiumRow(); A(true);}catch(e){ A(false,'render premium crash: '+e.message); }

console.log('\nRISULTATO: '+pass+' pass / '+fail+' fail');
process.exit(fail?1:0);
