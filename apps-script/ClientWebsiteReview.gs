/**
 * Chip In — one-round website draft review / final written sign-off.
 * Uses each approved client's PRIVATE Drive folder for comments and the existing
 * onboarding owner-session control. No public authoring/GitHub credentials.
 * HTMLService serves the feedback UI via mode=website-review.
 *
 * Review links are bearer tokens: keep private. The Pages staging website itself
 * is NOT made private merely by a review token. Do not put confidential material
 * on an unprotected Pages deployment; configure Cloudflare Access when needed.
 */
const CLIENT_REVIEW_FILE='website-review.json';
const CLIENT_REVIEW_LIMIT=60;
const CLIENT_REVIEW_SESSION_DAYS=45;
function renderClientWebsiteReview_(e){
  const t=HtmlService.createTemplateFromFile('ClientWebsiteReview');
  const token=String(e&&e.parameter&&e.parameter.code||'');
  t.reviewToken=JSON.stringify(/^[a-f0-9]{96}$/.test(token)?token:'');
  return t.evaluate().setTitle('Chip In — Website Review & Approval')
    .addMetaTag('viewport','width=device-width,initial-scale=1');
}
function clientReviewFile_(r){
  const folder=DriveApp.getFolderById(r.folderId);
  const it=folder.getFilesByName(CLIENT_REVIEW_FILE);
  if(it.hasNext())return it.next();
  throw new Error('The client review record is missing. Contact Chip In.');
}
function clientReviewLoad_(r){
  const raw=clientReviewFile_(r).getBlob().getDataAsString('UTF-8');
  const data=JSON.parse(raw);
  if(!data||data.workspaceId!==r.id||!Array.isArray(data.comments))
    throw new Error('Client review data is invalid.');
  return data;
}
function clientReviewSave_(r,review){
  review.updatedAt=new Date().toISOString();
  clientReviewFile_(r).setContent(JSON.stringify(review,null,2));
}
function clientReviewPublicUrl_(r){
  if(!r.review||!r.review.token)throw new Error('Client review link has not been created.');
  const app=ScriptApp.getService().getUrl();
  if(!app)throw new Error('Publish the existing Google Apps Script web app first.');
  return app+'?mode=website-review&code='+encodeURIComponent(r.review.token);
}
function clientReviewFind_(token){
  const value=String(token||'');
  if(!/^[a-f0-9]{96}$/.test(value))throw new Error('Invalid review link.');
  const hash=clientOnboardingHash_(value);
  const props=PropertiesService.getScriptProperties().getProperties();
  for(const key of Object.keys(props)){
    if(key.indexOf(CLIENT_ONBOARDING.projectPrefix)!==0)continue;
    let r;
    try{r=JSON.parse(props[key]);}catch(e){continue;}
    if(r.review&&r.review.tokenHash&&clientOnboardingSame_(r.review.tokenHash,hash)){
      if(new Date(r.review.expiresAt).getTime()<Date.now())throw new Error('This review link has expired. Contact Chip In for access.');
      return r;
    }
  }
  throw new Error('This review link was not recognised.');
}
function clientReviewSafePreview_(link){
  const url=String(link||'').trim();
  // Staging is currently only allowed on Cloudflare's official Pages domain.
  if(!/^https:\/\/[a-z0-9-]+\.pages\.dev\/?$/i.test(url))throw new Error('Review preview must be the existing Cloudflare Pages staging URL.');
  return url.replace(/\/+$/,'');
}
function clientReviewSafePath_(value){
  const p=String(value||'/').trim().slice(0,260);
  if(!/^\/(?!\/)[a-zA-Z0-9\/_.~%-]*$/.test(p)||p.includes('..')||/%2f|%5c/i.test(p))
    throw new Error('Please choose a valid page path beginning with /.');
  return p;
}
function clientReviewPublic_(r,review){
  return {
    business:r.business,previewUrl:review.previewUrl,status:review.status,
    reviewOpenedAt:review.openedAt,feedbackDueAt:review.feedbackDueAt||null,
    revisionTargetAt:review.revisionTargetAt||'',approvedAt:review.approvedAt||'',
    comments:review.comments.map(c=>({id:c.id,path:c.path,title:c.title,
      text:c.text,x:c.x,y:c.y,createdAt:c.createdAt,status:c.status})),
    canComment:review.status==='open'&&Date.now()<=new Date(review.feedbackDueAt).getTime(),
    canApprove:review.status==='awaiting_approval'
  };
}
function clientOnboardingStartWebsiteReview(session,id){
  clientOnboardingRequireAdmin_(session);
  return clientOnboardingWithLock_(()=>{
    const r=clientOnboardingRecord_(id);
    if(!r.siteProvision||!r.siteProvision.pagesProject)throw new Error('Create the client Cloudflare Pages staging project first.');
    if(r.review)return clientOnboardingReviewStatus(session,id);
    const previewUrl=clientReviewSafePreview_(r.siteProvision.pagesUrl);
    const token=clientOnboardingToken_();
    const openedAt=new Date();
    const expiresAt=new Date(openedAt.getTime()+CLIENT_REVIEW_SESSION_DAYS*86400000);
    const review={version:1,workspaceId:r.id,status:'prepared',previewUrl,
      openedAt:null,feedbackDueAt:null,
      comments:[],updatedAt:openedAt.toISOString(),submittedAt:null,approvedAt:null,approvedBy:null};
    DriveApp.getFolderById(r.folderId).createFile(CLIENT_REVIEW_FILE,JSON.stringify(review,null,2),MimeType.PLAIN_TEXT);
    r.review={token,tokenHash:clientOnboardingHash_(token),expiresAt:expiresAt.toISOString()};
    clientOnboardingSave_(r);
    return clientOnboardingReviewStatus(session,id);
  });
}
function clientOnboardingReviewStatus(session,id){
  clientOnboardingRequireAdmin_(session);
  const r=clientOnboardingRecord_(id);
  if(!r.review)return {status:'not_started',business:r.business,comments:[],created:false};
  const v=clientReviewLoad_(r);
  return {status:v.status,business:r.business,email:r.email,reviewUrl:clientReviewPublicUrl_(r),
    previewUrl:v.previewUrl,feedbackDueAt:v.feedbackDueAt,revisionTargetAt:v.revisionTargetAt||'',
    comments:v.comments,submittedAt:v.submittedAt||'',approvedAt:v.approvedAt||'',approvedBy:v.approvedBy||''};
}
function clientOnboardingSendReviewInvitation(session,id){
  clientOnboardingRequireAdmin_(session);
  return clientOnboardingWithLock_(()=>{
    const r=clientOnboardingRecord_(id);
    if(!r.review)throw new Error('Prepare the review first.');
    const v=clientReviewLoad_(r);
    if(!['prepared','open'].includes(v.status))throw new Error('The feedback round is already closed.');
    // Client's THREE days start when the first invitation is actually sent,
    // not when the owner prepares the link.
    const now=new Date();
    const due=v.status==='prepared'
      ?new Date(now.getTime()+3*86400000).toISOString():v.feedbackDueAt;
    if(now.getTime()>new Date(due).getTime())throw new Error('Feedback window is over. Do not restart the agreed round.');
    const reviewUrl=clientReviewPublicUrl_(r);
    MailApp.sendEmail({
      to:r.email,subject:'Review your first website draft — '+r.business,
      body:'Your first website draft is ready to review.\n\nOpen your review portal:\n'+reviewUrl+
        '\n\nPlease submit one consolidated list of changes by '+due+
        '. You have three calendar days from when Chip In first sends your draft review link. '+
        'Chip In will then complete the agreed amendments and send the finished version for final written approval.\n\nChip In'
    });
    if(v.status==='prepared'){
      v.status='open';v.openedAt=now.toISOString();v.feedbackDueAt=due;
      clientReviewSave_(r,v);
    }
    return {sent:true,email:r.email,feedbackDueAt:due};
  });
}
function clientOnboardingCloseExpiredReview(session,id){
  clientOnboardingRequireAdmin_(session);
  return clientOnboardingWithLock_(()=>{
    const r=clientOnboardingRecord_(id);
    if(!r.review)throw new Error('No client review exists.');
    const v=clientReviewLoad_(r);
    if(v.status==='submitted')return clientOnboardingReviewStatus(session,id);
    if(v.status!=='open'||Date.now()<=new Date(v.feedbackDueAt).getTime())
      throw new Error('The client feedback deadline has not passed or the round is already closed.');
    // This is NOT consent to launch: owner must still send the final version
    // and obtain explicit written approval using the same review portal.
    v.status='submitted';
    v.submittedAt=new Date().toISOString();
    v.closedWithoutClientSubmission=true;
    clientReviewSave_(r,v);
    return clientOnboardingReviewStatus(session,id);
  });
}
function clientReviewGet(token){
  const r=clientReviewFind_(token);
  return clientReviewPublic_(r,clientReviewLoad_(r));
}
function clientReviewAddComment(token,input){
  const p=input||{};
  return clientOnboardingWithLock_(()=>{
    const r=clientReviewFind_(token),v=clientReviewLoad_(r);
    if(v.status!=='open'||Date.now()>new Date(v.feedbackDueAt).getTime())
      throw new Error('The feedback deadline has passed or this review was already submitted. Please contact Chip In.');
    if(v.comments.length>=CLIENT_REVIEW_LIMIT)throw new Error('The maximum of 60 comments has been reached. Submit the review or contact Chip In.');
    const title=clientOnboardingClean_(p.title,100);
    const detail=clientOnboardingClean_(p.text,1200);
    if(!detail||detail.length<3)throw new Error('Please describe the requested change.');
    const path=clientReviewSafePath_(p.path||'/');
    const x=p.x===null||p.x===undefined?null:Number(p.x);
    const y=p.y===null||p.y===undefined?null:Number(p.y);
    if((x!==null&&(!Number.isFinite(x)||x<0||x>1))||(y!==null&&(!Number.isFinite(y)||y<0||y>1)))
      throw new Error('Invalid comment pin position.');
    const item={id:Utilities.getUuid(),path,title:title||'Website comment',text:detail,
      x,y,createdAt:new Date().toISOString(),status:'open'};
    v.comments.push(item);
    clientReviewSave_(r,v);
    return clientReviewPublic_(r,v);
  });
}
function clientReviewDeleteComment(token,commentId){
  return clientOnboardingWithLock_(()=>{
    const r=clientReviewFind_(token),v=clientReviewLoad_(r);
    if(v.status!=='open'||Date.now()>new Date(v.feedbackDueAt).getTime())throw new Error('This feedback round is closed.');
    const before=v.comments.length;
    v.comments=v.comments.filter(c=>c.id!==String(commentId||''));
    if(v.comments.length===before)throw new Error('Comment not found.');
    clientReviewSave_(r,v);
    return clientReviewPublic_(r,v);
  });
}
function clientReviewSubmitFeedback(token,noChanges){
  const result=clientOnboardingWithLock_(()=>{
    const r=clientReviewFind_(token),v=clientReviewLoad_(r);
    if(v.status==='submitted'||v.status==='awaiting_approval'||v.status==='approved')return {idempotent:true,business:r.business};
    if(v.status!=='open'||Date.now()>new Date(v.feedbackDueAt).getTime())throw new Error('The feedback deadline has passed; contact Chip In.');
    if(!v.comments.length&&noChanges!==true)throw new Error('Add a comment, or confirm you have no changes.');
    v.status='submitted';
    v.submittedAt=new Date().toISOString();
    v.noChanges=v.comments.length===0;
    clientReviewSave_(r,v);
    return {idempotent:false,business:r.business};
  });
  if(!result.idempotent){
    try{MailApp.sendEmail(clientOnboardingOwnerEmail_(),
      'Client website feedback submitted — '+result.business,
      'The client has submitted their consolidated website review. Open your Chip In Onboarding Admin → Website Review & Approval to see the full amendment list.');}
    catch(e){console.error('Unable to email owner review notification: '+String(e));}
  }
  return clientReviewGet(token);
}
function clientOnboardingUpdateReviewComment(session,id,commentId,newStatus){
  clientOnboardingRequireAdmin_(session);
  if(!['open','in_progress','done'].includes(newStatus))throw new Error('Invalid comment status.');
  return clientOnboardingWithLock_(()=>{
    const r=clientOnboardingRecord_(id),v=clientReviewLoad_(r);
    if(v.status!=='submitted')throw new Error('Change-tracking is available after feedback submission.');
    const item=v.comments.find(c=>c.id===commentId);
    if(!item)throw new Error('Comment was not found.');
    item.status=newStatus;
    clientReviewSave_(r,v);
    return clientOnboardingReviewStatus(session,id);
  });
}
function clientOnboardingSendFinalApproval(session,id){
  clientOnboardingRequireAdmin_(session);
  const result=clientOnboardingWithLock_(()=>{
    const r=clientOnboardingRecord_(id),v=clientReviewLoad_(r);
    if(v.status==='awaiting_approval'||v.status==='approved')
      return {alreadySent:true,email:r.email,url:clientReviewPublicUrl_(r)};
    if(v.status!=='submitted')throw new Error('The client must submit the first review before final approval.');
    if(v.comments.some(c=>c.status!=='done'))
      throw new Error('Mark every submitted amendment as completed before requesting final approval.');
    v.status='awaiting_approval';
    v.finalReviewRequestedAt=new Date().toISOString();
    clientReviewSave_(r,v);
    return {alreadySent:false,email:r.email,url:clientReviewPublicUrl_(r),business:r.business};
  });
  if(!result.alreadySent){
    MailApp.sendEmail({
      to:result.email,subject:'Approve your finished website — '+result.business,
      body:'The agreed changes to your website are complete.\n\nReview the finished website and give written approval here:\n'+result.url+
      '\n\nYour website will only be connected to its live domain after you approve it. DNS/SSL updates normally take 24–48 hours, but external systems can occasionally take longer.\n\nChip In'
    });
  }
  return {sent:true,email:result.email,alreadySent:result.alreadySent};
}
function clientReviewApprove(token,name,confirmed){
  const result=clientOnboardingWithLock_(()=>{
    const r=clientReviewFind_(token),v=clientReviewLoad_(r);
    if(v.status==='approved')return {business:r.business,alreadyApproved:true};
    if(v.status!=='awaiting_approval')throw new Error('Your finished website has not yet been presented for approval.');
    if(confirmed!==true)throw new Error('Please confirm you authorise the finished website to go live.');
    const approver=clientOnboardingClean_(name,110);
    if(approver.length<3)throw new Error('Enter your full name to sign off the website.');
    v.status='approved';v.approvedAt=new Date().toISOString();v.approvedBy=approver;
    clientReviewSave_(r,v);
    return {business:r.business,alreadyApproved:false};
  });
  if(!result.alreadyApproved){
    try{MailApp.sendEmail(clientOnboardingOwnerEmail_(),
      'Client APPROVED website for launch — '+result.business,
      'Final written website approval has been recorded. Verify the agreed domain and DNS/email records before launching. View the name and timestamp in the onboarding admin.');}
    catch(e){console.error('Unable to notify owner of sign-off: '+String(e));}
  }
  return clientReviewGet(token);
}
