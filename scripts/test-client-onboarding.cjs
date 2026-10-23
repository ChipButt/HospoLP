const fs=require('fs');
const vm=require('vm');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const properties=new Map();
const cache=new Map();
const sent=[];
const folderById=new Map();
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
 ScriptApp:{getService(){return {getUrl(){return 'https://script.google.com/macros/s/TEST/exec'}}}},
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
const codeJs=fs.readFileSync('apps-script/Code.gs','utf8');
assert.match(codeJs,/mode === 'onboard-admin'/);
assert.match(codeJs,/mode === 'onboard-upload'/);
const adminHtml=fs.readFileSync('apps-script/ClientOnboardingAdmin.html','utf8');
const uploadHtml=fs.readFileSync('apps-script/ClientOnboardingUpload.html','utf8');
assert.match(adminHtml,/ownerKey/);
assert.match(uploadHtml,/Original camera|Original files|original/i);
console.log('PASS: owner sign-in protection, approved-quote gating, idempotent workspace creation, private subfolders, upload-only token, file validation, status manifest, ready notification and client invitation.');
