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
  CacheService.getScriptCache().put(`editor-session:${token}`, JSON.stringify({siteId:site.site_id,email:cleanEmail}), EDITOR_CONFIG.SESSION_SECONDS);
  return editorBootstrap_(site, token);
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

function setInitialEditorPassword(siteId, newPassword) {
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

function uploadEditorImage(siteId, token, asset) {
  requireEditorSession_(siteId, token);
  const site = getEditorSite_(siteId);
  if (!asset || !asset.data || !asset.name) throw new Error('Choose an image first.');
  const mime = String(asset.mimeType || '').toLowerCase();
  if (!mime.startsWith('image/')) throw new Error('Only image files are allowed.');
  const bytes = Utilities.base64Decode(asset.data);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Images must be 8 MB or smaller.');
  const ext = imageExtension_(asset.name, mime);
  const stem = sanitiseAssetName_(asset.name.replace(/\.[^.]+$/, '')) || 'image';
  const filename = `${Date.now()}-${stem}.${ext}`;
  const mediaRoot = site.media_root || 'media/editor';
  const path = `${mediaRoot}/${filename}`;
  githubWriteBase64_(site, path, asset.data, `Upload ${filename} from Chip In Websites editor`);
  return {path:path,name:filename};
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
  return session;
}

function githubToken_() {
  const props = PropertiesService.getScriptProperties();
  const key = 'CHIP_IN_WEBSITES_GITHUB_TOKEN';
  const legacyKey = ['HOSP','OLP_GITHUB_TOKEN'].join('');
  const token = props.getProperty(key) || props.getProperty(legacyKey);
  if (!token) throw new Error('Chip In Websites publishing has not been connected to GitHub yet.');
  if (!props.getProperty(key)) props.setProperty(key, token);
  if (props.getProperty(legacyKey)) props.deleteProperty(legacyKey);
  return token;
}

function githubRequest_(site, path, method, payload) {
  const url = `${EDITOR_CONFIG.GITHUB_API}/repos/${site.repo_full_name}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
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

function githubReadText_(site, path) {
  const result = githubRequest_(site, path, 'get');
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
