// Integration test of the shipped main process. Only native file-picker answers
// are automated; renderer, preload, trusted IPC, font storage and encoder are real.
const {app,BrowserWindow,dialog,Menu,shell} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const reportPath = process.env.KAJRON_SMOKE_REPORT || path.join(os.tmpdir(),'atomic-native-report.json');
const output = path.dirname(reportPath);
const profile = path.join(os.tmpdir(),'atomic-native-'+process.pid);
app.setPath('userData',profile);
let nextSave=null, nextOpen=[], win, timer;
const report={platform:process.platform,electron:process.versions.electron,checks:[],exports:[]};
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(check, label, limit=20000) {
  const deadline=Date.now()+limit;
  while(Date.now()<deadline) {if(await check())return;await delay(50);}
  throw new Error('Timed out: '+label);
}
const evaluate = code => win.webContents.executeJavaScript(code);
async function check(name,run) {await run();report.checks.push(name);}
async function finish(error) {
  clearTimeout(timer);
  report.pass=!error;
  if(error)report.error=error.stack||String(error);
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(reportPath,JSON.stringify(report,null,2));
  app.exit(error?1:0);
}
dialog.showSaveDialog=async(_window,options)=>{
  const target=nextSave;nextSave=null;
  if(target&&options.title.includes('video')) assert.equal(path.dirname(options.defaultPath),app.getPath('desktop'));
  return {canceled:!target,filePath:target};
};
dialog.showOpenDialog=async()=>{
  const files=nextOpen;nextOpen=[];
  return {canceled:files.length===0,filePaths:files};
};
dialog.showMessageBoxSync=()=>0; // Continue an active export when testing Close.
shell.showItemInFolder=()=>{report.reveal=true;};
require('./main.cjs');
app.whenReady().then(async()=>{
  await fs.mkdir(output,{recursive:true});
  timer=setTimeout(()=>finish(new Error('Native suite timed out')),180000);
  await until(()=>{win=BrowserWindow.getAllWindows()[0];return !!win;},'native window');
  await until(async()=>!win.webContents.isLoading()&&await evaluate("typeof window.KajronI18n==='object'&&fontLibraryLoaded"),'renderer startup');
  win.webContents.on('render-process-gone',(_event,details)=>finish(new Error('Renderer exited: '+details.reason)));
  await check('language, native menus and preserved user text',async()=>{
    const text=await evaluate('state.text');
    await evaluate("window.KajronI18n.select('sr')");
    await until(()=>Menu.getApplicationMenu().items[0].label==='Datoteka','Serbian native menu');
    assert.equal(Menu.getApplicationMenu().items[1].submenu.items[0].label,'Poništi');
    await evaluate("window.KajronI18n.select('en')");
    await until(()=>Menu.getApplicationMenu().items[0].label==='File','English native menu');
    assert.equal(await evaluate('state.text'),text);
  });
  await check('last keystroke survives an immediate renderer restart',async()=>{
    await evaluate("$('text').value='Instant save ČĆŽŠĐ';$('text').dispatchEvent(new Event('input',{bubbles:true}))");
    win.webContents.reload();
    await until(async()=>!win.webContents.isLoading()&&await evaluate('fontLibraryLoaded'),'immediate reload');
    assert.equal(await evaluate('state.text'),'Instant save ČĆŽŠĐ');
  });
  await check('project save, overwrite and open through native IPC',async()=>{
    await evaluate("state=sanitize({...state,text:'Project ČĆŽŠĐ \\u2605',textOnly:true});updateUI(true)");
    const project=path.join(output,"projekat čćžšđ 'test'.json");
    nextSave=project;await evaluate("$('save-project').click()");
    await until(()=>fs.access(project).then(()=>true,()=>false),'saved project');
    assert.equal(JSON.parse(await fs.readFile(project,'utf8')).settings.text,'Project ČĆŽŠĐ ★');
    nextSave=project;await evaluate("$('save-project').click()");
    await delay(200);
    await evaluate("state.text='changed';updateUI(true)");
    nextOpen=[project];await evaluate("$('import-project').click()");
    await until(async()=>await evaluate('state.text')==='Project ČĆŽŠĐ ★','reopened project');
    const bad=path.join(output,'broken.json');await fs.writeFile(bad,'{broken');
    nextOpen=[bad];await evaluate("$('import-project').click()");await delay(200);
    assert.equal(await evaluate('state.text'),'Project ČĆŽŠĐ ★');
  });
  let customFont;
  await check('partial font import skips broken files and keeps successful fonts',async()=>{
    const bad=path.join(output,'broken.ttf');await fs.writeFile(bad,'this is not a font');
    const font=path.join(process.env.WINDIR||'C:\\Windows','Fonts','arial.ttf');
    nextOpen=[font,bad];await evaluate("$('add-fonts').click()");
    await until(async()=>/^AtomicFont_/.test(await evaluate('state.font')),'imported custom font');
    customFont=await evaluate('state.font');
    const files=await fs.readdir(path.join(profile,'fonts'));
    assert.equal(files.filter(name=>name.endsWith('.json')).length,1);
    assert.equal(await evaluate("$('font').options.length"),5);
    assert.match(await evaluate("$('toast').textContent"),/broken.ttf/);
    nextOpen=[font];await evaluate("$('add-fonts').click()");await delay(200);
    assert.equal(await evaluate("$('font').options.length"),5);
  });
  await check('custom font and language survive renderer restart',async()=>{
    await until(async()=>await evaluate("JSON.parse(localStorage.getItem('kajron-studio-project-v1')).font")===customFont,'saved font choice');
    win.webContents.reload();
    await until(async()=>!win.webContents.isLoading()&&await evaluate('fontLibraryLoaded&&state.font')===customFont,'restored custom font');
    assert.equal(await evaluate('window.KajronI18n.language'),'en');
  });
  await evaluate('graphicsReady');
  await check('15 editable designs, text-only shortcut and safe standalone SVG',async()=>{
    assert.equal(await evaluate("document.querySelectorAll('[data-preset]').length"),15);
    const text=await evaluate('state.text');
    for(const id of await evaluate('STUDIO_DESIGNS.map(a=>a.id)')){
      await evaluate(`applyDesign(${JSON.stringify(id)})`);
      assert.equal(await evaluate('state.text'),text);
      assert.equal(await evaluate('state.preset'),id);
      assert.ok(await evaluate('geometry.contentWidth>0&&geometry.contentHeight>0'));
    }
    await evaluate("applyDesign('live');state.label='My Live';state.labelUppercase=false;updateUI(true)");
    assert.equal(await evaluate('labelOf(state)'),'My Live');
    const rejected=await evaluate(`normalizeGraphic({name:'external.svg',mime:'image/svg+xml',data:btoa('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/private.png"/></svg>')}).then(()=>false,()=>true)`);
    assert.equal(rejected,true);
  });
  const artwork=path.join(output,'client-artwork.svg'),logo=path.join(output,'client-logo.png'),broken=path.join(output,'broken-image.png');
  await fs.writeFile(artwork,`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="100"><defs><linearGradient id="g"><stop stop-color="#1347aa"/><stop offset="1" stop-color="#246dd9"/></linearGradient></defs><rect width="640" height="100" fill="url('#g')"/></svg>`);
  const logoData=await evaluate("(()=>{const c=makeCanvas(80,80),x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(5,5,70,70);return c.toDataURL('image/png').split(',')[1]})()");
  await fs.writeFile(logo,Buffer.from(logoData,'base64'));await fs.writeFile(broken,'not an image');
  await check('native mixed image import, SVG rasterization and movable frame/strip layers',async()=>{
    await evaluate("state=sanitize({...state,text:'Client ČĆŽŠĐ',bold:true,resolution:'custom',customWidth:640,customHeight:360,margin:0,position:'bottom',fontSize:32,motion:'static',format:'mov',quality:'compact',transparent:true,staticDuration:5,graphics:[]});updateUI(true)");
    nextOpen=[artwork,logo,broken];await evaluate("$('add-background').click()");
    await until(async()=>await evaluate('state.graphics.length')===2,'mixed image import');
    await evaluate('graphicsQueue');
    assert.equal(await evaluate('state.textOnly'),false);
    assert.match(await evaluate("$('toast').textContent"),/broken-image.png/);
    assert.equal((await fs.readdir(path.join(profile,'graphics'))).filter(n=>n.endsWith('.png')).length,2);
    await evaluate("selectedGraphic=state.graphics[1].id;updateGraphicTools(true);$('graphic-anchor').value='frame';$('graphic-anchor').dispatchEvent(new Event('input',{bubbles:true}));$('graphic-x').value='80';$('graphic-x').dispatchEvent(new Event('input',{bubbles:true}));$('graphic-y').value='5';$('graphic-y').dispatchEvent(new Event('input',{bubbles:true}));$('graphic-height').value='15';$('graphic-height').dispatchEvent(new Event('input',{bubbles:true}));state=sanitize({...state,textX:22,textY:15,textWidth:70,textHeight:70});playing=false;updateUI(true)");
    assert.equal(await evaluate('state.scope'),'frame');
    const p=await evaluate('Array.from(ctx.getImageData(550,40,1,1).data)');
    assert.deepEqual(p,[255,0,0,255]);
    await evaluate("$('graphics-heading').scrollIntoView({block:'start'})");
    await fs.writeFile(path.join(output,'graphics-interface.png'),(await win.webContents.capturePage()).toPNG());
  });
  await check('drag a logo in the actual preview and retain its editable coordinates',async()=>{
    await evaluate('window.scrollTo(0,0)');
    const point=await evaluate("(()=>{const r=preview.getBoundingClientRect();return {x:Math.round(r.left+550*r.width/640),y:Math.round(r.top+40*r.height/360)}})()");
    win.webContents.sendInputEvent({type:'mouseMove',...point});
    win.webContents.sendInputEvent({type:'mouseDown',...point,button:'left',clickCount:1});
    win.webContents.sendInputEvent({type:'mouseMove',x:point.x+20,y:point.y});
    win.webContents.sendInputEvent({type:'mouseUp',x:point.x+20,y:point.y,button:'left',clickCount:1});
    await until(async()=>await evaluate('state.graphics[1].x')>80,'dragged image position');
    await evaluate("$('graphic-x').value='80';$('graphic-x').dispatchEvent(new Event('input',{bubbles:true}))");
  });
  await check('graphics survive export outside the ticker strip and match the Canvas preview',async()=>{
    const expected=await evaluate("(async()=>{await readyTextFont(state);updateUI();paintPreview(0);return preview.toDataURL('image/png').split(',')[1]})()");
    await fs.writeFile(path.join(output,'graphics-expected.png'),Buffer.from(expected,'base64'));
    const target=path.join(output,'graphics.mov');nextSave=target;await evaluate("$('export').click()");
    await until(()=>fs.access(target).then(()=>true,()=>false),'graphics MOV',30000);
    await until(async()=>!(await evaluate('exporting')),'graphics export finished');
  });
  await check('editable custom label with imported bold font matches exported pixels',async()=>{
    await evaluate("state=sanitize({...state,labelEnabled:true,label:'My Live',labelUppercase:false,labelShape:'pill',labelColor:'#ffffff',accentColor:'#b92744'});updateUI(true)");
    const expected=await evaluate("(async()=>{await readyTextFont(state);updateUI();paintPreview(0);return preview.toDataURL('image/png').split(',')[1]})()");
    await fs.writeFile(path.join(output,'label-expected.png'),Buffer.from(expected,'base64'));
    const target=path.join(output,'custom-label.mov');nextSave=target;await evaluate("$('export').click()");
    await until(()=>fs.access(target).then(()=>true,()=>false),'custom label MOV',30000);
    await until(async()=>!(await evaluate('exporting')),'custom label finished');
    await evaluate("state=sanitize({...state,labelEnabled:false});updateUI(true)");
  });
  await check('portable project embeds artwork and restores it into a clean graphics library',async()=>{
    const project=path.join(output,'project-with-artwork.json');nextSave=project;await evaluate("$('save-project').click()");
    await until(()=>fs.access(project).then(()=>true,()=>false),'embedded project');
    const data=JSON.parse(await fs.readFile(project,'utf8'));
    assert.equal(data.version,2);assert.equal(data.graphicAssets.length,2);assert.equal(data.settings.graphics.length,2);
    await fs.rm(path.join(profile,'graphics'),{recursive:true});
    await evaluate("graphicAssets.clear();state=sanitize({...state,graphics:[],text:'temporary'});updateUI(true)");
    nextOpen=[project];await evaluate("$('import-project').click()");
    await until(async()=>await evaluate('state.graphics.length')===2,'portable artwork restore');
    assert.equal(await evaluate('state.text'),'Client ČĆŽŠĐ');
    assert.equal((await fs.readdir(path.join(profile,'graphics'))).filter(n=>n.endsWith('.png')).length,2);
  });
  await check('saved user design and artwork persist across restart without changing ticker text',async()=>{
    await evaluate("$('design-name').value='Client Brand';$('save-design').click();persist()");
    win.webContents.reload();await until(async()=>!win.webContents.isLoading()&&await evaluate('fontLibraryLoaded'),'artwork restart');
    await evaluate('graphicsReady');
    assert.equal(await evaluate('state.graphics.length'),2);
    assert.equal(await evaluate('savedDesigns[0].name'),'Client Brand');
    await evaluate("state.text='Keep this user text';applyDesign('news');$('saved-designs').value='0';$('saved-designs').dispatchEvent(new Event('change',{bubbles:true}))");
    await until(async()=>await evaluate('state.graphics.length')===2,'saved design restore');
    assert.equal(await evaluate('state.text'),'Keep this user text');
  });
  await check('text-only mode hides all retained images and exports fully transparent empty regions',async()=>{
    await evaluate("$('text-only-primary').click();state=sanitize({...state,text:'Only text',font:'Arial',radius:0,textX:0,textY:0,textWidth:100,textHeight:100});playing=false;updateUI(true);paintPreview(0)");
    assert.equal(await evaluate('state.graphics.length'),2);
    assert.equal(await evaluate('state.textOnly'),true);
    assert.deepEqual(await evaluate('Array.from(ctx.getImageData(550,40,1,1).data)'),[0,0,0,0]);
    const expected=await evaluate("preview.toDataURL('image/png').split(',')[1]");await fs.writeFile(path.join(output,'text-only-expected.png'),Buffer.from(expected,'base64'));
    const target=path.join(output,'graphics-text-only.mov');nextSave=target;await evaluate("$('export').click()");
    await until(()=>fs.access(target).then(()=>true,()=>false),'text-only artwork MOV',30000);
    await until(async()=>!(await evaluate('exporting')),'text-only artwork finished');
    await evaluate("state=sanitize({...state,graphics:[],textX:0,textY:0,textWidth:100,textHeight:100});updateUI(true)");
  });
  const cases=[
    {format:'webm',quality:'compact',transparent:true,textOnly:false,motion:'left',scope:'frame'},
    {format:'webm',quality:'compact',transparent:false,textOnly:false,motion:'right',scope:'strip'},
    {format:'mov',quality:'compact',transparent:true,textOnly:true,motion:'left',scope:'strip'},
    {format:'mov',quality:'balanced',transparent:false,textOnly:false,motion:'static',scope:'frame'},
    {format:'mp4',quality:'balanced',transparent:false,textOnly:false,motion:'right',scope:'strip'},
    {format:'mov',quality:'high',transparent:true,textOnly:true,motion:'static',scope:'strip'}
  ];
  for(let index=0;index<cases.length;index++){
    const settings=cases[index];
    const target=path.join(output,`native-${index}.${settings.format}`);
    nextSave=target;
    await evaluate(`state=sanitize({...state,text:'Atomic ČĆŽŠĐ',fontSize:32,labelEnabled:true,label:'LIVE',gap:40,speed:350,staticDuration:5,resolution:'custom',customWidth:640,customHeight:360,fps:25,radius:12,...${JSON.stringify(settings)}});updateUI(true);$('export').click()`);
    await until(()=>fs.access(target).then(()=>true,()=>false),'native '+settings.format+' export',30000);
    await until(async()=>!(await evaluate('exporting')),'unlocked export buttons');
    const bytes=await fs.readFile(target);
    if(settings.format==='webm')assert.equal(bytes.subarray(0,4).toString('hex'),'1a45dfa3');
    else assert.equal(bytes.subarray(4,8).toString('ascii'),'ftyp');
    report.exports.push({...settings,bytes:bytes.length,file:path.basename(target)});
    assert.match(await evaluate("$('download-again').textContent"),/folder/);
  }
  await check('lossless MOV color fixture through the shipped IPC and encoder',async()=>{
    const target=path.join(output,'pixel-perfect.mov');nextSave=target;
    const expected=await evaluate(`(async()=>{
      const s=sanitize({...state,format:'mov',quality:'compact',textOnly:true,transparent:true,motion:'static',scope:'strip',resolution:'custom',customWidth:640,customHeight:360,barHeight:100,fps:25});
      const g=calc(s);g.frames=1;
      const rendered=await renderLayers(s,g);
      const pattern=makeCanvas(640,100),c=pattern.getContext('2d'),data=c.createImageData(640,100);
      for(let y=0;y<100;y++)for(let x=0;x<640;x++){
        const offset=(y*640+x)*4;data.data.set(x%2?[255,0,0,255]:[0,255,255,255],offset);
      }
      c.putImageData(data,0,0);
      rendered.track=await pngBytes(pattern);
      const layers={};for(const key of ['base','track','fg','mask'])layers[key]=await encodeBase64(rendered[key]);
      exporting=true;
      native({action:'export',layers,args:buildCommand(s,g),format:'mov',frames:1,name:'pixel-perfect.mov'});
      return layers.track;
    })()`);
    await fs.writeFile(path.join(output,'pixel-expected.png'),Buffer.from(expected,'base64'));
    await until(()=>fs.access(target).then(()=>true,()=>false),'lossless pixel fixture');
    await until(async()=>!(await evaluate('exporting')),'lossless fixture finished');
  });
  await check('cancel and close preserve the previous target video',async()=>{
    const target=path.join(output,'cancel-preserved.webm');await fs.writeFile(target,'keep previous video');
    nextSave=target;
    await evaluate("state=sanitize({...state,format:'webm',quality:'high',textOnly:true,transparent:true,motion:'static',staticDuration:30,resolution:'1920x1080',scope:'frame',fps:60});updateUI(true);$('export').click()");
    await until(async()=>await evaluate("exporting&&$('encode-progress').value>=5"),'active encoder');
    win.close();assert.equal(win.isDestroyed(),false);
    await evaluate("$('cancel-export').click()");
    await until(async()=>!(await evaluate('exporting')),'cancelled export');
    assert.equal(await fs.readFile(target,'utf8'),'keep previous video');
    assert.equal((await fs.readdir(output)).some(name=>name.startsWith('.kajron-')),false);
  });
  await check('re-export after cancellation and overwrite an existing file',async()=>{
    const target=path.join(output,'cancel-preserved.webm');nextSave=target;
    await evaluate("state=sanitize({...state,text:'After cancel',staticDuration:5,resolution:'custom',customWidth:640,customHeight:360,scope:'strip',fps:25});updateUI(true);$('export').click()");
    await until(async()=>{const data=await fs.readFile(target);return data.subarray(0,4).toString('hex')==='1a45dfa3';},'overwrite after cancel',30000);
    await until(async()=>!(await evaluate('exporting')),'finished re-export');
    await evaluate("$('download-again').click()");await until(()=>report.reveal,'show output folder');
  });
  await check('empty and oversized text fail cleanly without locking the app',async()=>{
    await evaluate("state.text='   ';updateUI(true);$('export').click()");
    assert.equal(await evaluate('exporting'),false);
    await evaluate("state=sanitize({...state,text:'W'.repeat(1500),fontSize:120,motion:'left'});updateUI(true);$('export').click()");
    await until(async()=>!(await evaluate('exporting')),'oversized text failure');
    assert.equal(await evaluate("$('export').disabled"),false);
  });
  await check('minimum window size has no horizontal overflow',async()=>{
    win.setSize(960,700);await delay(100);
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  });
  await finish();
}).catch(finish);
