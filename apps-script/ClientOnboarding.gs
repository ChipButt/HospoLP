/**
 * Chip In Websites — approved-quote client upload workspaces.
 *
 * Install in the EXISTING deployed HospoLP Apps Script project as ClientOnboarding.gs.
 * Script Properties: CHIP_IN_ONBOARDING_ADMIN_KEY = a long, unique random secret.
 * No key, token or Google account credentials should ever be stored in GitHub.
 *
 * This deliberately does not share Drive folders with customers.
 * Clients receive an upload-only link into this Apps Script, while files remain
 * inside a private parent folder accessible only by Chip In.
 */
const CLIENT_ONBOARDING = {
  parentFolderId: '1cLuFi32Zry5uswOjbeEIFwGllYV7TzbB',
  adminKeyProperty: 'CHIP_IN_ONBOARDING_ADMIN_KEY',
  projectPrefix: 'chipin-onboard-workspace:',
  meetingPrefix: 'chipin-onboard-meeting:',
  sessionPrefix: 'chipin-onboard-admin-session:',
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 250 * 1024 * 1024,
  maxFiles: 50,
  expiryDays: 90,
  ownerSessionSeconds: 21600,
  types: ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'],
  categories: {
    brand: '01 — Logos and Branding',
    photos: '02 — Photos',
    menus: '03 — Menus and Prices',
    other: '04 — Events and Business Information'
  }
};

