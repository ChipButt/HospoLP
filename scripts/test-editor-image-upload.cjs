'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const gs=fs.readFileSync('apps-script/Editor.gs','utf8');
const ui=fs.readFileSync('apps-script/EditorUI.html','utf8');
const store=new Map();
let nextOffset=0,expectedSize=0,created=0,sessionUrl='https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=testing';
const MiB=1024*1024;
const response=(code,headers={},data='')=>({
  getResponseCode:()=>code,getAllHeaders:()=>headers,getContentText:()=>data
});
const sent=[];
const folder={getId:()=> 'private-photos-folder'};
const ctx=vm.createContext({
  Date,JSON,Number,Object,String,Array,RegExp,Math,
  PropertiesService:{getScriptProperties:()=>({
    getProperty:key=>store.get(key)||null,
    setProperty:(key,value)=>{store.set(key,value);return null},
    deleteProperty:key=>store.delete(key)
  })},
  Utilities:{
    getUuid:()=> '11111111-1111-4111-8111-111111111111',
    base64Decode:input=>Array.from(Buffer.from(input,'base64')),
  },
  ScriptApp:{getOAuthToken:()=> 'stub-oauth-token'},
  UrlFetchApp:{fetch:(url,config)=>{
    sent.push({url,config});
    if(config.method==='post'){
      assert.equal(url,'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id%2Csize%2Cparents');
      assert.equal(config.headers.Authorization,'Bearer stub-oauth-token');
      const body=JSON.parse(config.payload);
      assert.deepEqual(Array.from(body.parents),['private-photos-folder']);
      assert.ok(!config.payload.includes('stub-oauth-token'));
      expectedSize=Number(config.headers['X-Upload-Content-Length']);nextOffset=0;created++;
      return response(200,{Location:sessionUrl});
    }
    assert.equal(url,sessionUrl);
    assert.equal(config.followRedirects,false);
    const range=config.headers['Content-Range'];
    if(range.startsWith('bytes */')){
      return response(308,nextOffset?{Range:'bytes=0-'+(nextOffset-1)}:{});
    }
    const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
    assert.ok(match,'content range '+range);
    const start=Number(match[1]),end=Number(match[2]),total=Number(match[3]);
    assert.equal(start,nextOffset);assert.equal(total,expectedSize);
    assert.equal(config.payload.length,end-start+1);
    nextOffset=end+1;
    if(nextOffset===expectedSize)
      return response(200,{},JSON.stringify({id:'drive-file-123',size:String(total),parents:['private-photos-folder']}));
    return response(308,{'rAnGe':'bytes=0-'+(nextOffset-1)});
  }}
});
new vm.Script(gs,{filename:'Editor.gs'}).runInContext(ctx);
ctx.requireEditorSession_=(siteId,token)=>{if(siteId!=='bulls-head-bidford'||token!=='valid-token')throw Error('Unauthenticated')};
ctx.getEditorSite_=()=>({site_id:'bulls-head-bidford',repo_full_name:'ChipButt/TheBullsHeadBidford'});
ctx.editorClientPhotosFolder_=()=>folder;
ctx.hashPassword_=(token,salt)=> 'hash:'+salt+':'+token;
function run(name,...args){ctx.args=args;return vm.runInContext(name+'(...args)',ctx)}
assert.match(ui,/IMAGE_SOURCE_LIMIT_BYTES=50\*1024\*1024/);
assert.match(ui,/await archiveOriginalEditorImage\(file\)/);
assert.match(ui,/optimiseEditorImage\(file\)/);
assert.match(ui,/new File\(\[blob\],base\+'\.webp'/);
assert.doesNotMatch(ui,/file\.size>8\*1024\*1024/);
assert.throws(()=>run('startEditorImageArchive','bulls-head-bidford','valid-token',
  {name:'too big.jpg',mimeType:'image/jpeg',size:50*MiB+1}),/50 MB/);
assert.equal(sent.length,0);
assert.throws(()=>run('startEditorImageArchive','bulls-head-bidford','valid-token',
  {name:'danger.svg',mimeType:'image/svg+xml',size:1024}),/Choose a JPG/);
const max=run('startEditorImageArchive','bulls-head-bidford','valid-token',
  {name:'large phone photo.jpg',mimeType:'image/jpeg',size:50*MiB});
assert.equal(max.maxBytes,50*MiB);
assert.equal(max.chunkBytes,2*MiB);
assert.equal(sent.length,1);
assert.throws(()=>run('uploadEditorImageArchiveChunk','bulls-head-bidford','wrong',max.uploadId,0,'AAAA'),/Unauthenticated/);
assert.throws(()=>run('uploadEditorImageArchiveChunk','bulls-head-bidford','valid-token',max.uploadId,1,'AAAA'),/position changed/);
const firstChunk=Buffer.alloc(2*MiB,42).toString('base64');
const first=run('uploadEditorImageArchiveChunk','bulls-head-bidford','valid-token',max.uploadId,0,firstChunk);
assert.equal(first.nextOffset,2*MiB);assert.equal(first.done,false);
const status=run('getEditorImageArchiveStatus','bulls-head-bidford','valid-token',max.uploadId);
assert.equal(status.nextOffset,2*MiB);
assert.equal(created,1);
// Independent upload completing with an irregular-sized final chunk.
const short=run('startEditorImageArchive','bulls-head-bidford','valid-token',
  {name:'phone.jpg',mimeType:'image/jpeg',size:2*MiB+5});
const a=run('uploadEditorImageArchiveChunk','bulls-head-bidford','valid-token',short.uploadId,0,firstChunk);
assert.equal(a.done,false);
const b=run('uploadEditorImageArchiveChunk','bulls-head-bidford','valid-token',short.uploadId,2*MiB,Buffer.from('12345').toString('base64'));
assert.equal(b.done,true);assert.equal(b.driveFileId,'drive-file-123');
assert.equal(b.backedUp,true);
assert.equal(store.has('chipin-image-upload:'+short.uploadId),false);
assert.throws(()=>run('getEditorImageArchiveStatus','bulls-head-bidford','valid-token',short.uploadId),/expired/);
console.log('50 MB editor original-image archive, MIME, chunk and resume tests passed.');
