const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createHash}=require('node:crypto');
const {readGraphics,storeGraphics}=require('../desktop/windows/graphics.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
test('graphics are content-addressed, deduplicated and restored from disk',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atomic-graphics-'));
 try{
  const input={name:'Client logo čć.png',data:png.toString('base64')};
  const [a]=await storeGraphics(dir,[input]);
  assert.equal(a.id,createHash('sha256').update(png).digest('hex'));
  await storeGraphics(dir,[{...input,name:'Renamed logo.png'}]);
  const assets=await readGraphics(dir);assert.equal(assets.length,1);assert.equal(assets[0].data,input.data);
  assert.equal((await fs.readdir(dir)).filter(n=>n.endsWith('.png')).length,1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('a mismatched embedded image ID cannot overwrite an existing asset',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'atomic-graphics-'));
 try{
  const [a]=await storeGraphics(dir,[{name:'keep.png',data:png.toString('base64')}]);
  await assert.rejects(storeGraphics(dir,[{id:'0'.repeat(64),name:'bad.png',data:png.toString('base64')}]),/Slika/);
  await assert.rejects(storeGraphics(dir,[{name:'bad.svg',data:Buffer.from('<svg/>').toString('base64')}]),/Slika/);
  const assets=await readGraphics(dir);assert.equal(assets.length,1);assert.equal(assets[0].id,a.id);assert.equal(assets[0].name,'keep.png');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
