import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const site = path.join(root, 'samples/village-cafe-bidford');
const json = JSON.parse(fs.readFileSync(path.join(site,'data/social-posts.json'),'utf8'));
assert.equal(json.schema_version,1);
assert.equal(json.max_posts,5);
assert.ok(Array.isArray(json.posts) && json.posts.length<=5,
  'The feed must never contain more than five visible entries');

const live = json.posts.filter(p=>p.archive!==true);
const historical = json.posts.filter(p=>p.archive===true);
if(live.length) assert.equal(historical.length,0,
  'Dated real updates must not be mixed with historical summaries');
let previous=Number.POSITIVE_INFINITY;
const permalinks=new Set();
for(const post of json.posts){
  assert.ok(['facebook','instagram'].includes(post.source));
  assert.ok(typeof post.text==='string' && post.text.trim().length>0 ||
    typeof post.image==='string' && post.image.trim().length>0);
  assert.ok(typeof post.permalink==='string' && post.permalink.startsWith('https://'));
  assert.ok(!permalinks.has(post.permalink),'Duplicate post');
  permalinks.add(post.permalink);
  if (post.archive!==true) {
    const date=Date.parse(post.published_at);
    assert.ok(Number.isFinite(date), 'Live posts require a real date');
    assert.ok(date<=previous,'Newest posts must come first');
    previous=date;
  }
  if(post.image){
    assert.match(post.image,/^assets\/village-cafe\/[a-zA-Z0-9/._-]+\.(avif|webp)$/);
    assert.ok(fs.existsSync(path.join(site,post.image)), 'Missing image '+post.image);
  }
  if(post.image_context==='archive_illustration') {
    assert.equal(post.archive,true);
  }
}
const renderer=fs.readFileSync(path.join(site,'updates.js'),'utf8');
assert.ok(renderer.includes('MAX_POSTS = 5'));
assert.ok(renderer.includes('window.setInterval(refreshFeed,POLL_MS)'));
assert.ok(!renderer.includes("createElement('a')"));
console.log('Village Café feed validated:', json.posts.length, live.length ? 'live posts' : 'archived posts');
