const fs=require('fs');
const vm=require('vm');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const properties=new Map();
const cache=new Map();
const sent=[];
const folderById=new Map();
const pendingDriveUploads=new Map();

const fakeClientRepos=new Map(),fakeClientPages=new Map();
let repoCreateCount=0,pagesCreateCount=0,siteStarterCount=0,failPagesOnce=false;
function fakeProvisionFetch(url,config){
 const cfg=config||{};
 const body=cfg.payload?JSON.parse(cfg.payload):null;
 if(url==='https://api.github.com/user')
   return fakeResponse(200,JSON.stringify({login:'ChipButt',id:12345}));
 if(url==='https://api.github.com/user/repos'&&cfg.method==='post'){
   if(!body.private||!body.auto_init)throw Error('Client source must be private and initialised.');
   repoCreateCount++;
   if(fakeClientRepos.has(body.name))return fakeResponse(422,JSON.stringify({message:'Already exists'}));
   const result={id:500+repoCreateCount,owner:{login:'ChipButt'},name:body.name,editorFiles:new Map(),
     full_name:'ChipButt/'+body.name,private:true,default_branch:'main',
     html_url:'https://github.com/ChipButt/'+body.name};
   fakeClientRepos.set(body.name,result);
   return fakeResponse(201,JSON.stringify(result));
 }
 if(url.startsWith('https://api.github.com/repos/ChipButt/')&&url.includes('/contents/index.html')){
   const slug=url.match(/^https:\/\/api.github.com\/repos\/ChipButt\/([^/]+)\//)[1];
   const repoResult=fakeClientRepos.get(slug);
   if(!repoResult)throw Error('Repository was not created');
   if(cfg.method==='get'&&!repoResult.indexHtml)return fakeResponse(404,JSON.stringify({message:'Not Found'}));
   if(cfg.method==='get')return fakeResponse(200,JSON.stringify({type:'file',name:'index.html'}));
   if(cfg.method==='put'){
     const content=Buffer.from(body.content,'base64').toString();
     assert.match(content,/Website in preparation/);
     assert.doesNotMatch(content,/Test Cafe|a@test\.com/);
     repoResult.indexHtml=content;siteStarterCount++;
     return fakeResponse(201,JSON.stringify({commit:{sha:'commit-1'}}));
   }
 }
 if(url.startsWith('https://api.github.com/repos/ChipButt/')&&url.includes('/contents/')){
   const pathMatch=/^https:\/\/api\.github\.com\/repos\/ChipButt\/([^/]+)\/contents\/([^?]+)(?:\?ref=[^&]*)?$/.exec(url);
   if(!pathMatch)throw Error('Unexpected repo contents URL '+url);
   const repo=fakeClientRepos.get(pathMatch[1]);
   if(!repo)throw Error('Unknown private client repo');
   const filename=pathMatch[2].split('/').map(decodeURIComponent).join('/');
   const prior=repo.editorFiles.get(filename);
   if(cfg.method==='get'){
     if(!prior)return fakeResponse(404,JSON.stringify({message:'Not Found'}));
     return fakeResponse(200,JSON.stringify({type:'file',name:filename.split('/').pop(),
       content:Buffer.from(prior).toString('base64'),sha:'sha-'+filename}));
   }
   if(cfg.method==='put'){
     if(prior&&!body.sha)throw Error('Expected content SHA when updating an existing file');
     if(body.branch!=='main')throw Error('Incorrect client repo branch');
     repo.editorFiles.set(filename,Buffer.from(body.content,'base64').toString());
     return fakeResponse(200,JSON.stringify({content:{sha:'updated-'+filename}}));
   }
 }
 if(url.startsWith('https://api.cloudflare.com/client/v4/accounts/1234567890abcdef1234567890abcdef/pages/projects/')&&cfg.method==='get'){
   const slug=url.split('/').pop();
   const stored=fakeClientPages.get(slug);
   return stored
     ?fakeResponse(200,JSON.stringify({success:true,result:{name:slug,subdomain:slug+'.pages.dev',source:stored.source}}))
     :fakeResponse(404,JSON.stringify({success:false,errors:[{message:'Not Found'}]}));
 }
 if(url==='https://api.cloudflare.com/client/v4/accounts/1234567890abcdef1234567890abcdef/pages/projects'){
   if(cfg.method!=='post')throw Error('Unexpected Cloudflare method');
   if(body.source?.type!=='github'||!body.source.config?.repo_name?.startsWith('chipin-')||body.source.config.owner!=='ChipButt')
     throw Error('Cloudflare GitHub source is not linked to client repo');
   assert.equal(body.source.config.production_branch,'main');
   assert.equal(body.source.config.preview_deployment_setting,'none');
   pagesCreateCount++;
   if(failPagesOnce){failPagesOnce=false;return fakeResponse(403,JSON.stringify({success:false,errors:[{message:'GitHub application must be authorised for the private repo'}]}));}
   fakeClientPages.set(body.name,body);
   return fakeResponse(200,JSON.stringify({success:true,result:{name:body.name,subdomain:body.name+'.pages.dev'}}));
 }
 throw Error('Unexpected external request '+cfg.method+' '+url);
}

let resumableCounter=0;
const fakeResponse=(code,body,headers)=>({
 getResponseCode(){return code},getContentText(){return body||''},getAllHeaders(){return headers||{}}
});
function fakeDriveFetch(url,options){
 if(String(url).startsWith('https://api.github.com/')||String(url).startsWith('https://api.cloudflare.com/'))return fakeProvisionFetch(url,options);
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
   const f={name:n,data,mime,getName(){return this.name},setContent(v){this.data=v},getContent(){return this.data},getBlob(){return {getDataAsString(){return String(f.data)}}}};
   files.push(f);return f;
  },
  getFilesByName(n){const arr=files.filter(f=>f.name===n);return{hasNext(){return arr.length>0},next(){return arr.shift()}}}
 };
 folderById.set(id,item);return item;
}
const root=mkFolder('Chip In — Website Client Assets');
folderById.set('1cLuFi32Zry5uswOjbeEIFwGllYV7TzbB',root);
// Existing Simple Website Editor registry with its required headings.
const editorHeaders=['site_id','business_name','public_url','login_email','password_salt','password_hash',
 'active','repo_full_name','content_root','media_root','schema_path'];
