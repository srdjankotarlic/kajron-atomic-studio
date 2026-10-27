const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../desktop/fonts.js'),'utf8');
const family = 'AtomicFont_' + 'a'.repeat(64);
const asset = {family,label:'Test font',data:Buffer.from([1,2,3,4]).toString('base64')};
function fixture(savedFont = 'Arial') {
  const options = [], notices = [];
  const elements = {font:{append:option=>options.push(option)},'font-library-count':{}};
  const context = vm.createContext({
    Map, Uint8Array, atob: data=>Buffer.from(data,'base64').toString('binary'),
    localStorage:{getItem:()=>JSON.stringify({font:savedFont})},
    FontFace:class{async load(){await new Promise(resolve=>setTimeout(resolve,10));return this;}},
    document:{fonts:{add(){}},createElement:()=>({})},
    enums:{font:['Arial','Verdana']},state:{font:'Arial',preset:'studio'},
    $:id=>elements[id],updateUI(){},persist(){},refreshExportAction(){},toast:message=>notices.push(message)
  });
  vm.runInContext(source,context);
  return {context,options,notices};
}
test('overlapping font loads create one usable option per font',async()=>{
  const f=fixture();
  await Promise.all([f.context.installFontChoices({fonts:[asset]}),f.context.installFontChoices({fonts:[asset],selectedFamily:family})]);
  assert.equal(f.options.length,1);
  assert.equal(f.context.state.font,family);
  assert.equal(f.context.state.preset,'custom');
});
test('slow startup font restore preserves a newer explicit user choice',async()=>{
  const f=fixture(family);
  const loading=f.context.installFontChoices({fonts:[asset]});
  f.context.state.font='Verdana';f.context.noteFontChoice();
  await loading;
  assert.equal(f.context.state.font,'Verdana');
});
test('stored custom font returns after restart when no newer choice was made',async()=>{
  const f=fixture(family);
  await f.context.installFontChoices({fonts:[asset]});
  assert.equal(f.context.state.font,family);
});
test('partial import keeps successful fonts and displays the failure notice',async()=>{
  const f=fixture();
  await f.context.installFontChoices({fonts:[asset],selectedFamily:family,warning:'Broken font was skipped'});
  assert.equal(f.context.state.font,family);
  assert.equal(f.notices.at(-1),'Broken font was skipped');
});
