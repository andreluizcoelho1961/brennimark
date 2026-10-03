(() => {
  const track = document.querySelector('#track');
  const panels = [...track.querySelectorAll('.panel')];
  const mobile = matchMedia('(max-width:767px)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const context = document.querySelector('#context');
  const labels = ['Início','Num só lugar','O problema','O dia a dia','A plataforma','Vini Max','Consultar','Analisar','Preparar','Marca viva','Para quem','Quem usa','Planos','Demonstração'];
  const details = {inicio:'Pessoa → regra da marca', 'num-so-lugar':'Manual / Materiais / Regras',plataforma:'Manual / fiel ao original',assistente:'Manual / p. 10 / aprovada',analise:'Análise / equipe decide',dna:'Prompt / fontes documentadas',viva:'Orientação / versão atual'};
  let current = 0, locked = false, navigating = false, navigationTimer;
  const prev = document.querySelector('#prev'), next = document.querySelector('#next');
  function mark(i){
    current=i;
    panels.forEach((p,k)=>p.classList.toggle('is-active',i===k));
    document.querySelector('#chap-n').textContent=String(i+1).padStart(2,'0')+' / 14';
    document.querySelector('#chap-t').textContent=labels[i];
    context.textContent=details[panels[i].id]||labels[i];
    prev.disabled=i===0;next.disabled=i===panels.length-1;
    document.querySelectorAll('.chapter-links a').forEach(a=>a.classList.toggle('active',a.hash==='#'+panels[i].id));
  }
  function go(i,remember=true){
    i=Math.max(0,Math.min(panels.length-1,i));
    navigating=true;clearTimeout(navigationTimer);navigationTimer=setTimeout(()=>navigating=false,900);
    mark(i);
    const behavior=reduced.matches?'instant':'smooth';
    if(mobile.matches)panels[i].scrollIntoView({behavior,block:'start'});
    else track.scrollTo({left:panels[i].offsetLeft,behavior});
    if(remember && location.hash!=='#'+panels[i].id)history.pushState(null,'','#'+panels[i].id);
  }
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting&&!mobile.matches&&!navigating)mark(panels.indexOf(entry.target));
  },{root:track,threshold:.65});
  panels.forEach(p=>observer.observe(p));
  prev.addEventListener('click',()=>go(current-1));next.addEventListener('click',()=>go(current+1));
  track.addEventListener('wheel',e=>{
    if(mobile.matches||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    const p=panels[current],down=e.deltaY>0;
    if(down?p.scrollTop+p.clientHeight<p.scrollHeight-3:p.scrollTop>1)return;
    e.preventDefault();if(locked||Math.abs(e.deltaY)<5)return;
    locked=true;go(current+(down?1:-1));setTimeout(()=>locked=false,650);
  },{passive:false});
  document.addEventListener('click',e=>{
    const anchor=e.target.closest('a[href^="#"]');
    if(anchor){const i=panels.findIndex(p=>p.id===anchor.hash.slice(1));if(i>=0){e.preventDefault();document.querySelectorAll('dialog[open]').forEach(d=>d.close());go(i);}}
    const open=e.target.closest('[data-open]');if(open)document.getElementById(open.dataset.open)?.showModal();
    if(e.target.closest('[data-close]'))e.target.closest('dialog').close();
  });
  document.addEventListener('keydown',e=>{
    if(mobile.matches||document.querySelector('dialog[open]')||e.target.closest('input,textarea,button,a,[role="group"]'))return;
    if(['ArrowRight','PageDown','ArrowLeft','PageUp','Home','End'].includes(e.key)){
      e.preventDefault();go(e.key==='Home'?0:e.key==='End'?panels.length-1:current+(['ArrowRight','PageDown'].includes(e.key)?1:-1));
    }
  });
  function route(){const i=panels.findIndex(p=>p.id===location.hash.slice(1));if(i>=0)go(i,false);}
  addEventListener('popstate',route);addEventListener('hashchange',route);
  const menu=document.querySelector('#menu-overlay'),menuButton=document.querySelector('#open-menu');
  menuButton.addEventListener('click',()=>{menu.showModal();menuButton.setAttribute('aria-expanded','true');});
  menu.addEventListener('close',()=>menuButton.setAttribute('aria-expanded','false'));
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  function clock(){document.querySelector('#clock').textContent='PORTO ALEGRE_'+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date());}
  clock();setInterval(clock,60000);
  // Um único olhar: três rostos e suas regiões de atenção marcadas à mão nos esboços.
  // Transformações sincronizadas mantêm a linha reta presa às bordas dos retângulos.
  const faceFrame=document.querySelector('#face-frame');
  const sketchFrame=document.querySelector('#sketch-frame');
  const gazeLine=document.querySelector('#gaze-line');
  // Regiões aproximadas do olhar, junto aos esboços que cada pessoa aponta.
  const gazes=[
    {face:[355,190],sketch:[508,839]},
    {face:[700,235],sketch:[665,817]},
    {face:[1060,195],sketch:[895,829]},
  ];
  function drawGaze(face,sketch){
    faceFrame.setAttribute('transform',`translate(${face[0]} ${face[1]})`);
    sketchFrame.setAttribute('transform',`translate(${sketch[0]} ${sketch[1]})`);
    const x=face[0]+80,y=face[1]+200,dx=sketch[0]+40-x,dy=sketch[1]-y;
    gazeLine.setAttribute('transform',`translate(${x} ${y}) rotate(${Math.atan2(dy,dx)*180/Math.PI}) scale(${Math.hypot(dx,dy)} 1)`);
  }
  const gazeGroup=document.querySelector('.annotation');
  const faces=[gazes[0].face,gazes[1].face,gazes[2].face];
  let gazeVisible=false,gazeTimer=null,faceBag=[],lastFace=-1;
  const random=(min,max)=>min+Math.random()*(max-min);
  function nextFace(){
    // Sacola embaralhada: os três aparecem, mas a sequência não vira um ciclo fixo.
    if(!faceBag.length){
      faceBag=[0,1,2];
      for(let i=faceBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[faceBag[i],faceBag[j]]=[faceBag[j],faceBag[i]];}
      if(faceBag[0]===lastFace)[faceBag[0],faceBag[1]]=[faceBag[1],faceBag[0]];
    }
    lastFace=faceBag.shift();return faces[lastFace];
  }
  function nextSketch(){
    const [x,y]=gazes[lastFace].sketch;
    // A aleatoriedade fica dentro da região do olhar da pessoa ativa.
    return [x+random(-12,12),y+random(-8,8)];
  }
  function later(delay,callback){
    gazeTimer=setTimeout(()=>{gazeTimer=null;if(gazeVisible&&!document.hidden&&!reduced.matches)callback();},delay);
  }
  function jumpGaze(){
    // O rosto muda só durante o apagão; apenas o foco no papel dá pequenos passos.
    gazeGroup.style.opacity='0';
    later(random(220,420),()=>{
      const face=nextFace(),sketch=nextSketch();
      drawGaze(face,sketch);
      gazeLine.style.opacity='1';sketchFrame.style.opacity='1';
      gazeGroup.style.opacity='1';
      const dx=random(-10,10),dy=random(-6,6);
      later(random(230,380),()=>{
        drawGaze(face,[sketch[0]+dx*.45,sketch[1]+dy*.45]);
        later(random(110,220),()=>{
          drawGaze(face,[sketch[0]+dx,sketch[1]+dy]);
          later(random(250,450),jumpGaze);
        });
      });
    });
  }
  function syncGaze(){
    clearTimeout(gazeTimer);gazeTimer=null;
    if(reduced.matches){
      drawGaze(gazes[0].face,gazes[0].sketch);
      gazeGroup.style.opacity='1';gazeLine.style.opacity='1';sketchFrame.style.opacity='1';
      return;
    }
    if(gazeVisible&&!document.hidden)later(random(180,350),jumpGaze);
  }
  drawGaze(gazes[0].face,gazes[0].sketch);
  const gazeObserver=new IntersectionObserver(entries=>{gazeVisible=entries[0].isIntersecting;syncGaze();},{threshold:.1});
  gazeObserver.observe(document.querySelector('.photo-stage'));
  document.addEventListener('visibilitychange',syncGaze);
  reduced.addEventListener('change',syncGaze);
  addEventListener('pagehide',()=>{clearTimeout(gazeTimer);gazeObserver.disconnect();},{once:true});
  const words=[['MANUAL','agencia-desktop.jpg','40%'],['MATERIAIS','agencia-dupla.jpg','55%'],['REGRAS','agencia-telao.jpg','60%'],['NUM SÓ LUGAR','agencia-laptop.jpg','55%']];
  const buttons=[...document.querySelectorAll('[data-word]')];
  const pages=[...document.querySelectorAll('.manual-page')];
  let selected=0,manualUntil=0,pageLayer=0,pageRequest=0,pagesPaused=false;
  async function selectWord(i){
    const request=++pageRequest,[word,src,position]=words[i];
    const incoming=pages[1-pageLayer];
    incoming.src='assets/'+src;
    incoming.style.objectPosition=position+' center';
    try{await incoming.decode();}catch{return;}
    if(request!==pageRequest)return;
    selected=i;
    document.querySelector('#big-word').textContent=word;
    pages[pageLayer].classList.remove('is-shown');
    incoming.classList.add('is-shown');pageLayer=1-pageLayer;
    buttons.forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));
  }
  buttons.forEach((b,i)=>b.addEventListener('click',()=>{manualUntil=Date.now()+15000;selectWord(i);}));
  const pausePages=document.querySelector('#pause-pages');
  pausePages.addEventListener('click',()=>{
    pagesPaused=!pagesPaused;
    pausePages.setAttribute('aria-pressed',String(pagesPaused));
    pausePages.setAttribute('aria-label',pagesPaused?'Retomar troca de imagens':'Pausar troca de imagens');
    pausePages.textContent=pagesPaused?'Retomar':'Pausar';
  });
  // Troca somente enquanto o capítulo está visível; o texto completo não depende do ciclo.
  let phraseVisible=false,closingVisible=false,subjectIndex=0;
  const subjects=['do seu manual','da sua marca','do prazo de sexta','de nada em especial'];
  new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.target.id==='num-so-lugar')phraseVisible=e.isIntersecting;
    if(e.target.id==='demonstracao')closingVisible=e.isIntersecting;
  }),{threshold:.35}).observe(panels[1]);
  const closingObserver=new IntersectionObserver(entries=>closingVisible=entries[0].isIntersecting,{threshold:.35});closingObserver.observe(panels.at(-1));
  const cycle=setInterval(()=>{
    if(reduced.matches||document.hidden)return;
    if(phraseVisible&&!pagesPaused&&Date.now()>manualUntil)selectWord((selected+1)%4);
    if(closingVisible){subjectIndex=(subjectIndex+1)%subjects.length;document.querySelector('#assunto').textContent=subjects[subjectIndex];}
  },5200);
  addEventListener('pagehide',()=>clearInterval(cycle),{once:true});
  document.querySelector('.art-page').replaceWith(Object.assign(document.createElement('img'),{src:'assets/p9.jpg',alt:'',loading:'lazy'}));
  const video=document.querySelector('#vini-video');if(video){video.removeAttribute('autoplay');video.removeAttribute('loop');}
  document.querySelector('[data-copy]')?.addEventListener('click',async e=>{
    try{await navigator.clipboard.writeText(document.querySelector('.prompt').innerText);e.currentTarget.textContent='Copiado';}catch{e.currentTarget.textContent='Selecione o texto para copiar';}
  });
  mobile.addEventListener('change',()=>{const target=panels.findIndex(p=>p.id===location.hash.slice(1));go(target<0?0:target,false);});
  route();mark(current);
})();
