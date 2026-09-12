const EDITOR_CONFIG = {
  DATA_PARENT_FOLDER_ID: '1xjbLwbzT7JJoHHYH8V82IAtaWuRx1Owx',
  SESSION_SECONDS: 21600,
  CODE_SECONDS: 600,
  SITES: {
    'mims-flans': {
      name: 'Mim’s Flans',
      allowedEmails: ['jameschipbutt@hotmail.com'],
      publicUrl: 'https://chipbutt.github.io/MimsFlans/',
      rawBase: 'https://raw.githubusercontent.com/ChipButt/MimsFlans/main/content/',
      files: ['site','hours','drinks','menu','events','features','gallery','theme']
    }
  }
};

function renderEditor_(e) {
  const siteId = String((e && e.parameter && e.parameter.site) || '').trim();
  const site = EDITOR_CONFIG.SITES[siteId];
  if (!site) return HtmlService.createHtmlOutput('Unknown website.');
  const t = HtmlService.createTemplateFromFile('EditorUI');
  t.siteId = siteId;
  t.siteName = site.name;
  t.publicUrl = site.publicUrl;
  return t.evaluate()
    .setTitle(`${site.name} Website Editor`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function serveEditorContent_(e) {
  const siteId = String((e && e.parameter && e.parameter.site) || '').trim();
  const callback = String((e && e.parameter && e.parameter.callback) || '').trim();
  if (!EDITOR_CONFIG.SITES[siteId]) return ContentService.createTextOutput('/* unknown site */').setMimeType(ContentService.MimeType.JAVASCRIPT);
  if (!/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) return ContentService.createTextOutput('/* invalid callback */').setMimeType(ContentService.MimeType.JAVASCRIPT);
  const data = getEditorData_(siteId);
  return ContentService.createTextOutput(`${callback}(${JSON.stringify(data)});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function requestEditorCode(siteId, email) {
  const site = getEditorSite_(siteId);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!site.allowedEmails.map(x => x.toLowerCase()).includes(cleanEmail)) { Utilities.sleep(350); return {success:true}; }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  CacheService.getScriptCache().put(`editor-code:${siteId}:${cleanEmail}`, code, EDITOR_CONFIG.CODE_SECONDS);
  MailApp.sendEmail({to:cleanEmail,subject:`${site.name} website editor sign-in code`,htmlBody:`<p>Your ${site.name} website editor code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes.</p>`});
  return {success:true};
}

function verifyEditorCode(siteId, email, code) {
  const site = getEditorSite_(siteId);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!site.allowedEmails.map(x => x.toLowerCase()).includes(cleanEmail)) throw new Error('This email is not authorised for this website.');
  const cache = CacheService.getScriptCache();
  const key = `editor-code:${siteId}:${cleanEmail}`;
  const expected = cache.get(key);
  if (!expected || String(code || '').trim() !== expected) throw new Error('That code is incorrect or has expired.');
  cache.remove(key);
  const token = Utilities.getUuid() + Utilities.getUuid();
  cache.put(`editor-session:${token}`, JSON.stringify({siteId,email:cleanEmail}), EDITOR_CONFIG.SESSION_SECONDS);
  return {token,siteName:site.name,publicUrl:site.publicUrl,data:getEditorData_(siteId)};
}

function resumeEditorSession(siteId, token) {
  requireEditorSession_(siteId, token);
  const site = getEditorSite_(siteId);
  return {siteName:site.name,publicUrl:site.publicUrl,data:getEditorData_(siteId)};
}

function publishEditorData(siteId, token, payload) {
  requireEditorSession_(siteId, token);
  const cleaned = sanitiseEditorPayload_(siteId, payload || {});
  writeEditorData_(siteId, cleaned);
  return {success:true,publishedAt:new Date().toISOString(),data:cleaned};
}

function uploadEditorImage(siteId, token, asset) {
  requireEditorSession_(siteId, token);
  if (!asset || !asset.data || !asset.name) throw new Error('Invalid image.');
  const mime = String(asset.mimeType || '').toLowerCase();
  if (!mime.startsWith('image/')) throw new Error('Only image files are allowed.');
  const bytes = Utilities.base64Decode(asset.data);
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Images must be 10 MB or smaller.');
  const folder = getEditorSiteFolder_(siteId);
  const imageFolder = getOrCreateFolder_(folder, 'Images');
  const file = imageFolder.createFile(Utilities.newBlob(bytes, mime, sanitiseFileName_(asset.name)));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) { console.warn(err); }
  return {url:`https://drive.google.com/uc?export=view&id=${file.getId()}`,name:file.getName()};
}

function getEditorSite_(siteId) {
  const site = EDITOR_CONFIG.SITES[String(siteId || '')];
  if (!site) throw new Error('Unknown website.');
  return site;
}

function requireEditorSession_(siteId, token) {
  const value = CacheService.getScriptCache().get(`editor-session:${String(token || '')}`);
  if (!value) throw new Error('Your editor session has expired. Please sign in again.');
  const session = JSON.parse(value);
  if (session.siteId !== siteId) throw new Error('This session cannot edit that website.');
  return session;
}

function getEditorData_(siteId) {
  const site = getEditorSite_(siteId);
  const folder = getEditorSiteFolder_(siteId);
  const files = folder.getFilesByName('site-data.json');
  if (files.hasNext()) return JSON.parse(files.next().getBlob().getDataAsString());
  const data = {};
  site.files.forEach(name => {
    const response = UrlFetchApp.fetch(`${site.rawBase}${name}.json`, {muteHttpExceptions:true});
    if (response.getResponseCode() === 200) data[name] = JSON.parse(response.getContentText());
  });
  writeEditorData_(siteId, data);
  return data;
}

function writeEditorData_(siteId, data) {
  const folder = getEditorSiteFolder_(siteId);
  const files = folder.getFilesByName('site-data.json');
  if (files.hasNext()) files.next().setContent(JSON.stringify(data, null, 2));
  else folder.createFile('site-data.json', JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT);
}

function getEditorSiteFolder_(siteId) {
  const parent = DriveApp.getFolderById(EDITOR_CONFIG.DATA_PARENT_FOLDER_ID);
  const editorRoot = getOrCreateFolder_(parent, 'Website Editor Data');
  return getOrCreateFolder_(editorRoot, siteId);
}

function getOrCreateFolder_(parent, name) {
  const matches = parent.getFoldersByName(name);
  return matches.hasNext() ? matches.next() : parent.createFolder(name);
}

function sanitiseEditorPayload_(siteId, p) {
  const current = getEditorData_(siteId);
  const text = v => String(v == null ? '' : v).slice(0, 5000);
  const bool = v => !!v;
  const arr = v => Array.isArray(v) ? v : [];
  const out = JSON.parse(JSON.stringify(current));

  if (p.site) {
    out.site = out.site || {};
    ['strapline','shortWelcome','primaryMessage','aboutHeading','aboutLead','aboutBody','address','phone','email','reviewQuote','reviewCredit','footerNote','logoImage','heroImage','heroImageAlt'].forEach(k => { if (k in p.site) out.site[k] = text(p.site[k]); });
    if (Array.isArray(p.site.facts)) out.site.facts = p.site.facts.slice(0,20).map(text);
    if (p.site.notice) out.site.notice = {enabled:bool(p.site.notice.enabled),title:text(p.site.notice.title),text:text(p.site.notice.text)};
  }
  if (p.hours) {
    out.hours = out.hours || {};
    out.hours.note = text(p.hours.note);
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    out.hours.hours = days.map((day,i) => { const x = arr(p.hours.hours)[i] || {}; return {day,display:text(x.display),opens:text(x.opens).slice(0,5),closes:text(x.closes).slice(0,5),closed:bool(x.closed)}; });
  }
  if (p.menu) {
    out.menu = out.menu || {};
    out.menu.enabled = bool(p.menu.enabled);
    out.menu.heading = text(p.menu.heading);
    out.menu.intro = text(p.menu.intro);
    out.menu.sections = arr(p.menu.sections).slice(0,20).map(s => ({name:text(s.name),items:arr(s.items).slice(0,100).map(i => ({name:text(i.name),description:text(i.description),price:text(i.price).slice(0,40),available:bool(i.available)}))}));
  }
  if (p.events) out.events = {intro:text(p.events.intro),items:arr(p.events.items).slice(0,50).map(i => ({enabled:bool(i.enabled),title:text(i.title),when:text(i.when),description:text(i.description)}))};
  if (p.features) out.features = {items:arr(p.features.items).slice(0,50).map(i => ({label:text(i.label),enabled:bool(i.enabled)}))};
  if (p.gallery) out.gallery = {enabled:bool(p.gallery.enabled),items:arr(p.gallery.items).slice(0,24).map(i => ({image:text(i.image),alt:text(i.alt)}))};
  return out;
}
