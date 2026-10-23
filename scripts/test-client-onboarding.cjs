const fs=require('fs');
const vm=require('vm');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const properties=new Map();
const cache=new Map();
const sent=[];
const folderById=new Map();
const pendingDriveUploads=new Map();
let resumableCounter=0;
const fakeResponse=(code,body,headers)=>({
 getResponseCode(){return code},getContentText(){return body||''},getAllHeaders(){return headers||{}}
});
function fakeDriveFetch(url,options){
 const cfg=options||{};
 if(cfg.method==='post'&&url.includes('uploadType=resumable')){
   const payload=JSON.parse(cfg.payload);
   const id='driveupload-'+(++resumableCounter);
   pendingDriveUploads.set(id,{name:payload.name,total:Number(cfg.headers['X-Upload-Content-Length']),size:0});
   return fakeResponse(200,'',{Location:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id='+id});
 }
 const id=String(url).split('upload_id=')[1];
 const record=pendingDriveUploads.get(id);
 if(!record)throw Error('Unknown resumable upload URI');
 const range=cfg.headers['Content-Range'];
 if(range.startsWith('bytes */')){
  if(record.size===record.total)return fakeResponse(200,JSON.stringify({id,name:record.name}));
  return fakeResponse(308,'',record.size?{'Range':'bytes=0-'+(record.size-1)}:{});
 }
 const match=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
 if(!match)throw Error('Invalid range '+range);
 const start=Number(match[1]),end=Number(match[2]),total=Number(match[3]);
 assert.equal(total,record.total);
 assert.equal(start,record.size);
 assert.equal(end-start+1,cfg.payload.length);
 record.size+=cfg.payload.length;
 if(record.size===record.total)return fakeResponse(200,JSON.stringify({id,name:record.name}));
 return fakeResponse(308,'',{'Range':'bytes=0-'+(record.size-1)});
}

let uuid=1,folderNumber=0;
function mkFolder(name,parent=null) {
 const id='folder-'+(++folderNumber);
 const children=[],files=[];
 const item={
  name,id,children,files,parent,
  getName(){return name},getId(){return id},
  getUrl(){return 'https://drive.google.com/drive/folders/'+id},
  createFolder(n){const f=mkFolder(n,item);children.push(f);return f},
  createFile(n,data,mime){
   if(typeof n!=='string'){const blob=n;n=blob.name;data=blob.data;mime=blob.mime;}
   const f={name:n,data,mime,getName(){return this.name},setContent(v){this.data=v},getContent(){return this.data}};
   files.push(f);return f;
  },
  getFilesByName(n){const arr=files.filter(f=>f.name===n);return{hasNext(){return arr.length>0},next(){return arr.shift()}}}
 };
 folderById.set(id,item);return item;
}
const root=mkFolder('Chip In — Website Client Assets');
folderById.set('1cLuFi32Zry5uswOjbeEIFwGllYV7TzbB',root);
const context={
 PropertiesService:{getScriptProperties(){return{
  getProperty(k){return properties.has(k)?properties.get(k):null},
  setProperty(k,v){properties.set(k,String(v))},
  deleteProperty(k){properties.delete(k)},
  getProperties(){return Object.fromEntries(properties)}
 }}},
 CacheService:{getScriptCache(){return{
  get(k){return cache.get(k)||null},put(k,v){cache.set(k,String(v))},remove(k){cache.delete(k)}
 }}},
 Utilities:{
  DigestAlgorithm:{SHA_256:'SHA_256'},Charset:{UTF_8:'UTF_8'},
  computeDigest(_,s){return Array.from(crypto.createHash('sha256').update(s).digest())},
  getUuid(){const h=(uuid++).toString(16).padStart(32,'0');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)},
  formatDate(){return '2026-10-23'},
  base64Decode(s){return Array.from(Buffer.from(s,'base64'))},
  newBlob(data,mime,name){return{name,mime,data}}
 },
 LockService:{getScriptLock(){return {waitLock(){},releaseLock(){}}}},
 DriveApp:{getFolderById(id){if(!folderById.has(id))throw Error('Unknown folder '+id);return folderById.get(id)}},
 ScriptApp:{getService(){return {getUrl(){return 'https://script.google.com/macros/s/TEST/exec'}}},getOAuthToken(){return 'fake-oauth-token'}},
 UrlFetchApp:{fetch:fakeDriveFetch},
 Session:{getEffectiveUser(){return {getEmail(){return 'owner@chipin.example'}}},getScriptTimeZone(){return 'Europe/London'}},
 MimeType:{PLAIN_TEXT:'text/plain'},
 MailApp:{sendEmail(msg){sent.push(msg)}},
 console
};
vm.createContext(context);
const src=fs.readFileSync('apps-script/ClientOnboarding.gs','utf8');
new vm.Script(src,{filename:'ClientOnboarding.gs'}).runInContext(context);
function invoke(expr){return vm.runInContext(expr,context);}
assert.throws(()=>invoke("onboardingAuthenticate('test-key')"),/setup required/i);
properties.set('CHIP_IN_ONBOARDING_ADMIN_KEY','test-key-with-32-characters-secret');
assert.throws(()=>invoke("onboardingAuthenticate('wrong')"),/incorrect/i);
const login=invoke("onboardingAuthenticate('test-key-with-32-characters-secret')");
assert.equal(typeof login.session,'string');
context.session=login.session;
assert.throws(()=>invoke("clientOnboardingCreateWorkspace('bad',{})"),/session/i);
assert.throws(()=>invoke("clientOnboardingCreateWorkspace(session,{business:'Test Cafe',email:'a@test.com',meetingId:'mid',approved:false})"),/approved/i);
const payload={business:'Test Cafe',email:'a@test.com',contact:'Ms A',approved:true,meetingId:'meeting-123',brief:{fields:{includedPages:['Home','Food / Menu'],domainChoice:'chipin'}}};
context.payload=payload;
const first=invoke("clientOnboardingCreateWorkspace(session,payload)");
assert.equal(first.created,true);
assert.match(first.uploadUrl,/mode=onboard-upload/);
assert.equal(root.children.length,1);
assert.equal(root.children[0].children.length,4);
assert.ok(root.children[0].files.find(x=>x.name==='approved-website-brief.json'));
const second=invoke("clientOnboardingCreateWorkspace(session,payload)");
assert.equal(second.created,false);
assert.equal(root.children.length,1);
assert.equal(second.id,first.id);
const code=new URL(first.uploadUrl).searchParams.get('code');
context.code=code;
const initial=invoke("clientOnboardingClientInfo(code)");
assert.equal(initial.filesReceived,0);
assert.throws(()=>invoke("clientOnboardingClientInfo('invalid')"),/invalid/i);
assert.throws(()=>invoke("clientOnboardingUploadAsset('invalid',{category:'brand'})"),/invalid/i);
context.file={name:'logo.png',category:'brand',mimeType:'image/png',data:Buffer.from('test file').toString('base64')};
const uploaded=invoke("clientOnboardingUploadAsset(code,file)");
assert.equal(uploaded.fileCount,1);
const status=invoke("clientOnboardingWorkspaceStatus(session,"+JSON.stringify(first.id)+")");
assert.equal(status.fileCount,1);
assert.equal(status.status,'files_received');
const manifest=root.children[0].files.find(x=>x.name==='upload-status.json');
assert.equal(JSON.parse(manifest.data).filesReceived,1);
assert.throws(()=>invoke("clientOnboardingUploadAsset(code,{name:'script.js',category:'other',mimeType:'application/javascript',data:'MQ=='})"),/format/i);
const completed=invoke("clientOnboardingFinishUploads(code)");
assert.equal(completed.success,true);
assert.equal(invoke("clientOnboardingClientInfo(code)").status,'ready_for_review');
assert.equal(JSON.parse(manifest.data).status,'ready_for_review');
assert.equal(sent.length,1);
const invited=invoke("clientOnboardingEmailInvitation(session,"+JSON.stringify(first.id)+")");
assert.equal(invited.email,'a@test.com');
assert.equal(sent.length,2);
const workspaces=invoke("clientOnboardingListWorkspaces(session)");
assert.equal(workspaces.length,1);
assert.equal(workspaces[0].status,'ready_for_review');
// Test resumable uploads: server-authorised 4 MiB chunks, progress, limits and completion.
context.newFile={name:'Original_Image_6MB.png',mimeType:'image/png',category:'photos',size:6*1024*1024};
const started=invoke('clientOnboardingBeginUpload(code,newFile)');
assert.equal(started.nextByte,0);
assert.equal(started.chunkBytes,4*1024*1024);
context.resumableId=started.uploadId;
assert.throws(()=>invoke("clientOnboardingBeginUpload(code,{name:'different.png',mimeType:'image/png',category:'photos',size:10})"),/unfinished/i);
const restored=invoke('clientOnboardingBeginUpload(code,newFile)');
assert.equal(restored.resumed,true);
context.chunk1=Buffer.alloc(4*1024*1024).toString('base64');
const c1=invoke('clientOnboardingUploadChunk(code,resumableId,0,chunk1)');
assert.equal(c1.complete,false);
assert.equal(c1.nextByte,4*1024*1024);
const status1=invoke('clientOnboardingResumeUpload(code,resumableId)');
assert.equal(status1.nextByte,4*1024*1024);
context.chunk2=Buffer.alloc(2*1024*1024).toString('base64');
const c2=invoke('clientOnboardingUploadChunk(code,resumableId,4194304,chunk2)');
assert.equal(c2.complete,true);
assert.equal(c2.nextByte,6*1024*1024);
assert.equal(invoke('clientOnboardingClientInfo(code)').filesReceived,2);
assert.equal(JSON.parse(manifest.data).filesReceived,2);
context.excess={name:'huge-image.png',mimeType:'image/png',category:'photos',size:101*1024*1024};
assert.throws(()=>invoke('clientOnboardingBeginUpload(code,excess)'),/100 MB/i);
context.bigDoc={name:'huge-menu.pdf',mimeType:'application/pdf',category:'menus',size:26*1024*1024};
assert.throws(()=>invoke('clientOnboardingBeginUpload(code,bigDoc)'),/25 MB/i);
context.maxImage={name:'max-photo.png',mimeType:'image/png',category:'photos',size:100*1024*1024};
const big=invoke('clientOnboardingBeginUpload(code,maxImage)');
assert.equal(big.fileSize,100*1024*1024);
assert.equal(big.chunkBytes,4194304);
assert.equal(invoke('clientOnboardingClientInfo(code)').maxImageBytes,100*1024*1024);
assert.throws(()=>invoke("clientOnboardingFinishUploads(code)"),/still in progress/i);
// Upload the full 100 MiB image in 25 x 4 MiB mocked Drive-confirmed chunks.
context.bigUploadId=big.uploadId;
for(let offset=0;offset<100*1024*1024;offset+=4*1024*1024){
  const response=invoke('clientOnboardingUploadChunk(code,bigUploadId,'+offset+',chunk1)');
  assert.equal(response.nextByte,offset+4*1024*1024);
  if(offset+4*1024*1024===100*1024*1024)assert.equal(response.complete,true);
}
assert.equal(invoke('clientOnboardingClientInfo(code)').filesReceived,3);
assert.equal(JSON.parse(manifest.data).filesReceived,3);
assert.equal(invoke('clientOnboardingFinishUploads(code)').success,true);
const previousNotifies=sent.length;
assert.equal(invoke('clientOnboardingFinishUploads(code)').success,true);
assert.equal(sent.length,previousNotifies); // Re-clicking "finished" does not email-spam the owner.

const uploadText=fs.readFileSync('apps-script/ClientOnboardingUpload.html','utf8');
assert.match(uploadText,/id="progressBar"/);
assert.match(uploadText,/100 MB/);
const innerScripts=[...uploadText.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(innerScripts.length,1);
new vm.Script(innerScripts[0][1].replace(/<\?!= uploadToken \?>/,'""'),{filename:'ClientOnboardingUpload.html inline script'});
const adminSource=fs.readFileSync('apps-script/ClientOnboardingAdmin.html','utf8');
assert.match(adminSource,/chipinworks.co.uk\/client-meeting\//);

const codeJs=fs.readFileSync('apps-script/Code.gs','utf8');
assert.match(codeJs,/mode === 'onboard-admin'/);
assert.match(codeJs,/mode === 'onboard-upload'/);
const adminHtml=fs.readFileSync('apps-script/ClientOnboardingAdmin.html','utf8');
const uploadHtml=fs.readFileSync('apps-script/ClientOnboardingUpload.html','utf8');
assert.match(adminHtml,/ownerKey/);
assert.match(uploadHtml,/Original camera|Original files|original/i);
console.log('PASS: quotes and approval, protected client folder creation, 100MB image limit, chunk acknowledgement, resumable progress, upload statuses, and client invitations.');
