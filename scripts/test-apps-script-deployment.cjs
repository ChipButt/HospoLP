const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {prepareDeploy}=require('./prepare-apps-script-deployment.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'chipin-deploy-test-'));
const files=['Code.js','Index.html','Editor.js','EditorUI.html',
  'ClientOnboarding.js','ClientOnboardingAdmin.html','ClientOnboardingUpload.html'];
for(const name of files){
  fs.writeFileSync(path.join(root,name),name==='Code.js'
    ? "function doGet(e){\n  if (mode === 'onboard-admin') return renderClientOnboardingAdmin_(e);\n  if (mode === 'onboard-upload') return renderClientOnboardingUpload_(e);\n  return renderEditor_(e);}"
    : 'old live source that must be preserved: '+name);
}
const originalEditor=fs.readFileSync(path.join(root,'Editor.js'),'utf8');
const originalCode=fs.readFileSync(path.join(root,'Code.js'),'utf8');
fs.writeFileSync(path.join(root,'appsscript.json'),JSON.stringify({
 timeZone:'Europe/London',
 runtimeVersion:'V8',
 oauthScopes:['https://www.googleapis.com/auth/script.send_mail']
}));
try{
  prepareDeploy(root);
  assert.notEqual(fs.readFileSync(path.join(root,'Editor.js'),'utf8'),originalEditor);
  assert.match(fs.readFileSync(path.join(root,'Editor.js'),'utf8'),/clientOnboardingRequireAdmin_\(ownerSession\)/);
  assert.equal(fs.readFileSync(path.join(root,'Code.js'),'utf8'),originalCode.replace("  if (mode === 'onboard-upload') return renderClientOnboardingUpload_(e);", "  if (mode === 'onboard-upload') return renderClientOnboardingUpload_(e);\n  if (mode === 'website-review') return renderClientWebsiteReview_(e);"));
  for(const [src,dst] of [
    ['ClientOnboarding.gs','ClientOnboarding.js'],
    ['ClientOnboardingUpload.html','ClientOnboardingUpload.html'],
    ['ClientOnboardingAdmin.html','ClientOnboardingAdmin.html'],
    ['ClientReviewService.gs','ClientReviewService.js'],
    ['ClientWebsiteReview.html','ClientWebsiteReview.html'],
    ['ClientHandover.gs','ClientHandover.js'],
    ['Editor.gs','Editor.js'],
    ['EditorUI.html','EditorUI.html']
  ]){
    assert.equal(
      fs.readFileSync(path.join(root,dst),'utf8'),
      fs.readFileSync(path.join(__dirname,'../apps-script',src),'utf8')
    );
  }
  const m=JSON.parse(fs.readFileSync(path.join(root,'appsscript.json'),'utf8'));
  assert.equal(m.runtimeVersion,'V8');
  assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/script.send_mail'));
  assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/drive'));
  assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/script.external_request'));
  prepareDeploy(root); // rerunning against an already upgraded 11-file live project remains safe
  assert.equal((fs.readFileSync(path.join(root,'Code.js'),'utf8').match(/website-review/g)||[]).length,1);
  fs.writeFileSync(path.join(root,'Mystery.js'),'unknown source');
  assert.throws(()=>prepareDeploy(root),/Unexpected files/);
  fs.unlinkSync(path.join(root,'Mystery.js'));
  fs.writeFileSync(path.join(root,'ClientWebsiteReview.js'),'duplicate basename');
  assert.throws(()=>prepareDeploy(root),/Duplicate Apps Script basenames/);
  fs.unlinkSync(path.join(root,'ClientWebsiteReview.js'));
  fs.unlinkSync(path.join(root,'EditorUI.html'));
  assert.throws(()=>prepareDeploy(root),/missing required files/);
  console.log('PASS: 8→11-file Apps Script upgrade protects editor password reset, preserves existing intake routes, appends one review route, preserves manifest, supports reruns, blocks unknown files.');
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}
