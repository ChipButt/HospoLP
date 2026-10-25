/**
 * Chip In — owner-only project hub, live-domain checklist and individual
 * customer website editor handover. The demo editor is NEVER sent to clients.
 *
 * Existing services: ClientOnboarding.gs, ClientReviewService.gs, Editor.gs.
 * No client website can be handed over without signed launch approval, a
 * confirmed live HTTPS domain, a site-specific editor registry and password.
 */
const CHIPIN_EDITOR_INVITE_PREFIX='chipin-client-editor-invite:';
const CHIPIN_EDITOR_STATUS_PREFIX='chipin-client-editor-active:';
const CHIPIN_EDITOR_LOGIN_PREFIX='chipin-client-editor-login:';
const CHIPIN_EDITOR_INVITE_HOURS=48;


/**
 * Stable pre-contract website identities. A prebuilt demo is linked to an
 * approved workspace ONLY by explicit project ID, never by guessing from
 * business name or creating a second repository.
 */
const CHIPIN_PREVIEW_PROJECT_PREFIX='chipin-preview-project:';
function clientProjectNormaliseName_(value){
  return String(value||'').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function clientProjectIsLegacyTest_(business){
  return ['mums test','chip in test business'].includes(clientProjectNormaliseName_(business));
}
function clientProjectEnsureBullsHead_(){
  const props=PropertiesService.getScriptProperties();
  const id='bulls-head-bidford',key=CHIPIN_PREVIEW_PROJECT_PREFIX+id;
  const existing=props.getProperty(key);
  if(existing)return JSON.parse(existing);
  if(props.getProperty('chipin-owner-demo:'+id)!=='yes')return null;
  const record={
    id:id,business:'The Bulls Head',repository:'ChipButt/TheBullsHeadBidford',
    editorSiteId:id,pagesProject:props.getProperty('CHIPIN_BULLS_HEAD_PAGES_PROJECT')||'',
    pagesUrl:props.getProperty('CHIPIN_BULLS_HEAD_PAGES_URL')||'',
    createdAt:new Date().toISOString(),workspaceId:'',stage:'demo_ready'
  };
  props.setProperty(key,JSON.stringify(record));return record;
}
function clientProjectLookup_(projectId){
  const id=String(projectId||'');
  if(!/^[a-z0-9-]{6,100}$/.test(id))throw new Error('Invalid existing website project ID.');
  if(id==='bulls-head-bidford')clientProjectEnsureBullsHead_();
  const raw=PropertiesService.getScriptProperties().getProperty(CHIPIN_PREVIEW_PROJECT_PREFIX+id);
  if(!raw)throw new Error('The selected website project was not found. Open the meeting from its Client Project Hub card.');
  return JSON.parse(raw);
}
function clientOnboardingListPreviewProjects(session){
  clientOnboardingRequireAdmin_(session);
  clientProjectEnsureBullsHead_();
  const props=PropertiesService.getScriptProperties().getProperties();
  return Object.keys(props).filter(k=>k.indexOf(CHIPIN_PREVIEW_PROJECT_PREFIX)===0)
    .map(k=>{try{return JSON.parse(props[k])}catch(_){return null}})
    .filter(r=>r&&!r.archivedAt).map(r=>({
      id:r.id,business:r.business,stage:r.stage,workspaceId:r.workspaceId||'',
      repository:r.repository,editorSiteId:r.editorSiteId,
      pagesUrl:r.pagesUrl||'',editorUrl:clientHandoverEditorLink_(r.editorSiteId)
    })).sort((a,b)=>a.business.localeCompare(b.business));
}
/** Owner registers another ALREADY BUILT, editor-enabled client demo. */
function clientOnboardingRegisterPreviewProject(session,payload){
  clientOnboardingRequireAdmin_(session);
  const p=payload||{};
  const business=clientOnboardingClean_(p.business,110);
  const repository=String(p.repository||'').trim();
  const siteId=String(p.editorSiteId||'').trim();
  const projectName=String(p.pagesProject||'').trim();
  if(!business||clientProjectIsLegacyTest_(business))throw new Error('Enter the actual business name.');
  if(!/^ChipButt\/[A-Za-z0-9_.-]{2,100}$/.test(repository)||
     !/^[a-z0-9-]{6,100}$/.test(siteId)||
     !/^[a-z0-9-]{5,58}$/.test(projectName))
    throw new Error('Enter the exact ChipButt GitHub repository and existing editor site ID.');
  // Authentication comes from the owner session; the repository and registry
  // must already exist. Do NOT create/overwrite either one here.
  const editor=getEditorSite_(siteId);
  if(editor.repo_full_name!==repository||!editor.active)
    throw new Error('This editor site ID is not registered to the specified website repository.');
  const src=JSON.parse(githubReadText_({repo_full_name:repository},'editor.schema.json'));
  if(!src||!Array.isArray(src.pages)||!src.pages.length)
    throw new Error('The prepared website is missing a working editor schema.');
  githubReadText_({repo_full_name:repository},'content/site.json');
  // Verify this exact existing Cloudflare project is connected to this exact
  // GitHub repository; never adopt by a guessed project name.
  const cfg=clientSiteSettings_(true),repoParts=repository.split('/');
  const githubRepo=clientSiteApi_('github','https://api.github.com/repos/'+repository,'get',null,cfg.gitToken);
  const cfUrl='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(cfg.account)+'/pages/projects/'+encodeURIComponent(projectName);
  const cfReply=clientSiteApi_('cloudflare',cfUrl,'get',null,cfg.cloudToken);
  const cf=cfReply.result||cfReply,source=cf.source||{},cloudSourceCfg=source.config||{};
  if(cf.name!==projectName||source.type!=='github'||
     cloudSourceCfg.owner!==repoParts[0]||cloudSourceCfg.repo_name!==repoParts[1]||
     String(cloudSourceCfg.repo_id)!==String(githubRepo.id))
    throw new Error('Cloudflare project is not connected to the selected GitHub repository. No site link was created.');
  const pagesUrl='https://'+String(cf.subdomain||projectName+'.pages.dev').replace(/^https?:\/\//,'').replace(/\/$/,'')+'/';
  return clientOnboardingWithLock_(()=>{
    const props=PropertiesService.getScriptProperties(),all=props.getProperties();
    const matches=Object.keys(all).filter(k=>k.indexOf(CHIPIN_PREVIEW_PROJECT_PREFIX)===0)
      .map(k=>JSON.parse(all[k]))
      .filter(r=>r.repository===repository||r.editorSiteId===siteId);
    if(matches.length){
      const old=matches[0];
      if(old.repository!==repository||old.editorSiteId!==siteId)
        throw new Error('This GitHub repository or editor belongs to another client project.');
      if(old.pagesProject&&old.pagesProject!==projectName)
        throw new Error('This website is already connected to another Cloudflare project.');
      if(!old.pagesProject){
        old.pagesProject=projectName;old.pagesUrl=pagesUrl;
        props.setProperty(CHIPIN_PREVIEW_PROJECT_PREFIX+old.id,JSON.stringify(old));
      }
      return {created:false,id:old.id,business:old.business,editorSiteId:old.editorSiteId};
    }
    const id='preview-'+Utilities.getUuid();
    const record={id,business,repository,editorSiteId,pagesUrl:pagesUrl,
      pagesProject:projectName,workspaceId:'',createdAt:new Date().toISOString(),stage:'demo_ready'};
    props.setProperty(CHIPIN_PREVIEW_PROJECT_PREFIX+id,JSON.stringify(record));
    return {created:true,id,business,editorSiteId:siteId};
  });
}
/** Archive exact legacy test workspaces only; keep their Drive data and GitHub sites. */
function clientOnboardingArchiveLegacyTestWorkspaces(session){
  clientOnboardingRequireAdmin_(session);
  return clientOnboardingWithLock_(()=>{
    const props=PropertiesService.getScriptProperties(),all=props.getProperties(),archived=[];
    for(const key of Object.keys(all)){
      if(key.indexOf(CLIENT_ONBOARDING.projectPrefix)!==0)continue;
      let record;try{record=JSON.parse(all[key])}catch(_){continue}
      if(!clientProjectIsLegacyTest_(record.business)||record.archivedAt||
         record.siteLaunch?.confirmedAt||record.editorHandover?.handoverSentAt)continue;
      record.archivedAt=new Date().toISOString();
      props.setProperty(key,JSON.stringify(record));archived.push(record.business);
    }
    return {archived:archived,removedFromActiveList:archived.length,
      filesDeleted:false,hostingDeleted:false};
  });
}

function clientHubBrief_(r){
  try{
    const files=DriveApp.getFolderById(r.folderId).getFilesByName('approved-website-brief.json');
    if(!files.hasNext())return {};
    const b=JSON.parse(files.next().getBlob().getDataAsString('UTF-8'));
    return b && b.fields && typeof b.fields==='object' ? b.fields : {};
  }catch(err){return {};}
}
function clientHubReview_(r){
  if(!r.review)return {status:'not_started',comments:0};
  try{
    const v=clientReviewLoad_(r);
    return {status:v.status,comments:v.comments.length,feedbackDueAt:v.feedbackDueAt||'',
      reviewUrl:clientReviewPublicUrl_(r),approvedAt:v.approvedAt||'',approvedBy:v.approvedBy||'',
      revisionTargetAt:v.revisionTargetAt||''};
  }catch(err){return {status:'needs_attention',comments:0};}
}
function clientHubEditor_(r){
  const e=r.editorHandover||{};
  const props=PropertiesService.getScriptProperties();
  const active=Boolean(e.siteId&&props.getProperty(CHIPIN_EDITOR_STATUS_PREFIX+e.siteId)==='yes');
  const loginAt=active?props.getProperty(CHIPIN_EDITOR_LOGIN_PREFIX+e.siteId)||'':'';
  return {siteId:e.siteId||'',registered:Boolean(e.siteId),activated:active,
    loginVerified:Boolean(loginAt),lastVerifiedLoginAt:loginAt,
    inviteSentAt:e.inviteSentAt||'',editorUrl:e.editorUrl||'',handoverSentAt:e.handoverSentAt||''};
}
function clientHubOne_(r){
  const b=clientHubBrief_(r),review=clientHubReview_(r),editor=clientHubEditor_(r);
  const site=r.siteProvision||{},launch=r.siteLaunch||{};
  const steps=[
    {name:'Quote accepted',done:Boolean(r.meetingId&&r.folderId)},
    {name:'Client assets received',done:r.status==='ready_for_review'},
    {name:'Private repo & Cloudflare Pages',done:Boolean(site.pagesProject)},
    {name:'First draft reviewed',done:['submitted','awaiting_approval','approved'].includes(review.status)},
    {name:'Final written approval',done:review.status==='approved'},
    {name:'Custom domain live',done:Boolean(launch.confirmedAt)},
    {name:'Client editor registered',done:editor.registered},
    {name:'Client editor password activated',done:editor.activated},
    {name:'Client editor login verified',done:editor.loginVerified},
    {name:'Handover email sent',done:Boolean(editor.handoverSentAt)}
  ];
  const preview=r.previewProjectId?clientProjectLookup_(r.previewProjectId):null;
  return {id:r.id,projectId:r.projectId||'',previewOnly:false,
    demoEditorUrl:preview?clientHandoverEditorLink_(preview.editorSiteId):'',
    demoWebsiteUrl:preview?preview.pagesUrl||'':'',
    business:r.business,email:r.email,contact:r.contact||'',
    meetingId:r.meetingId,createdAt:r.createdAt,
    assets:{status:r.status,fileCount:r.fileCount||0,lastUploadAt:r.lastUploadAt||'',folderUrl:r.folderUrl,uploadUrl:clientOnboardingPublicUrl_(r)},
    contract:{assetDeadline:String(b.contentDue||''),buildCalendarDays:String(b.buildDays||''),approvalContact:String(b.launchApprover||b.approver||'')},
    hosting:{status:site.pagesProject?'staging_ready':'not_provisioned',repository:site.repository||'',repositoryUrl:site.repositoryUrl||'',pagesUrl:site.pagesUrl||''},
    review:review,launch:{url:launch.url||'',confirmedAt:launch.confirmedAt||'',domain:launch.domain||''},
    editor:editor,steps,completed:steps.every(s=>s.done)};
}
function clientOnboardingProjectHub(session){
  clientOnboardingRequireAdmin_(session);
  const props=PropertiesService.getScriptProperties().getProperties();
  const items=[];
  for(const key of Object.keys(props)){
    if(key.indexOf(CLIENT_ONBOARDING.projectPrefix)!==0)continue;
    try{const r=JSON.parse(props[key]);if(!r.archivedAt)items.push(clientHubOne_(r));}catch(err){/* skip corrupt record */ }
  }
  // An owner may demonstrate and edit a fully built website before the quote.
  // It is displayed alongside client projects, not in a Bulls Head-specific box.
  clientProjectEnsureBullsHead_();
  const previews=PropertiesService.getScriptProperties().getProperties();
  Object.keys(previews).filter(k=>k.indexOf(CHIPIN_PREVIEW_PROJECT_PREFIX)===0)
    .forEach(k=>{
      try{
        const p=JSON.parse(previews[k]);
        if(p.archivedAt||p.workspaceId)return;
        items.push({
          id:p.id,projectId:p.id,previewOnly:true,completed:false,
          business:p.business,contact:'',email:'',createdAt:p.createdAt,
          demoEditorUrl:clientHandoverEditorLink_(p.editorSiteId),
          demoWebsiteUrl:p.pagesUrl||'',repoUrl:'https://github.com/'+p.repository,
          hosting:{repository:p.repository,pagesUrl:p.pagesUrl||''},
          steps:[],stage:'Website demo ready'
        });
      }catch(_){}
    });
  return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,100);
}
function clientHubSafeLiveUrl_(value){
  const url=String(value||'').trim();
  if(url.length>250||!/^https:\/\//i.test(url))throw new Error('Enter the live website HTTPS URL.');
  const match=/^https:\/\/([a-z0-9.-]+)(\/?)$/i.exec(url);
  if(!match||match[1]==='localhost'||match[1].endsWith('.pages.dev')||match[1].endsWith('.github.io')||
     !match[1].includes('.')||/\.\.|(^|[.-])localhost([.-]|$)/.test(match[1]))
    throw new Error('The finished client website needs a real custom domain, not a preview or local address.');
  return 'https://'+match[1].toLowerCase()+'/';
}
function clientOnboardingConfirmWebsiteLive(session,id,payload){
  clientOnboardingRequireAdmin_(session);
  const p=payload||{};
  return clientOnboardingWithLock_(()=>{
    const r=clientOnboardingRecord_(id),review=clientHubReview_(r);
    if(review.status!=='approved')throw new Error('The client must approve the finished website in writing before live-domain handover.');
    if(!r.siteProvision||!r.siteProvision.pagesProject)throw new Error('Cloudflare Pages hosting is not provisioned.');
    if(p.httpsChecked!==true||p.emailDnsChecked!==true||p.clientDomainChecked!==true)
      throw new Error('Confirm HTTPS loads, the client domain is connected, and existing email DNS/MX records were preserved.');
    const url=clientHubSafeLiveUrl_(p.url);
    if(r.siteLaunch&&r.siteLaunch.url!==url)
      throw new Error('This client already has a different live-domain record. Resolve the discrepancy before handover.');
    r.siteLaunch={url,domain:url.slice(8,-1),confirmedAt:new Date().toISOString(),
      confirmedBy:'Chip In owner (manual checks)'};
    clientOnboardingSave_(r);
    return clientHubOne_(r);
  });
}
function clientHandoverGithubRead_(site,path,token){
  const base='https://api.github.com/repos/'+encodeURIComponent(site.repository.split('/')[0])+
    '/'+encodeURIComponent(site.repository.split('/')[1])+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
  const res=clientSiteApi_('github',base+'?ref='+encodeURIComponent(site.branch||'main'),'get',null,token,[404]);
  if(res.status===404)throw new Error('Client site is missing '+path+'. Build the website using the HospoLP Simple Website Editor-compatible template before registering its editor.');
  if(!res.content||res.type!=='file')throw new Error('Cannot read the editor file '+path+'.');
  return {content:Utilities.newBlob(Utilities.base64Decode(String(res.content).replace(/\s/g,''))).getDataAsString('UTF-8'),sha:res.sha};
}
function clientHandoverGithubWrite_(site,path,content,sha,token){
  const base='https://api.github.com/repos/'+encodeURIComponent(site.repository.split('/')[0])+
    '/'+encodeURIComponent(site.repository.split('/')[1])+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
  const payload={message:'Connect Chip In Simple Website Editor for this client',
    branch:site.branch||'main',sha,content:Utilities.base64Encode(content,Utilities.Charset.UTF_8)};
  return clientSiteApi_('github',base,'put',payload,token);
}
function clientHandoverEditorLink_(siteId){
  const u=ScriptApp.getService().getUrl();
  if(!u)throw new Error('The existing Apps Script web app must be deployed.');
  return u+'?mode=editor&site='+encodeURIComponent(siteId);
}
function clientHandoverSheet_(){
  const sheet=SpreadsheetApp.openById(EDITOR_CONFIG.REGISTRY_SPREADSHEET_ID).getSheetByName(EDITOR_CONFIG.REGISTRY_SHEET);
  if(!sheet)throw new Error('The existing Simple Website Editor client registry is missing.');
  const rows=sheet.getDataRange().getValues();
  if(!rows.length)throw new Error('The editor client registry has no headings.');
  let headers=rows[0].map(String);
  const required=['site_id','business_name','public_url','login_email','password_salt','password_hash',
    'active','repo_full_name','content_root','media_root','schema_path'];
  const missing=required.filter(k=>!headers.includes(k));
  if(missing.length)throw new Error('Client registry needs editor headings: '+missing.join(', ')+'. Refusing to write to an incompatible sheet.');
  // The original, working HospoLP registry predates the temporary-password
  // column. Add ONLY that missing column; never rewrite existing customers,
  // salts, password hashes, login emails or other existing columns.
  if(!headers.includes('password_is_temporary')){
    ensureRegistryColumn_(sheet,'password_is_temporary');
    headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
    return {sheet,headers,rows:sheet.getDataRange().getValues()};
  }
  return {sheet,headers,rows};
}

/** At final approved handover, claim the existing prepared editor in place. */
function clientOnboardingRegisterExistingEditor_(r){
 const p=clientProjectLookup_(r.previewProjectId),site=r.siteProvision||{};
 if(p.workspaceId!==r.id||site.repository!==p.repository||!p.editorSiteId||
    !p.pagesProject||site.pagesProject!==p.pagesProject)
   throw new Error('Prepared website link does not match this approved client.');
 const current=getEditorSite_(p.editorSiteId);
 if(String(current.repo_full_name)!==p.repository)
   throw new Error('Existing editor belongs to a different website repository.');
 const schema=JSON.parse(githubReadText_({repo_full_name:p.repository},'editor.schema.json'));
 if(!schema||!Array.isArray(schema.pages)||!schema.pages.length)
   throw new Error('Existing website has no valid editor schema.');
 githubReadText_({repo_full_name:p.repository},'content/site.json');
 const siteId=p.editorSiteId,editorUrl=clientHandoverEditorLink_(siteId);
 if(r.editorHandover&&r.editorHandover.siteId===siteId)return clientHubOne_(r);
 if(r.editorHandover)throw new Error('This client already has a different editor.');
 const reg=clientHandoverSheet_(),row=current._row;
 const col=name=>{const i=reg.headers.indexOf(name)+1;if(!i)throw new Error('Editor field missing: '+name);return i;};
 if(String(reg.rows[row-1][col('repo_full_name')-1])!==p.repository)
   throw new Error('Editor registry was changed. Handover stopped.');
 // Rotate demo credentials only after signed approval and confirmed live domain.
 const salt=Utilities.getUuid()+Utilities.getUuid();
 const neverShared=Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid();
 reg.sheet.getRange(row,col('login_email')).setValue(r.email);
 reg.sheet.getRange(row,col('public_url')).setValue(r.siteLaunch.url);
 reg.sheet.getRange(row,col('password_salt')).setValue(salt);
 reg.sheet.getRange(row,col('password_hash')).setValue(hashPassword_(neverShared,salt));
 reg.sheet.getRange(row,col('password_is_temporary')).setValue(true);
 const props=PropertiesService.getScriptProperties();
 props.deleteProperty(CHIPIN_EDITOR_STATUS_PREFIX+siteId);
 props.deleteProperty(CHIPIN_EDITOR_LOGIN_PREFIX+siteId);
 props.setProperty('chipin-editor-auth-version:'+siteId,Utilities.getUuid());
 r.editorHandover={siteId,editorUrl,registeredAt:new Date().toISOString(),reusedExistingDemo:true};
 clientOnboardingSave_(r);
 return clientHubOne_(r);
}

function clientOnboardingRegisterEditor(session,id){
  clientOnboardingRequireAdmin_(session);
  const cfg=clientSiteSettings_(true);
  return clientOnboardingWithLock_(()=>{
    const r=clientOnboardingRecord_(id);
    if(clientHubReview_(r).status!=='approved')throw new Error('Written final approval is required before client editor handover.');
    if(!r.siteLaunch||!r.siteLaunch.confirmedAt)throw new Error('Confirm the custom-domain website is live before editor handover.');
    if(r.previewProjectId)return clientOnboardingRegisterExistingEditor_(r);
    const site=r.siteProvision;
    if(!site||!site.repository||!site.pagesProject||!/^ChipButt\/chipin-[a-z0-9-]+$/.test(site.repository))
      throw new Error('An approved private ChipButt client repository is required.');
    const siteId=String(site.slug||'');
    if(!/^chipin-[a-z0-9-]{6,65}$/.test(siteId))throw new Error('Invalid client-specific editor site ID.');
    if(r.editorHandover&&r.editorHandover.siteId===siteId)return clientHubOne_(r);
    // Refuse to enrol a holding page. Verify the *finished website* uses the
    // existing content/editor schema, and modify only known constants.
    const schema=clientHandoverGithubRead_(site,'editor.schema.json',cfg.gitToken);
    let parsed;
    try{parsed=JSON.parse(schema.content);}catch(err){throw new Error('Client editor schema is not valid JSON.');}
    if(!parsed||!Array.isArray(parsed.pages)||!parsed.pages.length)
      throw new Error('Client editor schema has no editable pages.');
    for(const name of ['site','hours','menu','events','features','gallery','drinks','theme'])
      clientHandoverGithubRead_(site,'content/'+name+'.json',cfg.gitToken);
    const js=clientHandoverGithubRead_(site,'assets/app.js',cfg.gitToken);
    if(!/const EDITOR_SITE_ID=['"][a-z0-9-]+['"]/.test(js.content)||
       !/const EDITOR_DATA_URL=['"]https:\/\/script\.google\.com\/macros\/s\//.test(js.content))
      throw new Error('Client website app.js does not implement the standard editor data bridge. Use the approved HospoLP website template.');
    const editorUrl=clientHandoverEditorLink_(siteId);
    const newApp=js.content.replace(/const EDITOR_SITE_ID=['"][a-z0-9-]+['"]/,
      "const EDITOR_SITE_ID='"+siteId+"'");
    if(newApp!==js.content)clientHandoverGithubWrite_(site,'assets/app.js',newApp,js.sha,cfg.gitToken);
    // Standard client-friendly /edit/ URL. Read existing file before updating:
    // never overwrite a custom editor page without checking its content.
    const existing=(()=>{try{return clientHandoverGithubRead_(site,'edit/index.html',cfg.gitToken);}catch(err){
      if(!String(err.message).includes('is missing edit/index.html'))throw err;
      return null;
    }})();
    if(existing&&!existing.content.includes('CHIP IN CLIENT EDITOR REDIRECT')&&!existing.content.includes(editorUrl))
      throw new Error('A custom /edit/ page already exists. Review it before replacing.');
    const redirect='<!doctype html><html lang="en"><!-- CHIP IN CLIENT EDITOR REDIRECT --><head><meta charset="utf-8">'+
      '<meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<title>Open your website editor</title><meta http-equiv="refresh" content="1;url='+editorUrl.replace(/&/g,'&amp;')+'"></head>'+
      '<body><main><h1>Simple Website Editor</h1><p>Opening your secure website editor…</p>'+
      '<p><a href="'+editorUrl.replace(/&/g,'&amp;')+'">Open website editor</a></p></main></body></html>';
    if(!existing||existing.content!==redirect)
      clientHandoverGithubWrite_(site,'edit/index.html',redirect,existing&&existing.sha,cfg.gitToken);
    const reg=clientHandoverSheet_();
    const values=reg.rows,headers=reg.headers;
    for(let row=1;row<values.length;row++){
      const item={};headers.forEach((h,i)=>item[h]=values[row][i]);
      if(String(item.site_id)===siteId){
        if(String(item.repo_full_name)!==site.repository||String(item.login_email).toLowerCase()!==r.email.toLowerCase())
          throw new Error('The editor site ID is registered to a different client. Refusing to override.');
        r.editorHandover={...(r.editorHandover||{}),siteId,editorUrl,
          registeredAt:r.editorHandover&&r.editorHandover.registeredAt||new Date().toISOString()};
        clientOnboardingSave_(r);
        return clientHubOne_(r);
      }
    }
    // No plaintext password exists or is sent. A random unusable initial
    // password is placed in the registry until the emailed one-time setup link
    // is redeemed by the client. The account is marked temporary.
    const salt=Utilities.getUuid()+Utilities.getUuid();
    const neverShared=Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid();
    const rowData={
      site_id:siteId,business_name:r.business,public_url:r.siteLaunch.url,
      login_email:r.email,password_salt:salt,password_hash:hashPassword_(neverShared,salt),
      password_is_temporary:true,active:true,repo_full_name:site.repository,
      content_root:'content',media_root:'media/editor',schema_path:'editor.schema.json'
    };
    reg.sheet.appendRow(headers.map(h=>Object.prototype.hasOwnProperty.call(rowData,h)?rowData[h]:''));
    r.editorHandover={siteId,editorUrl,registeredAt:new Date().toISOString()};
    clientOnboardingSave_(r);
    return clientHubOne_(r);
  });
}
function clientOnboardingSendEditorSetup(session,id){
  clientOnboardingRequireAdmin_(session);
  const result=clientOnboardingWithLock_(()=>{
    const r=clientOnboardingRecord_(id),e=r.editorHandover;
    if(!e||!e.siteId||!r.siteLaunch||clientHubReview_(r).status!=='approved')
      throw new Error('Record the live website and register the individual client editor before inviting the client.');
    const site=getEditorSite_(e.siteId);
    if(site.repo_full_name!==r.siteProvision.repository||String(site.login_email).toLowerCase()!==r.email.toLowerCase())
      throw new Error('Editor registry identity does not match the approved client.');
    if(PropertiesService.getScriptProperties().getProperty(CHIPIN_EDITOR_STATUS_PREFIX+e.siteId)==='yes')
      return {alreadyActivated:true,email:r.email};
    const token=clientOnboardingToken_();
    const expiry=new Date(Date.now()+CHIPIN_EDITOR_INVITE_HOURS*3600000).toISOString();
    const link=e.editorUrl+'&setup='+encodeURIComponent(token);
    // Send *before* persisting the token. A failed email cannot invalidate a
    // previously delivered working invitation.
    MailApp.sendEmail({to:r.email,subject:'Set up your Simple Website Editor — '+r.business,
      body:'Your finished website is ready: '+r.siteLaunch.url+
        '\n\nCreate your private editor password using this one-time link (valid for 48 hours):\n'+link+
        '\n\nOnly your website is available in this editor. You will be able to update text, photos, menus, hours and events, and publish changes yourself.\n'+
        '\nIf you did not request this, please contact Chip In.\n\nChip In'});
    PropertiesService.getScriptProperties().setProperty(CHIPIN_EDITOR_INVITE_PREFIX+e.siteId,
      JSON.stringify({tokenHash:clientOnboardingHash_(token),workspaceId:id,email:r.email,expiresAt:expiry}));
    e.inviteSentAt=new Date().toISOString();
    clientOnboardingSave_(r);
    return {sent:true,email:r.email,expiresAt:expiry};
  });
  return result;
}
function completeEditorInvitation(siteId,token,password){
  return clientOnboardingWithLock_(()=>{
    const key=CHIPIN_EDITOR_INVITE_PREFIX+String(siteId||'');
    const props=PropertiesService.getScriptProperties(),raw=props.getProperty(key);
    if(!raw)throw new Error('This editor setup link is invalid or was already used.');
    const record=JSON.parse(raw);
    if(Date.now()>new Date(record.expiresAt).getTime())throw new Error('Your 48-hour editor setup link has expired. Ask Chip In for a fresh invitation.');
    if(!/^[a-f0-9]{96}$/.test(String(token||''))||
       !clientOnboardingSame_(record.tokenHash,clientOnboardingHash_(token)))
      throw new Error('This editor setup link is invalid.');
    const r=clientOnboardingRecord_(record.workspaceId);
    if(!r.editorHandover||r.editorHandover.siteId!==siteId||r.email!==record.email||!r.siteLaunch)
      throw new Error('This editor invitation no longer matches the approved website.');
    const site=getEditorSite_(siteId);
    if(String(site.login_email).toLowerCase()!==record.email.toLowerCase())throw new Error('Editor account is not configured for this client.');
    const pass=String(password||'');
    if(pass.length<12||pass.length>128)throw new Error('Create a password containing at least 12 characters.');
    const salt=Utilities.getUuid()+Utilities.getUuid();
    updateRegistryCredentials_(site._row,salt,hashPassword_(pass,salt),false);
    props.setProperty(CHIPIN_EDITOR_STATUS_PREFIX+siteId,'yes');
    props.deleteProperty(key);
    return {success:true,siteId};
  });
}
function clientOnboardingSendFinalHandover(session,id){
  clientOnboardingRequireAdmin_(session);
  const r=clientOnboardingRecord_(id),e=r.editorHandover||{};
  if(clientHubReview_(r).status!=='approved'||!r.siteLaunch||!r.siteLaunch.url)
    throw new Error('Final written approval and recorded live HTTPS domain are required.');
  if(!e.siteId||PropertiesService.getScriptProperties().getProperty(CHIPIN_EDITOR_STATUS_PREFIX+e.siteId)!=='yes')
    throw new Error('The client must activate their individual Simple Website Editor password before handover.');
  if(!PropertiesService.getScriptProperties().getProperty(CHIPIN_EDITOR_LOGIN_PREFIX+e.siteId))
    throw new Error('The client must sign in successfully to their own Simple Website Editor before handover.');
  const site=getEditorSite_(e.siteId);
  if(site.repo_full_name!==r.siteProvision.repository||String(site.login_email).toLowerCase()!==r.email.toLowerCase())
    throw new Error('Editor registry does not match this client.');
  if(e.handoverSentAt)return {sent:false,alreadySent:true,sentAt:e.handoverSentAt,email:r.email};
  const editorUrl=r.siteLaunch.url+'edit/';
  MailApp.sendEmail({to:r.email,subject:'Your website is live — links and editor access | '+r.business,
    body:'Your finished website is now live:\n'+r.siteLaunch.url+
      '\n\nYour Simple Website Editor:\n'+editorUrl+
      '\n\nSign in with '+r.email+' and the password you created using the private setup invitation. '+
      'You can update approved content such as text, opening hours, menus, events and photos. '+
      'Save a draft, check the preview, and choose Publish changes when you want to update the live site.\n\n'+
      'Keep your editor password private. Your domain and website remain separate from your GitHub source code; no GitHub login is required.\n\n'+
      'For help or larger website changes, contact Chip In through your agreed support arrangement.\n\nChip In'
  });
  e.handoverSentAt=new Date().toISOString();
  clientOnboardingSave_(r);
  return {sent:true,email:r.email,siteUrl:r.siteLaunch.url,editorUrl,sentAt:e.handoverSentAt};
}
