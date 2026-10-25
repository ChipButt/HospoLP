const EDITOR_CONFIG = {
  REGISTRY_SPREADSHEET_ID: '12otLULjhJZ8dln9jPWa_DByUQ750NRHkhhciuCZimlY',
  REGISTRY_SHEET: 'Clients',
  SESSION_SECONDS: 21600,
  GITHUB_API: 'https://api.github.com',
  STANDARD_CONTENT_FILES: ['site','hours','menu','events','features','gallery','drinks','theme'],
  DRAFT_FOLDER_NAME: 'Chip In Websites Editor Drafts'
};

function renderEditor_(e) {
  const siteId = String((e && e.parameter && e.parameter.site) || '').trim();
  const site = getEditorSite_(siteId);
  const t = HtmlService.createTemplateFromFile('EditorUI');
  t.siteId = site.site_id;
  t.siteName = site.business_name;
  t.publicUrl = site.public_url;
  const invitation = String((e && e.parameter && e.parameter.setup) || '');
  t.initialSetupToken = JSON.stringify(/^[0-9a-f]{96}$/.test(invitation) ? invitation : '');
  return t.evaluate()
    .setTitle(`${site.business_name} Website Editor`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function serveEditorContent_(e) {
  const siteId = String((e && e.parameter && e.parameter.site) || '').trim();
  const callback = String((e && e.parameter && e.parameter.callback) || '').trim();
  if (!/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) return ContentService.createTextOutput('/* invalid callback */').setMimeType(ContentService.MimeType.JAVASCRIPT);
  try {
    const data = getEditorData_(siteId);
    return ContentService.createTextOutput(`${callback}(${JSON.stringify(data)});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    return ContentService.createTextOutput(`${callback}({});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

function loginEditor(siteId, email, password) {
  const site = getEditorSite_(siteId);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail !== String(site.login_email || '').trim().toLowerCase() || !verifyPassword_(password, site.password_salt, site.password_hash)) {
    Utilities.sleep(400);
    throw new Error('Email or password is incorrect.');
  }
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(`editor-session:${token}`, JSON.stringify({siteId:site.site_id,email:cleanEmail,authVersion:PropertiesService.getScriptProperties().getProperty('chipin-editor-auth-version:'+site.site_id)||''}), EDITOR_CONFIG.SESSION_SECONDS);
  // Only mark a client editor as verified after we have ALSO loaded its
  // own website content and editable schema. Valid credentials alone are not
  // evidence that the editor can actually open.
  const bootstrap=editorBootstrap_(site, token);
  const props=PropertiesService.getScriptProperties();
  if(!bootstrap.mustChangePassword&&
     props.getProperty('chipin-client-editor-active:'+site.site_id)==='yes')
    props.setProperty('chipin-client-editor-login:'+site.site_id,new Date().toISOString());
  return bootstrap;
}

function resumeEditorSession(siteId, token) {
  requireEditorSession_(siteId, token);
  return editorBootstrap_(getEditorSite_(siteId), token);
}

function changeEditorPassword(siteId, token, currentPassword, newPassword) {
  requireEditorSession_(siteId, token);
  const site = getEditorSite_(siteId);
  if (!verifyPassword_(currentPassword, site.password_salt, site.password_hash)) throw new Error('Current password is incorrect.');
  validatePassword_(newPassword);
  const salt = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const hash = hashPassword_(newPassword, salt);
  updateRegistryCredentials_(site._row, salt, hash, false);
  return {success:true};
}

function completeInitialPasswordChange(siteId, token, newPassword) {
  requireEditorSession_(siteId, token);
  const site = getEditorSite_(siteId);
  if (!isTemporaryPassword_(site)) return editorBootstrap_(site, token);
  validatePassword_(newPassword);
  const salt = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const hash = hashPassword_(newPassword, salt);
  updateRegistryCredentials_(site._row, salt, hash, false);
  return editorBootstrap_(getEditorSite_(siteId), token);
}

function setInitialEditorPassword(siteId, newPassword, ownerSession) {
  // Public Apps Script functions are remotely invokable. NEVER allow an
  // unauthenticated caller to reset a customer's website editor password.
  clientOnboardingRequireAdmin_(ownerSession);
  const site = getEditorSite_(siteId);
  validatePassword_(newPassword);
  const salt = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const hash = hashPassword_(newPassword, salt);
  updateRegistryCredentials_(site._row, salt, hash, true);
  return {success:true,siteId:site.site_id};
}

function editorBootstrap_(site, token) {
  if (isTemporaryPassword_(site)) {
    return {
      token: token,
      siteName: site.business_name,
      publicUrl: site.public_url,
      mustChangePassword: true
    };
  }
  const savedDraft = getEditorDraft_(site.site_id);
  return {
    token: token,
    siteName: site.business_name,
    publicUrl: site.public_url,
    mustChangePassword: false,
    data: getEditorData_(site.site_id),
    draft: savedDraft ? savedDraft.data : null,
    draftSavedAt: savedDraft ? savedDraft.savedAt : null,
    schema: getEditorSchema_(site)
  };
}

function saveEditorDraft(siteId, token, payload) {
  requireEditorSession_(siteId, token);
  getEditorSite_(siteId);
  const cleaned = sanitiseEditorPayload_(payload || {});
  const savedAt = new Date().toISOString();
  writeEditorDraft_(siteId, {siteId:siteId,savedAt:savedAt,data:cleaned});
  return {success:true,savedAt:savedAt};
}

function discardEditorDraft(siteId, token) {
  requireEditorSession_(siteId, token);
  deleteEditorDraft_(siteId);
  return {success:true};
}

function publishEditorData(siteId, token, payload) {
  requireEditorSession_(siteId, token);
  const site = getEditorSite_(siteId);
  const cleaned = sanitiseEditorPayload_(payload || {});
  const root = site.content_root || 'content';
  Object.keys(cleaned).forEach(name => {
    if (!EDITOR_CONFIG.STANDARD_CONTENT_FILES.includes(name)) return;
    githubWriteText_(site, `${root}/${name}.json`, JSON.stringify(cleaned[name], null, 2) + '\n', `Update ${name} from Chip In Websites editor`);
  });
  deleteEditorDraft_(siteId);
  return {success:true,publishedAt:new Date().toISOString(),data:getEditorData_(siteId)};
}

function editorClientPhotosFolder_(site) {
  // Locate exactly this registered customer in the private onboarding workspaces.
  // Never rely on a caller-supplied Drive ID or on a public upload token.
  const properties = PropertiesService.getScriptProperties().getProperties();
  const prefix = CLIENT_ONBOARDING.projectPrefix;
  const matches = Object.keys(properties).filter(key => key.indexOf(prefix) === 0)
    .map(key => { try { return JSON.parse(properties[key]); } catch (_) { return null; } })
    .filter(record => record && record.siteProvision &&
      record.siteProvision.repository === String(site.repo_full_name) &&
      record.editorHandover && record.editorHandover.siteId === String(site.site_id) &&
      String(record.email || '').toLowerCase() === String(site.login_email || '').toLowerCase());
  if (matches.length !== 1 || !matches[0].children || !matches[0].children.photos) {
    // The Bull's Head is an owner-controlled pre-contract demonstration.
    // Keep its uploaded images privately in Drive until a client workspace exists.
    const props=PropertiesService.getScriptProperties();
    if (String(site.site_id)==='bulls-head-bidford' &&
        String(site.repo_full_name)==='ChipButt/TheBullsHeadBidford' &&
        props.getProperty('chipin-owner-demo:bulls-head-bidford')==='yes') {
      const key='CHIPIN_BULLS_HEAD_DEMO_PHOTOS_FOLDER_ID';
      const existing=props.getProperty(key);
      if(existing) return DriveApp.getFolderById(existing);
      const parent=DriveApp.getFolderById(CLIENT_ONBOARDING.parentFolderId);
      const folder=parent.createFolder('Bulls Head — Owner Demo Editor Images');
      props.setProperty(key,folder.getId());
      return folder;
    }
    throw new Error('The client photos archive is not connected. Ask Chip In to check this website in the Client Project Hub.');
  }
  return DriveApp.getFolderById(matches[0].children.photos);
}

function uploadEditorImage(siteId, token, asset) {
  requireEditorSession_(siteId, token);
  const site = getEditorSite_(siteId);
  if (!asset || !asset.data || !asset.name) throw new Error('Choose an image first.');
  const mime = String(asset.mimeType || '').toLowerCase();
  if (!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(mime))
    throw new Error('Choose a JPG, PNG, WebP, GIF or AVIF image.');
  const bytes = Utilities.base64Decode(asset.data);
  if (!bytes.length || bytes.length > 8 * 1024 * 1024)
    throw new Error('Images must be 8 MB or smaller.');
  const ext = imageExtension_(asset.name, mime);
  const stem = sanitiseAssetName_(asset.name.replace(/\.[^.]+$/, '')) || 'image';
  const filename = `${Date.now()}-${stem}.${ext}`;
  const mediaRoot = site.media_root || 'media/editor';
  const path = `${mediaRoot}/${filename}`;
  // Store the original bytes in this customer's established Google Drive Photos
  // folder before publishing to GitHub. If GitHub fails, the image is still archived.
  const archive = editorClientPhotosFolder_(site).createFile(Utilities.newBlob(bytes, mime, filename));
  try {
    githubWriteBase64_(site, path, asset.data, `Upload ${filename} from Chip In Websites editor`);
  } catch (err) {
    throw new Error('Image preserved in the client Google Drive folder, but website upload failed: ' + err.message);
  }
  return {path:path,name:filename,backedUp:true,driveFileId:archive.getId()};
}

function getEditorDraft_(siteId) {
  const file = findEditorDraftFile_(siteId);
  if (!file) return null;
  try {
    const parsed = JSON.parse(file.getBlob().getDataAsString());
    if (!parsed || parsed.siteId !== String(siteId) || !parsed.data) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

function writeEditorDraft_(siteId, value) {
  const folder = getEditorDraftFolder_();
  const filename = `${sanitiseAssetName_(siteId) || 'site'}.json`;
  const content = JSON.stringify(value);
  const files = folder.getFilesByName(filename);
  if (files.hasNext()) {
    files.next().setContent(content);
  } else {
    folder.createFile(filename, content, MimeType.PLAIN_TEXT);
  }
}

function deleteEditorDraft_(siteId) {
  const file = findEditorDraftFile_(siteId);
  if (file) file.setTrashed(true);
}

function findEditorDraftFile_(siteId) {
  const folder = getEditorDraftFolder_();
  const filename = `${sanitiseAssetName_(siteId) || 'site'}.json`;
  const files = folder.getFilesByName(filename);
  return files.hasNext() ? files.next() : null;
}

function getEditorDraftFolder_() {
  const props = PropertiesService.getScriptProperties();
  const key = 'CHIP_IN_WEBSITES_DRAFT_FOLDER_ID';
  const legacyKey = ['HOSP','OLP_DRAFT_FOLDER_ID'].join('');
  const savedId = props.getProperty(key) || props.getProperty(legacyKey);
  if (savedId) {
    try {
      const folder = DriveApp.getFolderById(savedId);
      if (folder.getName() !== EDITOR_CONFIG.DRAFT_FOLDER_NAME) folder.setName(EDITOR_CONFIG.DRAFT_FOLDER_NAME);
      props.setProperty(key, savedId);
      props.deleteProperty(legacyKey);
      return folder;
    } catch (err) { /* recreate below */ }
  }
  const folders = DriveApp.getFoldersByName(EDITOR_CONFIG.DRAFT_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(EDITOR_CONFIG.DRAFT_FOLDER_NAME);
  props.setProperty(key, folder.getId());
  return folder;
}

function getEditorSite_(siteId) {
  const id = String(siteId || '').trim();
  if (!id) throw new Error('Unknown website.');
  const sheet = SpreadsheetApp.openById(EDITOR_CONFIG.REGISTRY_SPREADSHEET_ID).getSheetByName(EDITOR_CONFIG.REGISTRY_SHEET);
  if (!sheet) throw new Error('Chip In Websites client registry is not configured.');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Unknown website.');
  const headers = values[0].map(String);
  for (let r = 1; r < values.length; r++) {
    const row = {};
    headers.forEach((h, i) => row[h] = values[r][i]);
    if (String(row.site_id).trim() === id && truthy_(row.active)) {
      row._row = r + 1;
      return row;
    }
  }
  throw new Error('Unknown or inactive website.');
}

function updateRegistryCredentials_(rowNumber, salt, hash, isTemporary) {
  const sheet = SpreadsheetApp.openById(EDITOR_CONFIG.REGISTRY_SPREADSHEET_ID).getSheetByName(EDITOR_CONFIG.REGISTRY_SHEET);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const saltCol = headers.indexOf('password_salt') + 1;
  const hashCol = headers.indexOf('password_hash') + 1;
  if (!saltCol || !hashCol) throw new Error('Password columns are missing from the client registry.');
  const tempCol = ensureRegistryColumn_(sheet, 'password_is_temporary');
  sheet.getRange(rowNumber, saltCol).setValue(salt);
  sheet.getRange(rowNumber, hashCol).setValue(hash);
  sheet.getRange(rowNumber, tempCol).setValue(isTemporary === true);
}

function ensureRegistryColumn_(sheet, name) {
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const existing = headers.indexOf(name) + 1;
  if (existing) return existing;
  const col = sheet.getLastColumn() + 1;
  sheet.getRange(1,col).setValue(name);
  return col;
}

function isTemporaryPassword_(site) {
  if (Object.prototype.hasOwnProperty.call(site, 'password_is_temporary')) {
    const value = String(site.password_is_temporary == null ? '' : site.password_is_temporary).trim();
    if (value !== '') return truthy_(site.password_is_temporary);
  }
  // Secure default for legacy rows: the existing admin-set password is treated as temporary
  // until the customer replaces it once.
  return true;
}

function getEditorSchema_(site) {
  const path = site.schema_path || 'editor.schema.json';
  return JSON.parse(githubReadText_(site, path));
}

function getEditorData_(siteId) {
  const site = getEditorSite_(siteId);
  const root = site.content_root || 'content';
  const data = {};
  EDITOR_CONFIG.STANDARD_CONTENT_FILES.forEach(name => {
    try { data[name] = JSON.parse(githubReadText_(site, `${root}/${name}.json`)); } catch (err) { /* optional content file */ }
  });
  return data;
}

function requireEditorSession_(siteId, token) {
  const value = CacheService.getScriptCache().get(`editor-session:${String(token || '')}`);
  if (!value) throw new Error('Your editor session has expired. Please sign in again.');
  const session = JSON.parse(value);
  if (session.siteId !== String(siteId)) throw new Error('This session cannot edit that website.');
  const authVersion=PropertiesService.getScriptProperties().getProperty('chipin-editor-auth-version:'+String(siteId))||'';
  if (authVersion && session.authVersion !== authVersion)
    throw new Error('The editor account credentials have been updated. Please sign in again.');
  return session;
}

function githubToken_() {
  const props = PropertiesService.getScriptProperties();
  const key = 'CHIP_IN_WEBSITES_GITHUB_TOKEN';
  const legacyKey = ['HOSP','OLP_GITHUB_TOKEN'].join('');
  const token = props.getProperty(key) || props.getProperty(legacyKey) || props.getProperty('CHIPIN_GITHUB_PROVISION_TOKEN');
  if (!token) throw new Error('Chip In Websites publishing has not been connected to GitHub yet.');
  if (!props.getProperty(key)) props.setProperty(key, token);
  if (props.getProperty(legacyKey)) props.deleteProperty(legacyKey);
  return token;
}

function githubRequest_(site, path, method, payload, ref) {
  const url = `${EDITOR_CONFIG.GITHUB_API}/repos/${site.repo_full_name}/contents/${path.split('/').map(encodeURIComponent).join('/')}` +
    (ref ? '?ref=' + encodeURIComponent(ref) : '');
  const options = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: `Bearer ${githubToken_()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Chip-In-Websites-Editor'
    }
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }
  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) throw new Error(`GitHub publishing error (${code}). ${safeGithubError_(text)}`);
  return text ? JSON.parse(text) : {};
}

function githubReadText_(site, path, ref) {
  const result = githubRequest_(site, path, 'get', null, ref);
  if (!result.content) throw new Error(`Could not read ${path}.`);
  return Utilities.newBlob(Utilities.base64Decode(String(result.content).replace(/\s/g,''))).getDataAsString();
}

function githubWriteText_(site, path, text, message) {
  const b64 = Utilities.base64Encode(Utilities.newBlob(text, 'text/plain').getBytes());
  return githubWriteBase64_(site, path, b64, message);
}

function githubWriteBase64_(site, path, base64, message) {
  let sha = null;
  try { sha = githubRequest_(site, path, 'get').sha; } catch (err) { if (!String(err.message).includes('(404)')) throw err; }
  const payload = {message:message,content:String(base64).replace(/\s/g,''),branch:'main'};
  if (sha) payload.sha = sha;
  return githubRequest_(site, path, 'put', payload);
}

function safeGithubError_(text) {
  try { return JSON.parse(text).message || 'Unknown error'; } catch (e) { return String(text || '').slice(0,200); }
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + String(password), Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,'0')).join('');
}

function verifyPassword_(password, salt, expected) {
  if (!salt || !expected) return false;
  return hashPassword_(password, salt) === String(expected).toLowerCase();
}

function validatePassword_(password) {
  const p = String(password || '');
  if (p.length < 8) throw new Error('Your new password must be at least 8 characters long.');
}

function truthy_(value) {
  return value === true || ['true','yes','1','active'].includes(String(value || '').trim().toLowerCase());
}

function imageExtension_(name, mime) {
  const byMime = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
  if (byMime[mime]) return byMime[mime];
  const ext = String(name || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'');
  return ext || 'jpg';
}

function sanitiseAssetName_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
}

function sanitiseEditorPayload_(payload) {
  const text = v => String(v == null ? '' : v).slice(0,5000);
  const bool = v => !!v;
  const p = JSON.parse(JSON.stringify(payload || {}));
  const out = {};
  if (p.site) {
    out.site = p.site;
    ['name','locationLine','heroEyebrow','heroTitle','heroSubtitle','strapline','heroNote','shortWelcome','primaryMessage','aboutBannerEyebrow','aboutBannerTitle','aboutBannerLead','menuBannerEyebrow','menuBannerTitle','menuBannerLead','hoursBannerEyebrow','hoursBannerTitle','eventsBannerEyebrow','eventsBannerTitle','visitBannerEyebrow','visitBannerTitle','visitBannerLead','aboutHeading','aboutLead','aboutBody','address','phone','email','mapsUrl','seoTitle','seoDescription','reviewQuote','reviewCredit','footerNote','logoImage','heroImage','heroImageAlt'].forEach(k => { if (k in out.site) out.site[k] = text(out.site[k]); });
    if (Array.isArray(out.site.facts)) out.site.facts = out.site.facts.slice(0,30).map(text);
    if (out.site.notice) out.site.notice = {enabled:bool(out.site.notice.enabled),title:text(out.site.notice.title),text:text(out.site.notice.text)};
  }
  if (p.hours) out.hours = p.hours;
  if (p.menu) out.menu = p.menu;
  if (p.events) out.events = p.events;
  if (p.features) out.features = p.features;
  if (p.gallery) out.gallery = p.gallery;
  if (p.drinks) out.drinks = p.drinks;
  if (p.theme) out.theme = p.theme;
  return out;
}

/**
 * Explicitly owner-controlled, pre-contract demo setup for the ONE existing
 * Bull's Head showcase. Does not bypass normal client handover or register
 * arbitrary client repositories. Never hardcodes or emails a password.
 */
function ownerActivateBullsHeadDemoEditor(ownerSession, loginEmail, password) {
  clientOnboardingRequireAdmin_(ownerSession);
  const siteId='bulls-head-bidford';
  const repo='ChipButt/TheBullsHeadBidford';
  const initialPublicUrl='https://chipbutt.github.io/TheBullsHeadBidford/';
  const email=clientOnboardingEmail_(loginEmail);
  const secret=String(password||'');
  if(secret.length<12||secret.length>128||/^(password|12345|qwerty)/i.test(secret))
    throw new Error('Choose a unique editor password of at least 12 characters.');
  return clientOnboardingWithLock_(()=>{
    const config={repo_full_name:repo};
    const schema=JSON.parse(githubReadText_(config,'editor.schema.json'));
    if(!schema||!Array.isArray(schema.pages)||schema.pages.length<7)
      throw new Error('The Bull\'s Head does not have a valid live editor schema.');
    for(const name of EDITOR_CONFIG.STANDARD_CONTENT_FILES)
      githubReadText_(config,'content/'+name+'.json');
    const bridge=githubReadText_(config,'assets/chipin-live-content.js');
    if(!bridge.includes('hospolp-preview')||!bridge.includes('content/site.json'))
      throw new Error('The Bull\'s Head live editor bridge is incomplete.');
    const sheet=SpreadsheetApp.openById(EDITOR_CONFIG.REGISTRY_SPREADSHEET_ID)
      .getSheetByName(EDITOR_CONFIG.REGISTRY_SHEET);
    if(!sheet)throw new Error('The private editor client registry is unavailable.');
    ensureRegistryColumn_(sheet,'password_is_temporary');
    const values=sheet.getDataRange().getValues();
    const headers=values[0].map(String);
    const existing=values.slice(1).findIndex(row=>String(row[headers.indexOf('site_id')]).trim()===siteId);
    const props=PropertiesService.getScriptProperties();
    if(existing>=0){
      if(props.getProperty('chipin-owner-demo:'+siteId)!=='yes')
        throw new Error('This site ID has already been registered outside the internal demo. Refusing to reset its credentials.');
      const row=values[existing+1];
      if(String(row[headers.indexOf('repo_full_name')])!==repo)
        throw new Error('The existing demo account points to a different repository.');
    }
    const salt=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
    const registeredUrl=existing>=0?String(values[existing+1][headers.indexOf('public_url')]||initialPublicUrl):initialPublicUrl;
    const row={
      site_id:siteId,business_name:'The Bulls Head',
      public_url:registeredUrl,login_email:email,password_salt:salt,
      password_hash:hashPassword_(secret,salt),password_is_temporary:false,
      active:true,repo_full_name:repo,content_root:'content',
      media_root:'media/editor',schema_path:'editor.schema.json'
    };
    const mapped=headers.map(h=>Object.prototype.hasOwnProperty.call(row,h)?row[h]:'');
    if(existing>=0)sheet.getRange(existing+2,1,1,mapped.length).setValues([mapped]);
    else sheet.appendRow(mapped);
    props.setProperty('chipin-owner-demo:'+siteId,'yes');
    // Revoke any former owner test sessions when login changes for Tuesday.
    props.setProperty('chipin-editor-auth-version:'+siteId,Utilities.getUuid());
    const folder=editorClientPhotosFolder_(getEditorSite_(siteId));
    return {success:true,editorUrl:registeredUrl+'edit/',websiteUrl:registeredUrl,
      photosFolderUrl:folder.getUrl(),loginEmail:email};
  });
}

/**
 * Owner-only update of the public preview address for the existing Bull's Head
 * editor. The site ID, credentials, content, image assets and GitHub repo stay
 * unchanged. Refuse unknown or incorrectly-hosted sites.
 */
function ownerUpdateBullsHeadEditorPublicUrl(ownerSession, candidateUrl) {
  clientOnboardingRequireAdmin_(ownerSession);
  const url=clientHubSafeLiveUrl_(candidateUrl);
  // Confirm the address serves the *actual Bull's Head editor-enabled* site.
  // The redirect and page both remain at the same origin for iframe preview.
  let response;
  try {
    response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true,headers:{'User-Agent':'Chip-In-Editor-Domain-Check'}});
  } catch (err) {
    throw new Error('The custom domain is not reachable yet. Finish hosting and DNS before updating the editor.');
  }
  if(response.getResponseCode()!==200 ||
     !response.getContentText().includes('assets/chipin-live-content.js') ||
     !response.getContentText().includes('The Bulls Head'))
    throw new Error('That address does not serve the Bull\'s Head live-editable website. No changes were made.');
  // The editor redirect must exist too; otherwise updating would strand users.
  const editorResponse=UrlFetchApp.fetch(url+'edit/',{muteHttpExceptions:true,followRedirects:false});
  if(editorResponse.getResponseCode()!==200 ||
     !editorResponse.getContentText().includes('bulls-head-bidford'))
    throw new Error('The new website does not include its Bull\'s Head editor shortcut. No changes were made.');
  return clientOnboardingWithLock_(()=>{
    const site=getEditorSite_('bulls-head-bidford');
    if(site.repo_full_name!=='ChipButt/TheBullsHeadBidford')
      throw new Error('The editor is registered to a different GitHub repository.');
    if(PropertiesService.getScriptProperties().getProperty('chipin-owner-demo:bulls-head-bidford')!=='yes')
      throw new Error('This Bull\'s Head site is not registered as owner-controlled. Use the approved handover process.');
    const sheet=SpreadsheetApp.openById(EDITOR_CONFIG.REGISTRY_SPREADSHEET_ID)
      .getSheetByName(EDITOR_CONFIG.REGISTRY_SHEET);
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
    const col=headers.indexOf('public_url')+1;
    if(!col)throw new Error('The website registry is missing its public URL field.');
    sheet.getRange(site._row,col).setValue(url);
    return {success:true,websiteUrl:url,editorUrl:url+'edit/',repository:site.repo_full_name,
      siteId:site.site_id,unchangedLogin:site.login_email};
  });
}

/**
 * Owner-only restoration of the Bull's Head's clean pre-test content.
 * Reverts only the editor-controlled site JSON from a fixed snapshot branch.
 * Never removes uploaded image files, archives, domains, schema or credentials.
 */
function ownerRestoreBullsHeadCleanContent(ownerSession) {
  clientOnboardingRequireAdmin_(ownerSession);
  return clientOnboardingWithLock_(()=>{
    const siteId='bulls-head-bidford';
    const site=getEditorSite_(siteId);
    if(site.repo_full_name!=='ChipButt/TheBullsHeadBidford' ||
       PropertiesService.getScriptProperties().getProperty('chipin-owner-demo:'+siteId)!=='yes')
      throw new Error('This reset is only available for the owner-controlled Bull\'s Head editor.');
    const path='content/site.json';
    const snapshot='tuesday-editor-clean-baseline-2026-10-25';
    const baseline=githubReadText_(site,path,snapshot);
    const parsed=JSON.parse(baseline);
    if(!parsed || typeof parsed!=='object' || !parsed.editorPages ||
       !parsed.editorPages.index || !parsed.editorPages.drinks)
      throw new Error('The clean baseline is invalid. No website changes were made.');
    const current=githubReadText_(site,path);
    let changed=false;
    if(current!==baseline){
      githubWriteText_(site,path,baseline,'Restore Bulls Head editor text and photos to clean owner-test baseline');
      changed=true;
    }
    // Remove any abandoned autosaved draft that would otherwise reintroduce
    // old test values when the client opens the editor on Tuesday.
    deleteEditorDraft_(siteId);
    return {success:true,contentRestored:changed,siteUrl:site.public_url,
      siteId:siteId,baseline:snapshot,archivedImagesPreserved:true,draftCleared:true};
  });
}
