const CONFIG = {
  PARENT_FOLDER_ID: '1RnkfWjPN5hs187svzjuVzVXpdDPlbhto',
  MAX_FILE_BYTES: 25 * 1024 * 1024,
  MAX_FILES: 40,
  ALLOWED_MIME_PREFIXES: ['image/'],
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('HospoLP Website Brief')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function startSubmission(payload) {
  payload = payload || {};
  requireText_(payload.businessName, 'Business name');
  requireText_(payload.contactName, 'Your name');
  requireEmail_(payload.contactEmail);

  const parent = DriveApp.getFolderById(CONFIG.PARENT_FOLDER_ID);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/London', 'yyyy-MM-dd HHmm');
  const safeName = sanitiseName_(payload.businessName).slice(0, 80) || 'New Client';
  const root = parent.createFolder(`${stamp} - ${safeName}`);

  const folders = {
    brand: root.createFolder('01 Brand'),
    photos: root.createFolder('02 Photos'),
    menus: root.createFolder('03 Menus & Documents'),
    other: root.createFolder('04 Other')
  };

  const submissionId = Utilities.getUuid();
  const record = {
    submissionId,
    createdAt: new Date().toISOString(),
    rootFolderId: root.getId(),
    folderIds: {
      brand: folders.brand.getId(),
      photos: folders.photos.getId(),
      menus: folders.menus.getId(),
      other: folders.other.getId()
    },
    businessName: payload.businessName,
    contactEmail: payload.contactEmail,
    fileCount: 0
  };

  PropertiesService.getScriptProperties().setProperty(`submission:${submissionId}`, JSON.stringify(record));

  root.createFile('website-brief.json', JSON.stringify(payload, null, 2), MimeType.PLAIN_TEXT);
  root.createFile('website-brief.txt', buildReadableBrief_(payload), MimeType.PLAIN_TEXT);

  return {
    submissionId,
    maxFileBytes: CONFIG.MAX_FILE_BYTES,
    maxFiles: CONFIG.MAX_FILES
  };
}

function uploadAsset(submissionId, asset) {
  const record = getSubmission_(submissionId);
  if (record.fileCount >= CONFIG.MAX_FILES) throw new Error(`Maximum ${CONFIG.MAX_FILES} files per submission.`);
  if (!asset || !asset.name || !asset.data) throw new Error('Invalid file upload.');

  const mimeType = String(asset.mimeType || 'application/octet-stream').toLowerCase();
  if (!isAllowedMime_(mimeType)) throw new Error(`File type not allowed: ${mimeType}`);

  const bytes = Utilities.base64Decode(asset.data);
  if (bytes.length > CONFIG.MAX_FILE_BYTES) throw new Error(`${asset.name} is larger than 25 MB.`);

  const category = ['brand', 'photos', 'menus', 'other'].includes(asset.category) ? asset.category : 'other';
  const folderId = record.folderIds[category];
  const folder = DriveApp.getFolderById(folderId);
  const cleanName = sanitiseFileName_(asset.name);
  const blob = Utilities.newBlob(bytes, mimeType, cleanName);
  const file = folder.createFile(blob);

  record.fileCount += 1;
  PropertiesService.getScriptProperties().setProperty(`submission:${submissionId}`, JSON.stringify(record));

  return { name: file.getName(), category, size: bytes.length };
}

function finishSubmission(submissionId, uploadedFiles) {
  const record = getSubmission_(submissionId);
  const root = DriveApp.getFolderById(record.rootFolderId);
  const manifest = {
    submissionId,
    completedAt: new Date().toISOString(),
    uploadedFiles: Array.isArray(uploadedFiles) ? uploadedFiles : []
  };
  root.createFile('upload-manifest.json', JSON.stringify(manifest, null, 2), MimeType.PLAIN_TEXT);

  const ownerEmail = Session.getEffectiveUser().getEmail();
  const folderUrl = root.getUrl();
  if (ownerEmail) {
    MailApp.sendEmail({
      to: ownerEmail,
      subject: `New HospoLP website brief: ${record.businessName}`,
      htmlBody: [
        `<p><strong>${escapeHtml_(record.businessName)}</strong> has submitted a website brief.</p>`,
        `<p>Contact: ${escapeHtml_(record.contactEmail)}</p>`,
        `<p>Files uploaded: ${record.fileCount}</p>`,
        `<p><a href="${folderUrl}">Open the client submission in Google Drive</a></p>`
      ].join('')
    });
  }

  try {
    MailApp.sendEmail({
      to: record.contactEmail,
      subject: `Website brief received – ${record.businessName}`,
      htmlBody: `<p>Thanks — your website information and files have been received successfully.</p><p>We’ll use these to prepare the first version of your website.</p>`
    });
  } catch (err) {
    console.warn('Could not send client confirmation email', err);
  }

  PropertiesService.getScriptProperties().deleteProperty(`submission:${submissionId}`);
  return { success: true };
}

function getSubmission_(submissionId) {
  const value = PropertiesService.getScriptProperties().getProperty(`submission:${submissionId}`);
  if (!value) throw new Error('This submission has expired or is invalid. Please restart the form.');
  return JSON.parse(value);
}

function isAllowedMime_(mimeType) {
  return CONFIG.ALLOWED_MIME_TYPES.includes(mimeType) || CONFIG.ALLOWED_MIME_PREFIXES.some(prefix => mimeType.startsWith(prefix));
}

function requireText_(value, label) {
  if (!String(value || '').trim()) throw new Error(`${label} is required.`);
}

function requireEmail_(value) {
  const email = String(value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid email address is required.');
}

function sanitiseName_(value) {
  return String(value || '').replace(/[\\/:*?"<>|#%{}~]/g, '-').replace(/\s+/g, ' ').trim();
}

function sanitiseFileName_(value) {
  return sanitiseName_(value).replace(/^\.+/, '').slice(0, 180) || `file-${Date.now()}`;
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function buildReadableBrief_(p) {
  const yesNo = v => v ? 'Yes' : 'No';
  const arr = v => Array.isArray(v) ? v.join(', ') : (v || '');
  const section = (title, lines) => `\n\n=== ${title.toUpperCase()} ===\n${lines.filter(Boolean).join('\n')}`;
  return [
    'HOSP OLP WEBSITE BRIEF',
    `Submitted: ${new Date().toLocaleString('en-GB')}`,
    section('Business', [
      `Business name: ${p.businessName || ''}`,
      `Business type: ${p.businessType || ''}`,
      `Address: ${p.address || ''}`,
      `Phone: ${p.phone || ''}`,
      `Public email: ${p.publicEmail || ''}`,
      `Existing website/domain: ${p.existingWebsite || ''}`
    ]),
    section('Contact', [
      `Completed by: ${p.contactName || ''}`,
      `Contact email: ${p.contactEmail || ''}`,
      `Contact phone: ${p.contactPhone || ''}`
    ]),
    section('Business description', [
      `Description: ${p.businessDescription || ''}`,
      `Most important message: ${p.importantMessage || ''}`,
      `Known for: ${p.knownFor || ''}`,
      `Atmosphere: ${arr(p.atmosphere)}`
    ]),
    section('Opening hours', [JSON.stringify(p.openingHours || {}, null, 2), p.hoursNotes ? `Notes: ${p.hoursNotes}` : '']),
    section('Food', [
      `Serves food: ${yesNo(p.servesFood)}`,
      `Food hours: ${p.foodHours || ''}`,
      `Menus: ${arr(p.menuTypes)}`,
      `Food notes: ${p.foodNotes || ''}`
    ]),
    section('Drinks', [`Featured drinks: ${arr(p.drinkTypes)}`, `Specific products: ${p.drinkDetails || ''}`]),
    section('Events', [`Regular events: ${p.events || ''}`]),
    section('Facilities', [`Facilities: ${arr(p.facilities)}`, `Other: ${p.facilityNotes || ''}`]),
    section('Bookings', [`Takes bookings: ${yesNo(p.takesBookings)}`, `Booking method: ${arr(p.bookingMethods)}`, `Booking link/details: ${p.bookingDetails || ''}`]),
    section('Social media', [
      `Facebook: ${p.facebook || ''}`,
      `Instagram: ${p.instagram || ''}`,
      `TikTok: ${p.tiktok || ''}`,
      `Other: ${p.otherSocial || ''}`
    ]),
    section('Branding & design', [
      `Brand colours: ${p.brandColours || ''}`,
      `Typeface: ${p.typeface || ''}`,
      `Website feel: ${arr(p.websiteFeel)}`,
      `Colours to avoid: ${p.coloursAvoid || ''}`,
      `Reference websites: ${p.referenceWebsites || ''}`
    ]),
    section('Reviews', [`Reviews/testimonials: ${p.reviews || ''}`]),
    section('Do not advertise', [`${p.doNotAdvertise || ''}`]),
    section('Anything else', [`${p.anythingElse || ''}`]),
    section('Primary goal', [`Main visitor action: ${p.primaryAction || ''}`, `Most important thing to know: ${p.primaryMessage || ''}`]),
    section('Permissions', [`Permission to use supplied assets: ${yesNo(p.assetPermission)}`])
  ].join('');
}