const editorRows=[editorHeaders.slice()];
const legacyEditorRow={site_id:'lantern-yard',business_name:'Lantern Yard',public_url:'https://demo.example/',
 login_email:'demo@example.com',password_salt:'legacy-salt',password_hash:'preserve-existing-hash',
 active:true,repo_full_name:'ChipButt/HospoLP',content_root:'content',media_root:'media/editor',schema_path:'editor.schema.json'};
editorRows.push(editorHeaders.map(h=>legacyEditorRow[h]??''));
const editorSheet={
 getDataRange(){return {getValues(){return editorRows.map(r=>r.slice())}}},
 getLastColumn(){return editorRows[0].length},
 getRange(row,col,nRows,nCols){return {
  getValues(){return editorRows.slice(row-1,row-1+(nRows||1)).map(r=>r.slice(col-1,col-1+(nCols||1)))},
  setValue(v){editorRows[row-1][col-1]=v}
 }},
 appendRow(row){assert.equal(row.length,editorRows[0].length);editorRows.push(row.slice())}
};
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
  sleep(ms){},
  getUuid(){const h=(uuid++).toString(16).padStart(32,'0');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)},
  formatDate(){return '2026-10-23'},
  base64Decode(s){return Array.from(Buffer.from(s,'base64'))},
  base64Encode(s){return Buffer.from(String(s),'utf8').toString('base64')},
  newBlob(data,mime,name){return{name,mime,data,getBytes(){return Buffer.from(data)},getDataAsString(){return Buffer.from(data).toString('utf8')}}}
 },
 LockService:{getScriptLock(){return {waitLock(){},releaseLock(){}}}},
 DriveApp:{getFolderById(id){if(!folderById.has(id))throw Error('Unknown folder '+id);return folderById.get(id)}},
 SpreadsheetApp:{openById(id){assert.equal(id,'12otLULjhJZ8dln9jPWa_DByUQ750NRHkhhciuCZimlY');return {getSheetByName(name){return name==='Clients'?editorSheet:null}}}},
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
const reviewServer=fs.readFileSync('apps-script/ClientReviewService.gs','utf8');
new vm.Script(reviewServer,{filename:'ClientReviewService.gs'}).runInContext(context);
new vm.Script(fs.readFileSync('apps-script/Editor.gs','utf8'),{filename:'Editor.gs'}).runInContext(context);
new vm.Script(fs.readFileSync('apps-script/ClientHandover.gs','utf8'),{filename:'ClientHandover.gs'}).runInContext(context);
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

