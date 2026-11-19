const CFG={
  API:'/api/identify',
  // Modelo local (Transformers.js, ONNX). Cámbialo aquí si usas otro modelo de clasificación de plantas.
  MODEL:'linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification',
  LIB:'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2',
  LOW:0.6, MAX:1024
};
const $=s=>document.querySelector(s),show=(id,on=true)=>$(id).hidden=!on;
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=(n,x='')=>`<svg viewBox="0 0 24 24" fill="currentColor" ${x}><use href="#${n}"/></svg>`;
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
  show('#id',b.dataset.t==='id');show('#garden',b.dataset.t==='garden');if(b.dataset.t==='garden')renderGarden();});
['#cam','#gal'].forEach(s=>$(s).onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)run(f)});

function shrink(src,max){return new Promise((ok,ko)=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');
  c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.8))};i.onerror=()=>ko(new Error('img'));i.src=src})}
const readFile=f=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=ko;r.readAsDataURL(f)});

function msg(t,d){show('#busy',false);show('#start',false);show('#res',false);const m=$('#msg');m.hidden=false;
  m.innerHTML=`<svg class="big" viewBox="0 0 24 24"><use href="#leaf"/></svg><h3>${esc(t)}</h3><p>${esc(d)}</p><button class="btn" id="again">Intentar de nuevo</button>`;$('#again').onclick=reset}
function reset(){show('#msg',false);show('#res',false);show('#busy',false);show('#start')}

async function online(dataUrl){
  const r=await fetch(CFG.API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:dataUrl.split(',')[1],mediaType:'image/jpeg'})});
  if(r.status===429)throw Object.assign(new Error('limit'),{limit:true});
  if(!r.ok)throw new Error('http '+r.status);
  return r.json();
}
let clf;
async function local(dataUrl){
  $('#busyTxt').textContent='Preparando el modelo local (la primera vez tarda un poco)…';
  if(!clf){const {pipeline}=await import(CFG.LIB);clf=await pipeline('image-classification',CFG.MODEL)}
  const [t]=await clf(dataUrl,{top_k:3});
  const [crop,dis='']=t.label.split('___').map(s=>s.replace(/_/g,' ').replace(/\s+/g,' ').trim());
  const sana=/healthy/i.test(dis||t.label);
  return {es_planta:true,nombre_comun:crop,nombre_cientifico:'',confianza:t.score,estado:sana?'sana':'enferma',
    problema:sana?'':dis,cuidados:null,toxica:null,tratamiento:'',_local:true};
}

async function run(file){
  show('#start',false);show('#msg',false);show('#res',false);show('#busy');$('#busyTxt').textContent='Observando tu planta…';
  let thumb,img;
  try{img=await shrink(await readFile(file),CFG.MAX);thumb=await shrink(img,160)}catch{return msg('No pudimos leer la foto','Prueba con otra imagen (JPG o PNG).')}
  let data,mode='online',note='';
  try{
    if(!navigator.onLine)throw new Error('offline');
    data=await online(img);
  }catch(e){
    if(e.limit)return msg('Hoy hemos llegado al límite','Se alcanzó el límite de uso del análisis en línea. Inténtalo más tarde.');
    try{data=await local(img);mode='local';note=navigator.onLine?'El análisis en línea falló; usamos el modo local.':'Sin conexión: usamos el modo local.'}
    catch{return msg('Sin conexión','Necesitamos internet al menos una vez para descargar el modelo local. Conéctate e inténtalo de nuevo.')}
  }
  const p=$('#mode');p.hidden=false;p.textContent=mode==='online'?'Modo en línea · Claude':'Modo local · sin internet';
  if(!data.es_planta)return msg('No vemos una planta aquí',data.nota||'Acércate más a las hojas y con buena luz.');
  if(data.confianza<0.25)return msg('La foto no está clara','Parece borrosa o muy lejana. Intenta con más luz y enfoque.');
  show('#busy',false);render(data,img,note,mode);save(data,thumb);
}

function render(d,img,note,mode){
  const pct=Math.round((d.confianza||0)*100),lv=Math.round((d.confianza||0)*5);
  const leaves=[...Array(5)].map((_,i)=>`<svg viewBox="0 0 24 24" class="${i<lv?'':'off'}"><use href="#leaf"/></svg>`).join('');
  const st={sana:['Sana','Tu planta está contenta'],atencion:['Necesita atención','Está pidiendo un poco de cariño'],enferma:['Enferma','Hay que ayudarla pronto']}[d.estado]||['Sin determinar',''];
  const c=d.cuidados,row=(i,t,v)=>v?`<dt>${ico(i)}${t}</dt><dd>${esc(v)}</dd>`:'';
  let h=`<div class="herb"><img src="${img}" alt="Tu foto"><div><h2>${esc(d.nombre_comun)}</h2>${d.nombre_cientifico?`<p class="sci">${esc(d.nombre_cientifico)}</p>`:''}
  <div class="conf" role="img" aria-label="Confianza ${pct}%">${leaves}&nbsp;${pct}%</div></div></div>
  <div class="health ${esc(d.estado)}">${ico('leaf')}<div><b>${st[0]}</b><br>${st[1]}${d.problema?`<br>Posible problema: ${esc(d.problema)}`:''}</div></div>`;
  if(d.tratamiento)h+=`<p><b>Qué puedes hacer:</b> ${esc(d.tratamiento)}</p>`;
  h+='<div class="wave"></div>';
  h+=c?`<dl>${row('drop','Riego',c.riego)}${row('sun','Luz',c.luz)}${row('pot','Sustrato',c.sustrato)}${row('temp','Temperatura',c.temperatura)}${row('bag','Fertilización',c.fertilizacion)}</dl>`:'<p>Los cuidados completos solo están disponibles en modo en línea.</p>';
  if(d.toxica)h+=`<div class="tox"><b>${ico('paw','width="18" height="18"')} Toxicidad</b><br>Mascotas: ${esc(d.toxica.mascotas)} · Niños: ${esc(d.toxica.ninos)}<br>${esc(d.toxica.detalle)}</div>`;
  if(note)h+=`<div class="hint">${esc(note)}</div>`;
  if(mode==='local'&&d.confianza<CFG.LOW)h+=`<div class="hint">Confianza baja. Cuando tengas internet, vuelve a intentarlo en línea para un resultado más fiable.</div>`;
  h+=`<p class="sci" style="font-size:.85rem">Resultado orientativo. Verifica con un experto si es tóxica o comestible.</p><button class="btn alt" id="new">Identificar otra planta</button>`;
  $('#res').innerHTML=h;show('#res');$('#new').onclick=reset;
}

const KEY='hojita.garden';
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}};
function save(d,thumb){const l=load();l.unshift({d,thumb,t:Date.now()});try{localStorage.setItem(KEY,JSON.stringify(l.slice(0,40)))}catch{}}
function renderGarden(){const l=load(),el=$('#list');
  el.innerHTML=l.length?l.map((x,i)=>`<button class="g" data-i="${i}"><img src="${x.thumb}" alt=""><span><b>${esc(x.d.nombre_comun)}</b><small>${new Date(x.t).toLocaleDateString('es')} · ${esc(x.d.estado)}</small></span></button>`).join(''):'<div class="card center"><p>Tu jardín está vacío. ¡Identifica tu primera planta!</p></div>';
  el.querySelectorAll('.g').forEach(b=>b.onclick=()=>{const x=l[b.dataset.i];document.querySelector('nav [data-t=id]').click();show('#start',false);show('#msg',false);render(x.d,x.thumb,'',x.d._local?'local':'online')})}
