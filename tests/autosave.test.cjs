const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../desktop/base/renderer.js'),'utf8');
const start=source.indexOf('function persist()');
const code=source.slice(start,source.indexOf('const preview',start));
test('last text edit is saved before closing can discard a debounce timer',()=>{
  const saved={};
  const state={text:'Last keystroke ČĆŽŠĐ ★',font:'Arial'};
  const context=vm.createContext({state,storeTimer:null,clearTimeout(){},setTimeout(){return 1;},settingsForStorage:value=>value,toast(){},localStorage:{setItem:(key,value)=>{saved[key]=JSON.parse(value);}}});
  vm.runInContext(code,context);context.persist();
  assert.equal(saved['kajron-studio-project-v1']?.text,state.text);
});
test('unavailable storage gives a notice while preserving the active project',()=>{
  const notices=[];const state={text:'Keep active text'};
  const context=vm.createContext({state,storeTimer:null,clearTimeout(){},setTimeout(){return 1;},settingsForStorage:value=>value,toast:message=>notices.push(message),localStorage:{setItem(){throw new Error('Storage unavailable');}}});
  vm.runInContext(code,context);assert.doesNotThrow(()=>context.persist());
  assert.equal(state.text,'Keep active text');assert.equal(notices.length,1);
});