function renderClientOnboardingAdmin_(e) {
  const t = HtmlService.createTemplateFromFile('ClientOnboardingAdmin');
  return t.evaluate().setTitle('Chip In — Activate Client Assets')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function renderClientOnboardingUpload_(e) {
  const t = HtmlService.createTemplateFromFile('ClientOnboardingUpload');
  const code = String((e && e.parameter && e.parameter.code) || '');
  t.uploadToken = JSON.stringify(/^[0-9a-f]{96}$/.test(code) ? code : '');
  return t.evaluate().setTitle('Chip In — Send Your Website Files')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function clientOnboardingHash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(v=>('0'+(v & 255).toString(16)).slice(-2)).join('');
}
function clientOnboardingSame_(a,b) {
  const x=String(a),y=String(b);
  if (x.length!==y.length)return false;
  let n=0;for(let i=0;i<x.length;i++)n|=x.charCodeAt(i)^y.charCodeAt(i);
  return n===0;
}
function clientOnboardingAdminKey_() {
  const key=PropertiesService.getScriptProperties().getProperty(CLIENT_ONBOARDING.adminKeyProperty);
  if(!key||key.length<20)throw new Error('One-time setup required: configure a long onboarding admin key in Apps Script properties.');
  return key;
}
function onboardingAuthenticate(secret) {
  const cache=CacheService.getScriptCache();
  const attempts=Number(cache.get('chipin-onboard-admin-failed-logins')||'0');
  if(attempts>=15)throw new Error('Too many sign-in attempts. Try again later.');
  const supplied=clientOnboardingHash_(String(secret||''));
  const expected=clientOnboardingHash_(clientOnboardingAdminKey_());
  if(!clientOnboardingSame_(supplied,expected)){
    cache.put('chipin-onboard-admin-failed-logins',String(attempts+1),180);
    throw new Error('The Chip In owner access key is incorrect.');
  }
  cache.remove('chipin-onboard-admin-failed-logins');
  const token=Utilities.getUuid()+Utilities.getUuid();
  cache.put(CLIENT_ONBOARDING.sessionPrefix+clientOnboardingHash_(token),'owner',CLIENT_ONBOARDING.ownerSessionSeconds);
  return {session:token,expiresInMinutes:360};
}
function clientOnboardingRequireAdmin_(session){
  const token=String(session||'');
  if(token.length<60||CacheService.getScriptCache().get(CLIENT_ONBOARDING.sessionPrefix+clientOnboardingHash_(token))!=='owner')throw new Error('Owner session expired. Sign in again.');
}
function clientOnboardingRecord_(id){
  const raw=PropertiesService.getScriptProperties().getProperty(CLIENT_ONBOARDING.projectPrefix+String(id));
  if(!raw)throw new Error('No matching client workspace.');
  return JSON.parse(raw);
}
function clientOnboardingSave_(record){
  PropertiesService.getScriptProperties().setProperty(CLIENT_ONBOARDING.projectPrefix+record.id,JSON.stringify(record));
}
function clientOnboardingUpdateManifest_(record){
  const folder=DriveApp.getFolderById(record.folderId);
  const old=folder.getFilesByName('upload-status.json');
  const value=JSON.stringify({status:record.status,client:record.business,filesReceived:record.fileCount,totalBytes:record.totalBytes,lastUploadAt:record.lastUploadAt,updatedAt:record.updatedAt},null,2);
  if(old.hasNext())old.next().setContent(value);
  else folder.createFile('upload-status.json',value,MimeType.PLAIN_TEXT);
}
function clientOnboardingToken_(){
  return (Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid()).replace(/-/g,'');
}
function clientOnboardingPublicUrl_(record){
  const url=ScriptApp.getService().getUrl();
  if(!url)throw new Error('Publish the Apps Script web app before creating client links.');
  return url+'?mode=onboard-upload&code='+encodeURIComponent(record.uploadToken);
}
function clientOnboardingOwnerEmail_(){
  return Session.getEffectiveUser().getEmail()||'jamesbutt.chipin@gmail.com';
}
function clientOnboardingClean_(value,max){
  return String(value||'').replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,max);
}
function clientOnboardingEmail_(v){
  const email=String(v||'').trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254)throw new Error('Enter a valid client email address.');
  return email;
}
function clientOnboardingSanitise_(s){
  return clientOnboardingClean_(s,90).replace(/[\\/:*?"<>|#%{}~]/g,'-').replace(/\s+/g,' ')||'Client';
}
function clientOnboardingWithLock_(callback){
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{return callback();}finally{lock.releaseLock();}
}
function clientOnboardingCreateWorkspace(session,payload){
  clientOnboardingRequireAdmin_(session);
  const p=payload||{};
  if(p.approved!==true)throw new Error('The client quote must be approved before a workspace is activated.');
  const business=clientOnboardingClean_(p.business,110);
  if(!business)throw new Error('Business name is required.');
  const email=clientOnboardingEmail_(p.email);
  const contact=clientOnboardingClean_(p.contact,110);
  const meetingId=clientOnboardingClean_(p.meetingId,120);
  if(!meetingId)throw new Error('A unique meeting reference is required.');
  const brief=p.brief&&typeof p.brief==='object'&&!Array.isArray(p.brief)?p.brief:{};
  const briefText=JSON.stringify(brief,null,2);
  if(briefText.length>42000)throw new Error('The meeting brief is too large to create a workspace.');
  return clientOnboardingWithLock_(()=>{
    const props=PropertiesService.getScriptProperties();
    const key=CLIENT_ONBOARDING.meetingPrefix+meetingId;
    const existingId=props.getProperty(key);
    if(existingId){
      const old=clientOnboardingRecord_(existingId);
      if(old.email!==email||old.business!==business)throw new Error('This meeting reference already belongs to another client.');
      return {created:false,id:old.id,business:old.business,email:old.email,folderUrl:old.folderUrl,uploadUrl:clientOnboardingPublicUrl_(old),status:old.status};
    }
    const parent=DriveApp.getFolderById(CLIENT_ONBOARDING.parentFolderId);
    const id=Utilities.getUuid();
    const label=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Europe/London','yyyy-MM-dd');
    const folder=parent.createFolder(label+' — '+clientOnboardingSanitise_(business));
    const children={};
    Object.keys(CLIENT_ONBOARDING.categories).forEach(category=>{
      children[category]=folder.createFolder(CLIENT_ONBOARDING.categories[category]).getId();
    });
    const record={
      id,meetingId,business,email,contact,createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      expiresAt:new Date(Date.now()+CLIENT_ONBOARDING.expiryDays*86400000).toISOString(),
      folderId:folder.getId(),folderUrl:folder.getUrl(),children,
      uploadToken:clientOnboardingToken_(),status:'awaiting_files',fileCount:0,totalBytes:0,lastUploadAt:null
    };
    folder.createFile('approved-website-brief.json',briefText,MimeType.PLAIN_TEXT);
    folder.createFile('upload-status.json',JSON.stringify({status:'awaiting_files',fileCount:0,createdAt:record.createdAt},null,2),MimeType.PLAIN_TEXT);
    clientOnboardingSave_(record);
    props.setProperty(key,id);
    return {created:true,id,business,email,folderUrl:record.folderUrl,uploadUrl:clientOnboardingPublicUrl_(record),status:record.status};
  });
}
function clientOnboardingListWorkspaces(session){
  clientOnboardingRequireAdmin_(session);
  const p=PropertiesService.getScriptProperties().getProperties();
  return Object.keys(p).filter(k=>k.indexOf(CLIENT_ONBOARDING.projectPrefix)===0)
    .map(k=>{try{
      const r=JSON.parse(p[k]);
      return {id:r.id,business:r.business,email:r.email,status:r.status,fileCount:r.fileCount,lastUploadAt:r.lastUploadAt,createdAt:r.createdAt,folderUrl:r.folderUrl,uploadUrl:clientOnboardingPublicUrl_(r)};
    }catch(e){return null;}}).filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100);
}
function clientOnboardingWorkspaceStatus(session,id){
  clientOnboardingRequireAdmin_(session);
  const r=clientOnboardingRecord_(id);
  return {id:r.id,business:r.business,email:r.email,status:r.status,fileCount:r.fileCount,totalBytes:r.totalBytes,lastUploadAt:r.lastUploadAt,folderUrl:r.folderUrl,uploadUrl:clientOnboardingPublicUrl_(r),expiresAt:r.expiresAt};
}
function clientOnboardingEmailInvitation(session,id){
  clientOnboardingRequireAdmin_(session);
  const r=clientOnboardingRecord_(id);
  const url=clientOnboardingPublicUrl_(r);
  MailApp.sendEmail({
    to:r.email,
    subject:'Your website files — '+r.business+' | Chip In',
    htmlBody:'<p>Thanks for choosing Chip In for your website.</p>'+
      '<p>You can send your logo, original photographs, menus and business information using your private upload link:</p>'+
      '<p><a href="'+clientOnboardingEscape_(url)+'">Upload your website materials</a></p>'+
      '<p>Please use original, high-resolution files where possible. PDF menus are ideal; avoid screenshots.</p>'+
      '<p>This link only allows you to send files for your website project. It does not expose your Google Drive account or other clients’ files.</p>'+
      '<p>Chip In</p>'
  });
  return {sent:true,email:r.email};
}
function clientOnboardingEscape_(value){
  return String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function clientOnboardingByToken_(token){
  const provided=clientOnboardingHash_(String(token||''));
  const props=PropertiesService.getScriptProperties().getProperties();
  for(const k in props){
    if(k.indexOf(CLIENT_ONBOARDING.projectPrefix)!==0)continue;
    const r=JSON.parse(props[k]);
    if(clientOnboardingSame_(provided,clientOnboardingHash_(r.uploadToken))){
      if(Date.now()>Date.parse(r.expiresAt))throw new Error('This upload link has expired. Contact Chip In for a new link.');
      return r;
    }
  }
  throw new Error('This upload link is invalid. Request a new link from Chip In.');
}
function clientOnboardingClientInfo(token){
  const r=clientOnboardingByToken_(token);
  return {business:r.business,status:r.status,filesReceived:r.fileCount,maxFiles:CLIENT_ONBOARDING.maxFiles,maxFileBytes:CLIENT_ONBOARDING.maxFileBytes,expiresAt:r.expiresAt};
}
function clientOnboardingUploadAsset(token,asset){
  const r=clientOnboardingByToken_(token);
  const data=asset||{};
  if(r.fileCount>=CLIENT_ONBOARDING.maxFiles)throw new Error('The upload limit has been reached. Contact Chip In.');
  const cat=String(data.category||'');
  if(!Object.prototype.hasOwnProperty.call(CLIENT_ONBOARDING.categories,cat))throw new Error('Invalid file category.');
  const name=clientOnboardingSanitise_(data.name).slice(0,150);
  if(!name)throw new Error('Choose a file to upload.');
  const mime=String(data.mimeType||'').toLowerCase();
  if(!(mime.indexOf('image/')===0||CLIENT_ONBOARDING.types.includes(mime)))throw new Error('This file format is not supported.');
  if(typeof data.data!=='string'||data.data.length>(CLIENT_ONBOARDING.maxFileBytes*4/3)+32)throw new Error('File is too large or invalid.');
  const raw=Utilities.base64Decode(data.data);
  if(raw.length>CLIENT_ONBOARDING.maxFileBytes)throw new Error('Maximum 25 MB per file.');
  return clientOnboardingWithLock_(()=>{
    const fresh=clientOnboardingRecord_(r.id);
    if(fresh.fileCount>=CLIENT_ONBOARDING.maxFiles||fresh.totalBytes+raw.length>CLIENT_ONBOARDING.maxTotalBytes)throw new Error('Upload allowance reached. Contact Chip In.');
    const folder=DriveApp.getFolderById(fresh.children[cat]);
    const file=folder.createFile(Utilities.newBlob(raw,mime,name));
    fresh.fileCount++;
    fresh.totalBytes+=raw.length;
    fresh.updatedAt=new Date().toISOString();
    fresh.lastUploadAt=fresh.updatedAt;
    fresh.status='files_received';
    clientOnboardingSave_(fresh);
    clientOnboardingUpdateManifest_(fresh);
    return {name:file.getName(),category:cat,fileCount:fresh.fileCount};
  });
}
function clientOnboardingFinishUploads(token){
  const r=clientOnboardingByToken_(token);
  return clientOnboardingWithLock_(()=>{
    const latest=clientOnboardingRecord_(r.id);
    if(latest.fileCount===0)throw new Error('Please upload at least one file before marking your materials ready.');
    latest.status='ready_for_review';
    latest.updatedAt=new Date().toISOString();
    clientOnboardingSave_(latest);
    clientOnboardingUpdateManifest_(latest);
    const owner=clientOnboardingOwnerEmail_();
    if(owner){
      try{MailApp.sendEmail({to:owner,subject:'Client files ready: '+latest.business,body:'Files have been uploaded for '+latest.business+'.\n\nFolder: '+latest.folderUrl+'\nFiles: '+latest.fileCount});}catch(err){console.warn('Owner notification failed',err);}
    }
    return {success:true,fileCount:latest.fileCount};
  });
}
