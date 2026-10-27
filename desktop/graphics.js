// All artwork stays local. Projects embed only the images they actually use.
const graphicAssets = new Map();
const graphicsRequests = new Map();
let graphicsRequestNumber = 0, selectedGraphic = '', graphicsQueue = Promise.resolve();
let dragGraphic=null;
let resolveGraphicsReady;
const graphicsReady = new Promise(resolve => { resolveGraphicsReady = resolve; });
const validGraphicID = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
function sanitizeGraphicLayers(value) {
  if (!Array.isArray(value)) return [];
  const number = (value,fallback,min,max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min,Math.min(max,value)) : fallback;
  return value.slice(0,12).filter(a=>a && validGraphicID(a.asset)).map((a,i)=>({
    id: typeof a.id==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(a.id) ? a.id : 'layer_'+i,
    asset:a.asset, enabled:a.enabled!==false, anchor:a.anchor==='frame'?'frame':'strip',
    placement:a.placement==='above'?'above':'behind', fit:['contain','cover','stretch'].includes(a.fit)?a.fit:'contain',
    x:number(a.x,0,-100,100),y:number(a.y,0,-100,100),width:number(a.width,100,1,200),height:number(a.height,100,1,200),opacity:number(a.opacity,100,0,100)
  }));
}
function imageFromData(source) {
  return new Promise((resolve,reject)=>{
    const image=new Image();
    const timer=setTimeout(()=>{image.src='';reject(new Error('Slika nije ispravna.'));},15000);
    image.onload=()=>{clearTimeout(timer);resolve(image);};
    image.onerror=()=>{clearTimeout(timer);reject(new Error('Slika nije ispravna.'));};
    image.src=source;
  });
}
function hasExternalSVGReference(value){
  if(/@import/i.test(value))return true;
  return [...value.matchAll(/url\(([^)]*)\)/gi)].some(m=>!m[1].trim().replace(/^['"]|['"]$/g,'').startsWith('#'));
}
function safeSVG(data) {
  const raw=new TextDecoder().decode(Uint8Array.from(atob(data),c=>c.charCodeAt(0)));
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new Error('SVG mora biti samostalan, bez spoljnih resursa.');
  const doc=new DOMParser().parseFromString(raw,'image/svg+xml');
  if(doc.querySelector('parsererror') || doc.documentElement.localName!=='svg')throw new Error('Slika nije ispravna.');
  for(const el of [doc.documentElement,...doc.querySelectorAll('*')]){
    if(['script','foreignObject','iframe','object','embed'].includes(el.localName))throw new Error('SVG mora biti samostalan, bez spoljnih resursa.');
    for(const attr of [...el.attributes]){
      if(/^on/i.test(attr.name))el.removeAttribute(attr.name);
      if(attr.localName==='href' && attr.value && !attr.value.startsWith('#') && !/^data:image\/(png|jpeg|webp);base64,/i.test(attr.value))throw new Error('SVG mora biti samostalan, bez spoljnih resursa.');
      if(hasExternalSVGReference(attr.value))throw new Error('SVG mora biti samostalan, bez spoljnih resursa.');
    }
    if(el.localName==='style' && hasExternalSVGReference(el.textContent))throw new Error('SVG mora biti samostalan, bez spoljnih resursa.');
  }
  doc.querySelectorAll('animate,animateMotion,animateTransform,set').forEach(el=>el.remove());
  return 'data:image/svg+xml;base64,'+btoa(Array.from(new TextEncoder().encode(new XMLSerializer().serializeToString(doc)),c=>String.fromCharCode(c)).join(''));
}
async function normalizeGraphic(item) {
  if(!item || !['image/png','image/jpeg','image/webp','image/svg+xml'].includes(item.mime) || typeof item.data!=='string' || item.data.length>27000000)throw new Error('Izaberi PNG, JPG, WebP ili SVG.');
  const image=await imageFromData(item.mime==='image/svg+xml'?safeSVG(item.data):'data:'+item.mime+';base64,'+item.data);
  if(!image.naturalWidth || !image.naturalHeight || image.naturalWidth*image.naturalHeight>40000000)throw new Error('Slika ima prevelike dimenzije.');
  const scale=Math.min(1,4096/image.naturalWidth,4096/image.naturalHeight);
  const canvas=makeCanvas(Math.max(1,Math.round(image.naturalWidth*scale)),Math.max(1,Math.round(image.naturalHeight*scale)));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/png').split(',')[1];
  if(data.length>10666668)throw new Error('Slika je prevelika (najviše 8 MB).');
  return {name:String(item.name||'Graphic').slice(0,160),data};
}
async function registerGraphicAssets(assets) {
  if(!Array.isArray(assets)||assets.length>64)throw new Error('Slika nije ispravna.');
  for(const a of assets){
    if(!validGraphicID(a.id)||typeof a.data!=='string'||a.data.length>11000000||typeof a.name!=='string')throw new Error('Slika nije ispravna.');
    if(!graphicAssets.has(a.id))graphicAssets.set(a.id,{id:a.id,name:a.name.slice(0,160),data:a.data,image:null});
  }
}
async function ensureGraphicImages(layers) {
  for(const layer of layers||[]){
    const asset=graphicAssets.get(layer.asset);
    if(!asset)throw new Error('Nedostaje slika iz projekta. Uvezi je ponovo.');
    if(!asset.image){
      const image=await imageFromData('data:image/png;base64,'+asset.data);
      if(image.naturalWidth>4096||image.naturalHeight>4096)throw new Error('Slika ima prevelike dimenzije.');
      asset.image=image;
    }
  }
}
function storeGraphicAssets(assets) {
  return new Promise((resolve,reject)=>{
    const requestId=String(++graphicsRequestNumber);
    const timer=setTimeout(()=>{graphicsRequests.delete(requestId);reject(new Error('Čuvanje grafike nije uspelo.'));},30000);
    graphicsRequests.set(requestId,{resolve,reject,timer});
    native({action:'storeGraphics',requestId,assets});
  });
}
function graphicEvent(event) {
  if(event.type==='graphicsStored'){
    const request=graphicsRequests.get(event.requestId);
    if(request){clearTimeout(request.timer);graphicsRequests.delete(event.requestId);if(event.error)request.reject(new Error(event.error));else request.resolve(event.assets);}
    return true;
  }
  if(event.type==='graphicsLoaded'){
    registerGraphicAssets(event.assets).then(()=>ensureGraphicImages(state.graphics)).then(()=>updateUI()).catch(e=>toast(e.message)).finally(()=>{resolveGraphicsReady();updateGraphicTools(true);});
    return true;
  }
  if(event.type==='graphicsImported'){
    graphicsQueue=graphicsQueue.then(async()=>{
      await graphicsReady;
      const accepted=[],warnings=[];
      const available=12-state.graphics.length;
      for(const image of (event.images||[]).slice(0,available)){
        try{accepted.push(await normalizeGraphic(image));}catch(e){warnings.push(String(image.name||'Graphic')+': '+window.KajronI18n.translate(e.message));}
      }
      if((event.images||[]).length>available)warnings.push(window.KajronI18n.translate('Najviše 12 slika po projektu.'));
      if(accepted.length){
        const assets=await storeGraphicAssets(accepted);
        await registerGraphicAssets(assets);
        await ensureGraphicImages(assets.map(a=>({asset:a.id})));
        for(let i=0;i<assets.length;i++)addGraphicLayer(assets[i].id,event.kind==='background'&&i===0?'background':'image',false);
        await ensureGraphicImages(state.graphics);
        updateUI(true);persist();updateGraphicTools(true);
      }
      if(event.warning)warnings.push(event.warning);
      if(warnings.length)toast(warnings.slice(0,3).join(' · '));
    }).catch(e=>toast(e.message));
    return true;
  }
  return false;
}
function addGraphicLayer(asset,kind='image',refresh=true){
  if(state.graphics.length>=12){toast('Najviše 12 slika po projektu.');return;}
  const background=kind==='background';
  const layer={id:'layer_'+Date.now()+'_'+Math.random().toString(36).slice(2,9),asset,enabled:true,anchor:'strip',placement:background?'behind':'above',fit:background?'stretch':'contain',x:0,y:background?0:10,width:background?100:15,height:background?100:80,opacity:100};
  state={...state,textOnly:false,preset:'custom',graphics:[...state.graphics,layer]};
  if(background){
    state.opacity=0;state.accentLine=false;state.labelEnabled=false;state.barStyle='solid';
    const image=graphicAssets.get(asset)?.image;
    if(image && image.naturalHeight/image.naturalWidth>.3){layer.anchor='frame';layer.fit='contain';state.scope='frame';}
    else if(image){state.barHeight=Math.max(48,Math.min(320,Math.round(calc(state).width*image.naturalHeight/image.naturalWidth/2)*2));}
  }
  else if(state.textX<18)state.textX=18;
  selectedGraphic=layer.id;
  if(refresh)ensureGraphicImages(state.graphics).then(()=>{updateUI(true);persist();updateGraphicTools(true);}).catch(e=>toast(e.message));
}
function graphicRect(layer,g,strip){
  const full=layer.anchor==='frame',width=g.width,height=full?g.height:g.barHeight;
  return {x:width*layer.x/100,y:height*layer.y/100+(full?(strip?-g.barY:0):(strip?0:g.barY)),w:width*layer.width/100,h:height*layer.height/100};
}
function paintGraphics(c,s,g,placement,strip=false){
  if(s.textOnly)return;
  for(const layer of s.graphics||[]){
    if(!layer.enabled||layer.placement!==placement)continue;
    const image=graphicAssets.get(layer.asset)?.image;
    if(!image)continue;
    const {x,y,w,h}=graphicRect(layer,g,strip);
    c.save();c.globalAlpha=layer.opacity/100;
    if(layer.fit==='stretch')c.drawImage(image,x,y,w,h);
    else{
      const scale=layer.fit==='cover'?Math.max(w/image.naturalWidth,h/image.naturalHeight):Math.min(w/image.naturalWidth,h/image.naturalHeight);
      const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
      c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
    }
    c.restore();
  }
}
function paintGraphicSelection(c,s,g){
  if(!dragGraphic||s.textOnly)return;
  const layer=s.graphics.find(a=>a.id===selectedGraphic);if(!layer)return;
  const r=graphicRect(layer,g,false);c.save();c.strokeStyle='#cbf77d';c.lineWidth=3;c.setLineDash([12,8]);c.strokeRect(r.x,r.y,r.w,r.h);c.restore();
}
function initGraphicDragging(){
  const point=e=>{const r=preview.getBoundingClientRect();return {x:(e.clientX-r.left)*geometry.width/r.width,y:(e.clientY-r.top)*geometry.height/r.height};};
  preview.addEventListener('pointerdown',e=>{
    if(state.textOnly||e.button!==0)return;
    const p=point(e);
    const layers=[...state.graphics].filter(a=>a.enabled);
    const layer=layers.reverse().find(a=>{const r=graphicRect(a,geometry,false);return p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;});
    if(!layer)return;
    selectedGraphic=layer.id;dragGraphic={...p,x0:layer.x,y0:layer.y,anchor:layer.anchor};preview.setPointerCapture(e.pointerId);e.preventDefault();updateGraphicTools(true);paintPreview(playTime);
  });
  preview.addEventListener('pointermove',e=>{
    if(!dragGraphic)return;
    const p=point(e),x=dragGraphic.x0+(p.x-dragGraphic.x)*100/geometry.width,y=dragGraphic.y0+(p.y-dragGraphic.y)*100/(dragGraphic.anchor==='frame'?geometry.height:geometry.barHeight);
    state=sanitize({...state,preset:'custom',graphics:state.graphics.map(a=>a.id===selectedGraphic?{...a,x:Math.round(x*10)/10,y:Math.round(y*10)/10}:a)});updateUI();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])preview.addEventListener(type,()=>{if(!dragGraphic)return;dragGraphic=null;updateUI(true);persist();});
}
function updateGraphicTools(rebuild=false){
  if(!$('graphic-layers'))return;
  if(!state.graphics.some(a=>a.id===selectedGraphic))selectedGraphic=state.graphics.at(-1)?.id||'';
  if(rebuild){
    const container=$('graphic-layers');container.replaceChildren();
    for(const layer of state.graphics){
      const asset=graphicAssets.get(layer.asset),button=document.createElement('button');
      button.className='graphic-layer';button.type='button';button.setAttribute('aria-pressed',String(layer.id===selectedGraphic));
      if(asset){const img=document.createElement('img');img.src='data:image/png;base64,'+asset.data;img.alt='';button.append(img);}
      const name=document.createElement('span');name.dataset.userContent='';name.textContent=asset?.name||'—';button.append(name);
      button.addEventListener('click',()=>{selectedGraphic=layer.id;updateGraphicTools(true);});container.append(button);
    }
    const select=$('graphic-library'),previous=select.value;select.replaceChildren(new Option('—',''));
    for(const asset of graphicAssets.values())select.add(new Option(asset.name,asset.id));
    if(graphicAssets.has(previous))select.value=previous;
  }
  preview.style.touchAction=state.graphics.length&&!state.textOnly?'none':'auto';
  $('graphics-empty').hidden=state.graphics.length>0;
  $('text-only-graphics-note').hidden=!state.textOnly;
  $('text-only-primary').setAttribute('aria-pressed',String(state.textOnly));
  const layer=state.graphics.find(a=>a.id===selectedGraphic);
  $('graphic-controls').hidden=!layer;
  if(layer)for(const key of ['enabled','anchor','placement','fit','x','y','width','height','opacity']){
    const el=$('graphic-'+key);if(el.type==='checkbox')el.checked=layer[key];else el.value=layer[key];el.disabled=state.textOnly;
  }
}
const designKeys=['labelEnabled','label','labelUppercase','labelShape','fontSize','bold','uppercase','barHeight','textColor','barColor','accentColor','labelColor','opacity','radius','accentLine','barStyle','textOnly','textX','textY','textWidth','textHeight','graphics'];
let savedDesigns=[];
function loadSavedDesigns(){try{const values=JSON.parse(localStorage.getItem('kajron-atomic-designs-v1'));if(Array.isArray(values))savedDesigns=values.slice(0,12).filter(a=>a&&typeof a.name==='string'&&a.settings).map(a=>({name:a.name.slice(0,80),settings:a.settings}));}catch{}}
function refreshSavedDesigns(){
  $('saved-designs').replaceChildren(new Option(window.KajronI18n.translate('Moji izgledi…'),''));
  savedDesigns.forEach((a,i)=>$('saved-designs').add(new Option(a.name,String(i))));
}
function windowGraphicAsset(id){const asset=graphicAssets.get(id);if(!asset)throw new Error('Nedostaje slika iz projekta. Uvezi je ponovo.');return asset;}
function initDesignTools(){
  loadSavedDesigns();
  for(const [id,kind] of [['add-background','background'],['add-image','image']])$(id).addEventListener('click',()=>native({action:'importGraphics',kind}));
  $('reuse-graphic').addEventListener('click',()=>{const id=$('graphic-library').value;if(graphicAssets.has(id))addGraphicLayer(id);});
  for(const key of ['enabled','anchor','placement','fit','x','y','width','height','opacity'])$('graphic-'+key).addEventListener('input',event=>{
    const layer=state.graphics.find(a=>a.id===selectedGraphic);if(!layer)return;
    const el=event.target;if(el.type==='number'&&(!el.value||!el.validity.valid))return;
    const value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
    state=sanitize({...state,preset:'custom',graphics:state.graphics.map(a=>a===layer?{...a,[key]:value}:a)});
    if(key==='anchor'&&value==='frame')state.scope='frame';
    updateUI(true);persist();
  });
  $('remove-graphic').addEventListener('click',()=>{state={...state,preset:'custom',graphics:state.graphics.filter(a=>a.id!==selectedGraphic)};updateUI();persist();updateGraphicTools(true);});
  for(const [id,front] of [['graphic-back',false],['graphic-front',true]])$(id).addEventListener('click',()=>{
    const layers=[...state.graphics],index=layers.findIndex(a=>a.id===selectedGraphic),target=index+(front?1:-1);
    if(index<0||target<0||target>=layers.length)return;
    [layers[index],layers[target]]=[layers[target],layers[index]];state={...state,preset:'custom',graphics:layers};updateUI();persist();updateGraphicTools(true);
  });
  $('text-only-primary').addEventListener('click',()=>{state=sanitize({...state,textOnly:!state.textOnly,preset:'custom'});updateUI(true);persist();refreshExportAction();});
  $('save-design').addEventListener('click',()=>{
    if(savedDesigns.length>=12){toast('Najviše 12 sačuvanih izgleda.');return;}
    const input=$('design-name'),name=input.value.trim();if(!name){input.focus();return;}
    const settings=Object.fromEntries(designKeys.map(k=>[k,structuredClone(state[k])]));
    const next=[...savedDesigns,{name:name.slice(0,80),settings}];
    try{localStorage.setItem('kajron-atomic-designs-v1',JSON.stringify(next));savedDesigns=next;refreshSavedDesigns();input.value='';toast('Izgled je sačuvan.');}catch{toast('Čuvanje izgleda nije uspelo.');}
  });
  $('saved-designs').addEventListener('change',async event=>{
    const item=savedDesigns[Number(event.target.value)];if(event.target.value===''||!item)return;
    const settings=Object.fromEntries(designKeys.filter(k=>item.settings[k]!==undefined).map(k=>[k,structuredClone(item.settings[k])]));
    try{await graphicsReady;await ensureGraphicImages(settings.graphics);state=sanitize({...state,...settings,preset:'custom'});updateUI(true);persist();updateGraphicTools(true);refreshExportAction();}catch(e){toast(e.message);}
  });
  $('delete-design').addEventListener('click',()=>{
    const value=$('saved-designs').value;if(value==='')return;
    const next=savedDesigns.filter((_,i)=>i!==Number(value));
    try{localStorage.setItem('kajron-atomic-designs-v1',JSON.stringify(next));savedDesigns=next;refreshSavedDesigns();}catch{toast('Čuvanje izgleda nije uspelo.');}
  });
  initGraphicDragging();refreshSavedDesigns();updateGraphicTools(true);drawPresetSamples();
  native({action:'loadGraphics'});
}
function drawPresetSamples(){
  for(const item of STUDIO_DESIGNS){
    const canvas=document.querySelector(`[data-preset="${item.id}"] canvas`);if(!canvas)continue;
    canvas.width=640;canvas.height=100;
    const s=sanitize({...defaults,...item.settings,text:'Kajron Atomic Studio',resolution:'custom',customWidth:640,customHeight:360,position:'top',margin:0,barHeight:100,fontSize:36,motion:'static',graphics:[]});
    const g=calc(s),c=canvas.getContext('2d');paintBase(c,s,g,true);paintText(c,s,g,0,true);paintForeground(c,s,g,true);
  }
}
