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
  const words=[['MANUAL','p6.jpg','Logotipo / Manual de demonstração, p. 6'],['MATERIAIS',null,'Logotipo e formatos / exemplo de materiais da marca'],['REGRAS','p9.jpg','Área de proteção / Manual de demonstração, p. 9'],['NUM SÓ LUGAR','p1.jpg','Manual de demonstração do Brennimark']];
  const buttons=[...document.querySelectorAll('[data-word]')];let selected=0,manualUntil=0;
  function selectWord(i){
    selected=i;const [word,src,caption]=words[i],h=document.querySelector('#big-word');
    h.textContent=word;h.classList.toggle('long-word',i===1||i===3);
    const img=document.querySelector('#word-image');img.hidden=!src;if(src)img.src='assets/'+src;
    document.querySelector('.material-window').hidden=!!src;
    document.querySelector('#word-caption').textContent=caption;
    buttons.forEach((b,k)=>b.setAttribute('aria-pressed',String(k===i)));
  }
  buttons.forEach((b,i)=>b.addEventListener('click',()=>{manualUntil=Date.now()+12000;selectWord(i);}));
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
    if(phraseVisible&&Date.now()>manualUntil)selectWord((selected+1)%4);
    if(closingVisible){subjectIndex=(subjectIndex+1)%subjects.length;document.querySelector('#assunto').textContent=subjects[subjectIndex];}
  },3800);
  addEventListener('pagehide',()=>clearInterval(cycle),{once:true});
  document.querySelector('.art-page').replaceWith(Object.assign(document.createElement('img'),{src:'assets/p9.jpg',alt:'',loading:'lazy'}));
  const video=document.querySelector('#vini-video');if(video){video.removeAttribute('autoplay');video.removeAttribute('loop');}
  document.querySelector('[data-copy]')?.addEventListener('click',async e=>{
    try{await navigator.clipboard.writeText(document.querySelector('.prompt').innerText);e.currentTarget.textContent='Copiado';}catch{e.currentTarget.textContent='Selecione o texto para copiar';}
  });
  mobile.addEventListener('change',()=>{const target=panels.findIndex(p=>p.id===location.hash.slice(1));go(target<0?0:target,false);});
  route();mark(current);
})();
