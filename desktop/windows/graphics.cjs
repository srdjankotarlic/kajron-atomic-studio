'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash,randomUUID} = require('node:crypto');
const PNG = Buffer.from([137,80,78,71,13,10,26,10]);
const validID = id => typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
async function readGraphics(folder) {
  const names = (await fs.readdir(folder).catch(()=>[])).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).slice(0,64);
  const result=[];
  let total=0;
  for(const name of names) {
    try {
      const item=JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));
      if(!validID(item.id)||name!==item.id+'.json'||typeof item.name!=='string')continue;
      const file=path.join(folder,item.id+'.png');
      if((await fs.stat(file)).size>8000000)continue;
      const data=await fs.readFile(file);
      total+=data.length;
      if(total>64000000)break;
      if(!data.subarray(0,8).equals(PNG))continue;
      result.push({id:item.id,name:item.name.slice(0,160),data:data.toString('base64')});
    }catch{}
  }
  return result;
}
async function storeGraphics(folder,assets) {
  if(!Array.isArray(assets)||assets.length>12)throw new Error('Najviše 12 slika po projektu.');
  const library=await readGraphics(folder);
  const known=new Set(library.map(a=>a.id));
  let total=library.reduce((n,a)=>n+Buffer.byteLength(a.data,'base64'),0);
  const prepared=assets.map(item=>{
    if(typeof item?.data!=='string'||item.data.length>11000000)throw new Error('Slika je prevelika (najviše 8 MB).');
    const bytes=Buffer.from(item.data,'base64');
    if(bytes.length>8000000||!bytes.subarray(0,8).equals(PNG))throw new Error('Slika nije ispravna.');
    const id=createHash('sha256').update(bytes).digest('hex');
    if(item.id&&item.id!==id)throw new Error('Slika nije ispravna.');
    if(!known.has(id)){
      total+=bytes.length;known.add(id);
      if(known.size>64||total>64000000)throw new Error('Biblioteka grafika je puna (64 slike / 64 MB).');
    }
    return {id,name:String(item.name||'Graphic').slice(0,160),bytes};
  });
  await fs.mkdir(folder,{recursive:true});
  for(const item of prepared){
    const staging=path.join(folder,randomUUID()+'.tmp');
    try{
      await fs.writeFile(staging,item.bytes);
      await fs.rename(staging,path.join(folder,item.id+'.png'));
      await fs.writeFile(path.join(folder,item.id+'.json'),JSON.stringify({id:item.id,name:item.name}));
    }finally{await fs.rm(staging,{force:true}).catch(()=>{});}
  }
  return prepared.map(a=>({id:a.id,name:a.name,data:a.bytes.toString('base64')}));
}
module.exports={readGraphics,storeGraphics};
