(()=>{
const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'×':'☰'});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰'}))}
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=String(new Date().getFullYear()));
// Local images are the final fallback: never show broken third-party photo boxes.
document.querySelectorAll('img[data-photo-fallback]').forEach(img=>{
 const localPhoto='assets/village-cafe/hero-interior.avif';
 const localBrand='assets/village-cafe/logo.svg';
 const requested=(img.dataset.photoFallback||'').split('|').map(s=>s.trim()).filter(Boolean);
 const candidates=[...new Set([...requested,localPhoto,localBrand])];
 let index=0;
 const fail=()=>{
  while(index<candidates.length){
   const next=candidates[index++];
   if(next===img.getAttribute('src'))continue;
   if(next===localBrand)img.classList.add('is-fallback');
   img.src=next;
   return;
  }
  img.removeEventListener('error',fail);
 };
 img.addEventListener('error',fail);
 if(img.complete&&img.naturalWidth===0)fail();
});
})();