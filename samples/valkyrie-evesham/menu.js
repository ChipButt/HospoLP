'use strict';
(function(){
  const button=document.querySelector('.menu-button');
  const nav=document.getElementById('primary-nav');
  if(button && nav){
    const close=()=>{
      nav.classList.remove('open');
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-label','Open menu');
      document.body.classList.remove('menu-open');
    };
    button.addEventListener('click',()=>{
      const opening=!nav.classList.contains('open');
      nav.classList.toggle('open',opening);
      button.setAttribute('aria-expanded',String(opening));
      button.setAttribute('aria-label',opening?'Close menu':'Open menu');
      document.body.classList.toggle('menu-open',opening);
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('click',e=>{if(nav.classList.contains('open')&&!button.contains(e.target)&&!nav.contains(e.target))close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    window.addEventListener('resize',()=>{if(window.innerWidth>820)close()});
  }
  const items=[...document.querySelectorAll('.event-entry[data-date]')];
  if(items.length){
    const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
    let upcoming=0;
    items.forEach(item=>{if(item.dataset.date<today)item.remove();else upcoming++});
    const empty=document.querySelector('.events-empty');
    if(empty)empty.hidden=upcoming>0;
  }
})();
