(()=>{
const toggle=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav');
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'×':'☰'});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰'}))}
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=String(new Date().getFullYear()));
// Local logo is the final fallback so failed third-party photos never leave blank spaces.
document.querySelectorAll('img[data-photo-fallback]').forEach(img=>{
 const next=(img.dataset.photoFallback||'').split('|').map(s=>s.trim()).filter(Boolean);next.push('logo.svg');
 let index=0;const fail=()=>{if(index<next.length){img.src=next[index++];if(img.src.endsWith('/logo.svg'))img.classList.add('is-fallback')}else{img.removeEventListener('error',fail);img.alt='The Village Cafe'}};img.addEventListener('error',fail)
});
})();