// Site provisioning is owner-only, requires configured credentials, and is
// safe to retry after an incomplete Cloudflare connection.
context.workspaceId=first.id;
assert.throws(()=>invoke("clientOnboardingProvisionClientSite('bad',workspaceId)"),/Owner session expired/i);
assert.equal(invoke('clientOnboardingSiteSetupStatus(session)').configured,false);
assert.throws(()=>invoke('clientOnboardingProvisionClientSite(session,workspaceId)'),/Script Properties/);
assert.equal(fakeClientRepos.size,0);
properties.set('CHIPIN_GITHUB_PROVISION_TOKEN','github-private-test-token');
properties.set('CHIPIN_CLOUDFLARE_API_TOKEN','cloudflare-test-token');
properties.set('CHIPIN_CLOUDFLARE_ACCOUNT_ID','1234567890abcdef1234567890abcdef');
assert.equal(invoke('clientOnboardingSiteSetupStatus(session)').configured,true);
failPagesOnce=true;
assert.throws(()=>invoke('clientOnboardingProvisionClientSite(session,workspaceId)'),/cloudflare API HTTP 403/);
assert.equal(repoCreateCount,1); // repo was securely persisted
assert.equal(siteStarterCount,1);
assert.equal(fakeClientRepos.size,1);
let state=invoke('clientOnboardingSiteStatus(session,workspaceId)');
assert.equal(state.status,'repository_created');
assert.match(state.repositoryUrl,/^https:\/\/github.com\/ChipButt\//);
const workingSite=invoke('clientOnboardingProvisionClientSite(session,workspaceId)');
assert.equal(workingSite.status,'staging_ready');
assert.equal(workingSite.hostingFeeGBP,0);
assert.equal(workingSite.domainConnected,false);
assert.match(workingSite.pagesUrl,/\.pages\.dev$/);
assert.equal(repoCreateCount,1);
assert.equal(siteStarterCount,1);
assert.equal(pagesCreateCount,2);
const repeated=invoke('clientOnboardingProvisionClientSite(session,workspaceId)');
assert.equal(repeated.status,'staging_ready');
assert.equal(repoCreateCount,1);
assert.equal(pagesCreateCount,2);
assert.equal(invoke('clientOnboardingListWorkspaces(session)')[0].site.status,'staging_ready');
 // The backend must never adopt someone else's same-named Pages project.
 const another=invoke('clientSiteSlug_("Other Client","12345678-1234-4321-4321-123456789abc")');
 assert.match(another,/^chipin-other-client-/);

assert.equal(JSON.stringify(repeated).includes('github-private-test-token'),false);
assert.equal(JSON.stringify(repeated).includes('cloudflare-test-token'),false);
const adminScript=fs.readFileSync('apps-script/ClientOnboardingAdmin.html','utf8');
assert.match(adminScript,/clientOnboardingProvisionClientSite/);
assert.match(adminScript,/CHIPIN_CLOUDFLARE_API_TOKEN/);
const adminScriptMatch=[...adminScript.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(adminScriptMatch.length,1);
new vm.Script(adminScriptMatch[0][1],{filename:'ClientOnboardingAdmin.html inline script'});

// Review portal: owner-only opening, three calendar days, client browser preview
// with page/pin comment records, one consolidated round, signed final approval.
assert.throws(()=>invoke("clientOnboardingStartWebsiteReview('bad',workspaceId)"),/Owner session expired/);
const ownerReview=invoke("clientOnboardingStartWebsiteReview(session,workspaceId)");
assert.equal(ownerReview.status,'prepared');
assert.match(ownerReview.reviewUrl,/mode=website-review&code=/);
assert.match(ownerReview.previewUrl,/\.pages\.dev/);
const reviewAgain=invoke("clientOnboardingStartWebsiteReview(session,workspaceId)");
assert.equal(reviewAgain.reviewUrl,ownerReview.reviewUrl);
const reviewData=JSON.parse(root.children[0].files.find(x=>x.name==='website-review.json').data);
assert.equal(reviewData.feedbackDueAt,null); // clock not running until link emailed
const reviewToken=new URL(ownerReview.reviewUrl).searchParams.get('code');
context.reviewToken=reviewToken;
assert.throws(()=>invoke("clientReviewGet('random-string')"),/Invalid review link/);
assert.equal(invoke('clientReviewGet(reviewToken)').canComment,false);
assert.throws(()=>invoke('clientOnboardingCloseExpiredReview(session,workspaceId)'),/deadline has not passed|already closed/i);
const firstReviewInvite=invoke('clientOnboardingSendReviewInvitation(session,workspaceId)');
const openReview=invoke('clientReviewGet(reviewToken)');
assert.equal(openReview.canComment,true);
assert.equal(new Date(firstReviewInvite.feedbackDueAt).getTime()-new Date(openReview.reviewOpenedAt).getTime(),72*3600*1000);
assert.throws(()=>invoke("clientReviewAddComment(reviewToken,{text:'x',path:'/menu/',x:0.5,y:0.4})"),/describe the requested change/i);
assert.throws(()=>invoke("clientReviewAddComment(reviewToken,{text:'Add a menu',path:'https://evil.example',x:0.5,y:0.4})"),/valid page path/i);
assert.throws(()=>invoke("clientReviewAddComment(reviewToken,{text:'Add a menu',path:'/menu/',x:4,y:0})"),/pin position/i);
context.reviewInput={title:'Homepage heading',text:'Please change the heading to welcome',path:'/',x:0.42,y:0.31};
const reviewAfterComment=invoke('clientReviewAddComment(reviewToken,reviewInput)');
assert.equal(reviewAfterComment.comments.length,1);
assert.equal(reviewAfterComment.comments[0].x,0.42);
const reviewCommentId=reviewAfterComment.comments[0].id;
context.reviewCommentId=reviewCommentId;
assert.throws(()=>invoke("clientOnboardingUpdateReviewComment('bad',workspaceId,reviewCommentId,'done')"),/Owner session expired/);
assert.throws(()=>invoke('clientOnboardingSendFinalApproval(session,workspaceId)'),/submit the first review/);
const invite=invoke('clientOnboardingSendReviewInvitation(session,workspaceId)');
assert.equal(invite.sent,true);
assert.equal(invite.email,'a@test.com');
assert.equal(invite.feedbackDueAt,firstReviewInvite.feedbackDueAt); // resend never restarts clock
const submitted=invoke('clientReviewSubmitFeedback(reviewToken,false)');
assert.equal(submitted.status,'submitted');
assert.equal(submitted.canComment,false);
assert.equal(invoke('clientReviewSubmitFeedback(reviewToken,false)').status,'submitted');
assert.throws(()=>invoke('clientReviewAddComment(reviewToken,reviewInput)'),/deadline has passed|already submitted/);
assert.throws(()=>invoke('clientOnboardingSendFinalApproval(session,workspaceId)'),/every submitted amendment/);
assert.throws(()=>invoke("clientOnboardingUpdateReviewComment(session,workspaceId,reviewCommentId,'bad')"),/Invalid comment status/);
const revised=invoke("clientOnboardingUpdateReviewComment(session,workspaceId,reviewCommentId,'done')");
assert.equal(revised.comments[0].status,'done');
const finalRequest=invoke('clientOnboardingSendFinalApproval(session,workspaceId)');
assert.equal(finalRequest.sent,true);
assert.equal(invoke('clientReviewGet(reviewToken)').canApprove,true);
assert.throws(()=>invoke("clientReviewApprove(reviewToken,'Jane Approver',false)"),/confirm/i);
const approved=invoke("clientReviewApprove(reviewToken,'Jane Approver',true)");
assert.equal(approved.status,'approved');
assert.ok(approved.approvedAt);
assert.equal(invoke('clientOnboardingReviewStatus(session,workspaceId)').approvedBy,'Jane Approver');
assert.equal(invoke('clientReviewApprove(reviewToken,"Jane Approver",true)').status,'approved');
const reviewHtml=fs.readFileSync('apps-script/ClientWebsiteReview.html','utf8');
assert.match(reviewHtml,/id="pinLayer"/);
assert.match(reviewHtml,/clientReviewAddComment/);
assert.match(reviewHtml,/clientReviewApprove/);
const reviewScripts=[...reviewHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(reviewScripts.length,1);
new vm.Script(reviewScripts[0][1].replace(/<\?!= reviewToken \?>/,'""'),{filename:'ClientWebsiteReview.html inline script'});
assert.match(adminScript,/clientOnboardingStartWebsiteReview/);
assert.match(adminScript,/clientOnboardingSendFinalApproval/);


// The owner hub ties quote, assets, review, hosting, live domain and client
// editor together. A signed-off site is NOT complete until the editor works.
const listBeforeLaunch=invoke('clientOnboardingProjectHub(session)');
assert.equal(listBeforeLaunch.length,1);
assert.equal(listBeforeLaunch[0].review.status,'approved');
assert.equal(listBeforeLaunch[0].editor.registered,false);
assert.equal(listBeforeLaunch[0].completed,false);
assert.throws(()=>invoke("clientOnboardingConfirmWebsiteLive('invalid',workspaceId,{})"),/Owner session expired/);
assert.throws(()=>invoke("clientOnboardingConfirmWebsiteLive(session,workspaceId,{url:'http://unsafe.example/',httpsChecked:true,emailDnsChecked:true,clientDomainChecked:true})"),/HTTPS/i);
assert.throws(()=>invoke("clientOnboardingConfirmWebsiteLive(session,workspaceId,{url:'https://client.pages.dev/',httpsChecked:true,emailDnsChecked:true,clientDomainChecked:true})"),/custom domain/i);
assert.throws(()=>invoke("clientOnboardingConfirmWebsiteLive(session,workspaceId,{url:'https://client.example/',httpsChecked:true,emailDnsChecked:false,clientDomainChecked:true})"),/MX/i);
const live=invoke("clientOnboardingConfirmWebsiteLive(session,workspaceId,{url:'https://testcafe.example/',httpsChecked:true,emailDnsChecked:true,clientDomainChecked:true})");
assert.equal(live.launch.url,'https://testcafe.example/');
assert.equal(live.editor.registered,false);
assert.throws(()=>invoke('clientOnboardingSendFinalHandover(session,workspaceId)'),/individual Simple Website Editor/);
assert.throws(()=>invoke("setInitialEditorPassword('client', 'unsafe-password')"),/Owner session expired/);
assert.throws(()=>invoke("clientOnboardingRegisterEditor('invalid',workspaceId)"),/Owner session expired/);
assert.throws(()=>invoke("clientOnboardingRegisterEditor(session,workspaceId)"),/missing editor.schema.json/);
// Model a finished standard HospoLP-template website, not the placeholder.
const fakeSiteName=workingSite.repositoryUrl.split('/').pop();
const fakeSite=fakeClientRepos.get(fakeSiteName);
assert.ok(fakeSite&&fakeSite.private);
fakeSite.editorFiles.set('editor.schema.json',JSON.stringify({pages:[{id:'home',label:'Home',url:'/'}]}));
for(const file of ['site','hours','menu','events','features','gallery','drinks','theme'])
 fakeSite.editorFiles.set('content/'+file+'.json',JSON.stringify(file==='site'?{name:'Test Cafe'}:{}));
const legacyApp="const EDITOR_DATA_URL='https://script.google.com/macros/s/TEST/exec';\nconst EDITOR_SITE_ID='lantern-yard';\nfunction loadEditorData(){}";
fakeSite.editorFiles.set('assets/app.js',legacyApp);
const enrolled=invoke('clientOnboardingRegisterEditor(session,workspaceId)');
assert.equal(enrolled.editor.registered,true);
assert.equal(enrolled.editor.activated,false);
assert.match(enrolled.editor.editorUrl,/mode=editor&site=chipin-/);
assert.match(fakeSite.editorFiles.get('assets/app.js'),new RegExp("const EDITOR_SITE_ID='"+enrolled.editor.siteId+"'"));
assert.match(fakeSite.editorFiles.get('edit/index.html'),/CHIP IN CLIENT EDITOR REDIRECT/);
assert.doesNotMatch(fakeSite.editorFiles.get('edit/index.html'),/site=lantern-yard/);
assert.equal(editorRows.length,3);
assert.ok(editorRows[0].includes('password_is_temporary'));
assert.equal(editorRows[1][editorRows[0].indexOf('password_hash')],'preserve-existing-hash');
assert.equal(invoke('clientOnboardingRegisterEditor(session,workspaceId)').editor.registered,true);
assert.equal(editorRows.length,3); // idempotent registry, no duplicate customer logins
const mailBeforeSetup=sent.length;
const setupMail=invoke('clientOnboardingSendEditorSetup(session,workspaceId)');
assert.equal(setupMail.sent,true);
assert.equal(setupMail.email,'a@test.com');
assert.equal(sent.length,mailBeforeSetup+1);
const message=sent[sent.length-1];
assert.equal(message.to,'a@test.com');
const inviteToken=(message.body||'').match(/&setup=([0-9a-f]{96})/);
assert.ok(inviteToken,'Owner invite must carry a strong site-specific token');
context.clientEditorSiteId=enrolled.editor.siteId;
context.clientEditorInviteToken=inviteToken[1];
assert.throws(()=>invoke("completeEditorInvitation(clientEditorSiteId,'bad','NewClientPassword123!')"),/invalid/i);
assert.throws(()=>invoke("completeEditorInvitation(clientEditorSiteId,clientEditorInviteToken,'short')"),/at least 12/i);
assert.throws(()=>invoke('clientOnboardingSendFinalHandover(session,workspaceId)'),/activate/);
const activation=invoke("completeEditorInvitation(clientEditorSiteId,clientEditorInviteToken,'Unique12CharClientPassword!')");
assert.equal(activation.success,true);
assert.throws(()=>invoke("completeEditorInvitation(clientEditorSiteId,clientEditorInviteToken,'Unique12CharClientPassword!')"),/already used|invalid/i);
const privateEditor=invoke('clientOnboardingProjectHub(session)')[0];
assert.equal(privateEditor.editor.activated,true);
const siteRow=invoke('getEditorSite_(clientEditorSiteId)');
assert.equal(siteRow.repo_full_name,privateEditor.hosting.repository);
assert.equal(siteRow.public_url,'https://testcafe.example/');
assert.equal(siteRow.login_email,'a@test.com');
context.clientEditorPassword='Unique12CharClientPassword!';
const draftFolder=mkFolder('Chip In Websites Editor Drafts');
properties.set('CHIP_IN_WEBSITES_DRAFT_FOLDER_ID',draftFolder.getId());
const successfulClientLogin=invoke("loginEditor(clientEditorSiteId,'a@test.com',clientEditorPassword)");
assert.equal(successfulClientLogin.siteName,'Test Cafe');
assert.equal(successfulClientLogin.mustChangePassword,false);
assert.equal(successfulClientLogin.publicUrl,'https://testcafe.example/');
assert.ok(successfulClientLogin.schema.pages.length);
assert.throws(()=>invoke("loginEditor(clientEditorSiteId,'a@different.example',clientEditorPassword)"),/incorrect/);
const finalHandover=invoke('clientOnboardingSendFinalHandover(session,workspaceId)');
assert.equal(finalHandover.sent,true);
assert.equal(finalHandover.siteUrl,'https://testcafe.example/');
assert.equal(finalHandover.editorUrl,'https://testcafe.example/edit/');
assert.match(sent[sent.length-1].body,/Simple Website Editor/);
assert.equal(invoke('clientOnboardingSendFinalHandover(session,workspaceId)').alreadySent,true);
const finishedHub=invoke('clientOnboardingProjectHub(session)')[0];
assert.equal(finishedHub.completed,true);
assert.equal(finishedHub.steps.filter(x=>x.done).length,finishedHub.steps.length);
const ui=fs.readFileSync('apps-script/EditorUI.html','utf8');
assert.match(ui,/activateInvitation/);
const uiJs=[...ui.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(uiJs.length,1);
new vm.Script(uiJs[0][1].replace(/<\?!= initialSetupToken \?>/,"''"),
 {filename:'EditorUI.html inline script'});
const adminPage=fs.readFileSync('apps-script/ClientOnboardingAdmin.html','utf8');
assert.match(adminPage,/Client Project Hub/);
assert.match(adminPage,/Register client Simple Website Editor/);
assert.match(adminPage,/Send final website \+ editor handover/);

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
console.log('PASS: full client project hub, private upload, Cloudflare Pages, draft feedback, signed approval, manually verified domain, own GitHub-backed editor, secure client password activation/login and final handover.');
