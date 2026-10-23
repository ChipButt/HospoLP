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
    ? "function doGet(e){if(mode === 'onboard-admin')return renderClientOnboardingAdmin_(e);if(mode === 'onboard-upload')return renderClientOnboardingUpload_(e);return renderEditor_(e)}"
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
  assert.equal(fs.readFileSync(path.join(root,'Editor.js'),'utf8'),originalEditor);
  assert.equal(fs.readFileSync(path.join(root,'Code.js'),'utf8'),originalCode);
  for(const [src,dst] of [
    ['ClientOnboarding.gs','ClientOnboarding.js'],
    ['ClientOnboardingUpload.html','ClientOnboardingUpload.html'],
    ['ClientOnboardingAdmin.html','ClientOnboardingAdmin.html']
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
  fs.writeFileSync(path.join(root,'Mystery.js'),'unknown source');
  assert.throws(()=>prepareDeploy(root),/Unexpected files/);
  fs.unlinkSync(path.join(root,'Mystery.js'));
  fs.unlinkSync(path.join(root,'EditorUI.html'));
  assert.throws(()=>prepareDeploy(root),/missing required files/);
  console.log('PASS: full-project deployment preserves existing HospoLP intake/editor, retains OAuth manifest scopes, replaces only 3 onboarding files, refuses incomplete/unknown clones.');
}finally{
  fs.rmSync(root,{recursive:true,force:true});
}
