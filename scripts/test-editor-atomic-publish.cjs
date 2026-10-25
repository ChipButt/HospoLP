'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const source=fs.readFileSync('apps-script/Editor.gs','utf8');
const context=vm.createContext({console});
new vm.Script(source,{filename:'Editor.gs'}).runInContext(context);
function render(html,page,logo){
  context.inputHtml=html;context.inputPage=page;context.inputLogo=logo;
  return vm.runInContext("renderBullsHeadHtml_(inputHtml,inputPage,'drinks',inputLogo)",context);
}
const markup='<h1 class="display" data-chipin-text="t02">Keep it simple. Pour it well.</h1>'+
  '<p data-chipin-text="t03">Old &amp; stale</p>'+
  '<img src="old.png" alt="bar" data-chipin-image="img01">';
const result=render(markup,{t02:'Replacement <heading>',t03:'',img01:'images/new-bar.jpg'});
assert.match(result,/>Replacement &lt;heading&gt;<\/h1>/);
assert.match(result,/<p data-chipin-text="t03"><\/p>/);
assert.doesNotMatch(result,/Old &amp; stale|Keep it simple\. Pour it well\./);
assert.match(result,/src="images\/new-bar.jpg"/);
assert.throws(()=>render(markup,{t99:'No matching marker'}),/marker missing or duplicated/);
assert.throws(()=>render('<p data-chipin-text="t02"><em>Markup<\/em><\/p>',{t02:'Replacement'}),/Complex HTML requires review/);

const mockFiles={
  'content/site.json':'{"site":"before"}',
  'drinks.html':markup
};
const actions=[];let blobNumber=0;
context.mockSite={site_id:'bulls-head-bidford',repo_full_name:'ChipButt/TheBullsHeadBidford'};
context.mockCleaned={site:{editorPages:{drinks:{t02:'A clean replacement',t03:'',img01:'images/new-bar.jpg'}}}};
context.githubReadText_=(site,path,ref)=>{
  assert.equal(ref,'head-before');
  if (!(path in mockFiles)) throw Error('Unexpected file read '+path);
  return mockFiles[path];
};
context.githubGitRequest_=(site,path,method,payload)=>{
  actions.push({path,method,payload});
  if(path==='/git/ref/heads/main') return {object:{sha:'head-before'}};
  if(path==='/git/commits/head-before') return {tree:{sha:'tree-before'}};
  if(path==='/git/blobs') return {sha:'blob-'+(++blobNumber)};
  if(path==='/git/trees') return {sha:'new-tree'};
  if(path==='/git/commits') return {sha:'new-head'};
  if(path==='/git/refs/heads/main') return {object:{sha:'new-head'}};
  throw Error('Unexpected Git request: '+method+' '+path);
};
const published=vm.runInContext('publishBullsHeadAtomically_(mockSite,"content",mockCleaned)',context);
assert.equal(published.commitSha,'new-head');
assert.equal(actions.filter(x=>x.path==='/git/commits'&&x.method==='post').length,1);
assert.equal(actions.filter(x=>x.path==='/git/refs/heads/main'&&x.method==='patch').length,1);
const tree=actions.find(x=>x.path==='/git/trees').payload;
assert.equal(tree.base_tree,'tree-before');
assert.deepEqual(Array.from(tree.tree,x=>x.path).sort(),['content/site.json','drinks.html']);
const blobs=actions.filter(x=>x.path==='/git/blobs').map(x=>x.payload.content);
assert.ok(blobs.some(x=>x.includes('A clean replacement')&&!x.includes('Keep it simple. Pour it well.')));
assert.equal(actions.at(-1).payload.force,false);

// No file is published if rendering fails: all reads and marker checks happen
// before any PATCH updates the main branch.
actions.length=0;
context.mockCleaned.site.editorPages.drinks.t99='Unknown';
assert.throws(()=>vm.runInContext('publishBullsHeadAtomically_(mockSite,"content",mockCleaned)',context),/marker missing or duplicated/);
assert.equal(actions.some(x=>x.path==='/git/refs/heads/main'),false);
console.log('Bull\'s Head atomic editor publishing tests passed.');
