/* Prévia estática: reutiliza o conteúdo versionado da home, sem executar APIs. */
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const root = process.env.BM_SOURCE_ROOT || path.resolve(__dirname, '../..');
const dependencyRoot = process.env.BM_DEPENDENCY_ROOT || root;
const ts = require(path.join(dependencyRoot, 'node_modules/typescript'));
const React = require(path.join(dependencyRoot, 'node_modules/react'));
const {renderToStaticMarkup} = require(path.join(dependencyRoot, 'node_modules/react-dom/server'));
const out = __dirname;
const cache = new Map();
function load(file) {
  if(cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const source = fs.readFileSync(file,'utf8');
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  function localRequire(id) {
    if(id==='react') return React;
    if(id==='react/jsx-runtime') return require(path.join(dependencyRoot,'node_modules/react/jsx-runtime'));
    if(id==='next/link') return {__esModule:true,default:({href,children,...props})=>React.createElement('a',{...props,href:href.startsWith('/#')?href.slice(1):href.startsWith('/')?'https://brennimark.vercel.app'+href:href},children)};
    if(id==='next/image') return {__esModule:true,default:({src,fill,sizes,fetchPriority,loading,...props})=>React.createElement('img',{...props,src:src.src||src,loading:loading||'lazy',fetchPriority})};
    if(id==='./Losango') return {Losango:()=>null};
    if(/\.(jpg|webp)$/.test(id)) return {__esModule:true,default:{src:'assets/'+path.basename(id)}};
    if(id.startsWith('.')) return load(path.resolve(path.dirname(file),id+'.tsx'));
    throw new Error('Import não previsto: '+id);
  }
  const module={exports};
  new Function('require','module','exports',code)(localRequire,module,exports);
  cache.set(file,module.exports);
  return module.exports;
}
const site = path.join(root,'src/components/site');
let chapters=renderToStaticMarkup(React.createElement(load(path.join(site,'CapitulosDaHome.tsx')).CapitulosDaHome));
const sprite=renderToStaticMarkup(React.createElement(load(path.join(site,'Simbolos.tsx')).SimbolosDoSite));
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
for(const file of ['equipe-na-mesa.jpg','maos-com-pranchas.webp','vini.webp'])fs.copyFileSync(path.join(site,'imagens',file),path.join(out,'assets',file));
fs.copyFileSync(path.join(root,'src/app/(site)/site.css'),path.join(out,'base.css'));
chapters=chapters.replace(/<link[^>]*rel="preload"[^>]*>/g,'');
chapters=chapters.replace('src="assets/equipe-na-mesa.jpg"','src="assets/hero-37.jpg"');
chapters=chapters.replace(/(<div class="hero-photo">)([\s\S]*?)(<\/div>)/,'$1<div class="photo-stage">$2<svg class="annotations" viewBox="0 0 1600 1066" aria-hidden="true"><g class="annotation"><rect id="face-frame" width="160" height="200" transform="translate(355 190)"/><line id="gaze-line" x1="0" y1="0" x2="1" y2="0"/><rect id="sketch-frame" width="80" height="42" transform="translate(508 839)"/></g></svg></div>$3');
chapters=chapters.replace('<section class="panel" id="problema"',fs.readFileSync(path.join(out,'capitulo.html'),'utf8')+'<section class="panel" id="problema"');
// Cada arquivo mantém sua regra. A prévia não cria contas, envia formulários ou chama IA.
chapters=chapters.replace(/<button class="copy"[^>]*>/g,'<button class="copy" type="button" id="copy-prompt">');
chapters=chapters.replace('<p class="eyebrow">Demonstração</p>','<p class="assunto">Para falar <span id="assunto">do seu manual</span></p>');
chapters=chapters.replaceAll('—','-');
const logo='<svg viewBox="0 0 750 170" aria-hidden="true"><use href="#bm-logo"/></svg>';
// O endereço muda com o conteúdo, para os navegadores não reutilizarem JS/CSS antigos.
const assetVersion=file=>createHash('sha256').update(fs.readFileSync(path.join(out,file))).digest('hex').slice(0,12);
const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>Brennimark · Uma marca, muitas mãos</title><meta name="description" content="O manual, os materiais e as orientações da marca num só lugar."><link rel="preload" href="assets/hero-37.jpg" as="image"><link rel="stylesheet" href="base.css"><link rel="stylesheet" href="previa.css?v=${assetVersion('previa.css')}"></head><body><div class="bm-site">${sprite}<header class="site-head"><a href="#inicio" class="lockup" aria-label="Brennimark, início">${logo}</a><p class="context" id="context">Uma marca, muitas mãos</p><nav class="site-nav" aria-label="Navegação principal"><a href="#plataforma">Plataforma</a><a href="#publico">Para quem</a><a href="#planos">Planos</a></nav><div class="head-actions"><a class="signin" href="https://brennimark.vercel.app/login">Entrar</a><button class="btn btn--small" data-open="dlg-demo">Agendar demonstração <span aria-hidden="true">↗</span></button><button class="menu-toggle" id="open-menu" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu-overlay">Menu <span aria-hidden="true">☰</span></button></div></header><main class="shell"><div class="track" id="track">${chapters}</div></main><nav class="chapnav" aria-label="Capítulos"><div class="chap-status"><b id="chap-n">01 / 14</b><span id="chap-t">Início</span></div><div class="chapter-links"><a href="#inicio">Início</a><a href="#plataforma">Plataforma</a><a href="#vini">Vini Max</a><a href="#planos">Planos</a></div><span class="clock" id="clock"></span><div class="chap-ctrl"><button id="prev" aria-label="Capítulo anterior">←</button><button id="next" aria-label="Próximo capítulo">→</button></div></nav><dialog id="menu-overlay" class="mega-menu"><div class="menu-top"><span class="mono">BRENNIMARK / EXPLORE</span><button data-close aria-label="Fechar menu">Fechar ×</button></div><nav aria-label="Explorar o site"><a href="#plataforma">Plataforma<span>O manual inteiro, com a equipe.</span></a><a href="#vini">Vini Max<span>Pergunte. Ele cita a página.</span></a><a href="#publico">Para quem<span>Para quem leva a marca adiante.</span></a><a href="#planos">Planos<span>Mais marcas. Pessoas ilimitadas.</span></a><a href="#demonstracao">Vamos conversar<span>Do seu manual. Da sua marca.</span></a></nav><p>O manual, os materiais e as orientações da marca num só lugar.</p></dialog><dialog id="dlg-demo" class="demo-dialog"><button data-close class="close-dialog" aria-label="Fechar demonstração">×</button><p class="mono">VAMOS CONVERSAR</p><h2>A próxima marca pode ser a sua.</h2><p>Esta é uma prévia visual. Para conversar sobre uma demonstração, continue no site do Brennimark.</p><a class="btn" href="https://brennimark.vercel.app/#demonstracao">Continuar no site publicado <span aria-hidden="true">↗</span></a></dialog></div><script src="previa.js?v=${assetVersion('previa.js')}"></script></body></html>`;
fs.writeFileSync(path.join(out,'index.html'),html);
console.log('Prévia gerada com 14 capítulos e conteúdo da branch.');
