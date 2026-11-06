'use strict';const menu=document.querySelector('.menu-button');const navEl=document.getElementById('primary-nav');if(menu&&navEl){const close=()=>{navEl.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open menu')};menu.addEventListener('click',()=>{const shown=navEl.classList.toggle('open');menu.setAttribute('aria-expanded',String(shown));menu.setAttribute('aria-label',shown?'Close menu':'Open menu')});navEl.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!navEl.contains(e.target))close()})}document.querySelectorAll('[data-year]').forEach(e=>e.textContent=new Date().getFullYear());
/* Accessible menu switching */
(function(){
 const tabs=[...document.querySelectorAll('[data-menu-tab]')];
 if(!tabs.length)return;
 const activate=(id,updateHash=false)=>{
   tabs.forEach(tab=>{
     const on=tab.dataset.menuTab===id;
     tab.setAttribute('aria-selected',String(on));
     tab.tabIndex=on?0:-1;
     const panel=document.getElementById(tab.dataset.menuTab);
     if(panel)panel.hidden=!on;
   });
   if(updateHash && history.replaceState)history.replaceState(null,'','#'+id);
 };
 tabs.forEach((tab,index)=>{
   tab.addEventListener('click',()=>activate(tab.dataset.menuTab,true));
   tab.addEventListener('keydown',e=>{
     if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
     e.preventDefault();
     const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
     tabs[next].focus();activate(tabs[next].dataset.menuTab,true);
   });
 });
 const hash=window.location.hash.slice(1);
 if(hash==='festive-menu'||hash==='sunday-menu'||hash==='main-menu')activate(hash);
 window.addEventListener('hashchange',()=>{const id=window.location.hash.slice(1);if(tabs.some(t=>t.dataset.menuTab===id))activate(id)});
})();