#!/usr/bin/env node
'use strict';

/**
 * Prepare a complete, freshly cloned live Apps Script project for deployment.
 * clasp push replaces every remote file; NEVER push only the three changed
 * files. Read the current live project first to preserve all existing modes.
 */
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const UPDATED_FILES=[
  ['apps-script/ClientOnboarding.gs','ClientOnboarding.js'],
  ['apps-script/ClientOnboardingAdmin.html','ClientOnboardingAdmin.html'],
  ['apps-script/ClientOnboardingUpload.html','ClientOnboardingUpload.html'],
  ['apps-script/ClientReviewService.gs','ClientReviewService.js'],
  ['apps-script/ClientWebsiteReview.html','ClientWebsiteReview.html']
];
const EXPECTED=[
  'appsscript.json','Code.js','Index.html','Editor.js','EditorUI.html',
  'ClientOnboarding.js','ClientOnboardingAdmin.html','ClientOnboardingUpload.html'
];
const NEW_FILES=['ClientReviewService.js','ClientWebsiteReview.html'];
const NEEDED_OAUTH_SCOPES=[
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/script.external_request'
];

function prepareDeploy(projectPath,sourceRoot=ROOT){
  if(!projectPath)throw new Error('Pass path of the freshly cloned Google Apps Script project.');
  const project=path.resolve(projectPath);
  if(project===sourceRoot||project.startsWith(sourceRoot+path.sep))throw new Error('Refusing to prepare inside the GitHub checkout. Use a separate freshly cloned directory.');
  const all=fs.readdirSync(project).filter(n=>n.endsWith('.js')||n.endsWith('.html')||n==='appsscript.json');
  const missing=EXPECTED.filter(n=>!all.includes(n));
  if(missing.length)throw new Error('Live project missing required files; refusing full-project push: '+missing.join(', '));
  const unknown=all.filter(n=>!EXPECTED.includes(n)&&!NEW_FILES.includes(n));
  if(unknown.length)throw new Error('Unexpected files in live project; review manually before overwrite: '+unknown.join(', '));
  // Google Apps Script does not allow script and HTML files sharing a base name.
  const basenames=all.filter(n=>n!=='appsscript.json').map(n=>n.replace(/\.(js|html)$/,''));
  if(new Set(basenames).size!==basenames.length)throw new Error('Duplicate Apps Script basenames would make clasp push fail. Refusing deployment.');
  const reviewPresent=NEW_FILES.filter(n=>all.includes(n));
  if(reviewPresent.length===1)throw new Error('Only one of the two review files is present remotely. Refusing partial deployment.');
  const code=fs.readFileSync(path.join(project,'Code.js'),'utf8');
  if(!/mode\s*===\s*['"]onboard-admin['"]/.test(code)||!/mode\s*===\s*['"]onboard-upload['"]/.test(code)||!/renderEditor_/.test(code))
    throw new Error('Expected existing web-app routing not found in live Code.js; refusing deployment.');
  const reviewRoute="  if (mode === 'website-review') return renderClientWebsiteReview_(e);";
  if(!/mode\s*===\s*['"]website-review['"]/.test(code)){
    // Keep *all* existing code, spacing and doGet modes. Insert immediately after
    // the existing onboarding upload route, whatever the local formatting.
    const uploadLine=/^(\s*if\s*\(\s*mode\s*===\s*['"]onboard-upload['"]\s*\)\s*return\s+renderClientOnboardingUpload_\(e\)\s*;?)[ \t]*$/m;
    let updated=code.replace(uploadLine,(original)=>original+'\n'+reviewRoute);
    if(updated===code){
      // Older live projects sometimes format the upload route differently:
      // safely insert after doGet's first local mode declaration, never a
      // wholesale replacement of Code.js.
      const doGetMode=/(function\s+doGet\s*\(\s*e\s*\)\s*\{[\s\S]*?\bconst\s+mode\s*=[^\n]*;[ \t]*\r?\n)/;
      updated=code.replace(doGetMode,(original)=>original+reviewRoute+'\n');
    }
    if(updated===code)throw new Error('Cannot locate a validated doGet route anchor. Refusing deployment.');
    fs.writeFileSync(path.join(project,'Code.js'),updated,'utf8');
    console.log('Added website-review route without altering existing doGet modes.');
  }
  const manifestPath=path.join(project,'appsscript.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))throw new Error('Invalid Apps Script manifest.');
  if(manifest.oauthScopes!==undefined){
    if(!Array.isArray(manifest.oauthScopes))throw new Error('Manifest oauthScopes is not an array.');
    const before=manifest.oauthScopes.slice();
    for(const scope of NEEDED_OAUTH_SCOPES)if(!manifest.oauthScopes.includes(scope))manifest.oauthScopes.push(scope);
    if(manifest.oauthScopes.length!==before.length){
      fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
      console.log('Added Drive API and/or external_request permissions to the EXISTING manifest without replacing other scopes. The script owner may need to reauthorise those permissions.');
    }
  }else{
    console.log('No explicit OAuth scope list; preserving automatic scope detection.');
  }
  for(const [relative,target] of UPDATED_FILES){
    const original=fs.readFileSync(path.join(sourceRoot,relative),'utf8');
    if(original.length<1000)throw new Error('Source looks unexpectedly short: '+relative);
    fs.writeFileSync(path.join(project,target),original,'utf8');
    console.log('Prepared '+target+' ('+original.length+' characters)');
  }
  console.log('Full-project safeguard passed: existing intake/editor files and manifest preserved; review route and files installed.');
}
if(require.main===module){
  try{prepareDeploy(process.argv[2]);}
  catch(error){console.error('DEPLOY BLOCKED: '+error.message);process.exitCode=1;}
}
module.exports={prepareDeploy};
