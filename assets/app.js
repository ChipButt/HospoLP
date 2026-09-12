const files={site:'content/site.json',hours:'content/hours.json',drinks:'content/drinks.json',menu:'content/menu.json',events:'content/events.json',features:'content/features.json',gallery:'content/gallery.json',theme:'content/theme.json'};
const load=async p=>{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw new Error(`${p}: ${r.status}`);return r.json()};
const txt=(selector,value)=>document.querySelectorAll(selector).forEach(el=>el.textContent=value??'');
const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function renderSite(s){
  Object.entries(s).forEach(([k,v])=>typeof v==='string'&&txt(`[data-site="${k}"]`,v));
  document.title=s.seoTitle||s.name;
  const description=document.querySelector('meta[name="description"]'); if(description&&s.seoDescription)description.content=s.seoDescription;
  const ogTitle=document.querySelector('meta[property="og:title"]'); if(ogTitle)ogTitle.content=s.seoTitle||s.name;
  const ogDescription=document.querySelector('meta[property="og:description"]'); if(ogDescription)ogDescription.content=s.seoDescription||s.shortWelcome||'';
  document.querySelectorAll('[data-link]').forEach(el=>{const value=s[el.dataset.link];if(value){el.href=value;el.hidden=false}});
  const phone=`tel:${String(s.phone||'').replace(/[^+\d]/g,'')}`;
  document.querySelector('[data-phone-link]')?.setAttribute('href',phone);
  document.querySelector('[data-mobile-phone]')?.setAttribute('href',phone);
  if(s.email)document.querySelector('[data-email-link]')?.setAttribute('href',`mailto:${s.email}`);
  const facts=document.querySelector('[data-facts]'); if(facts)facts.innerHTML=(s.facts||[]).map(x=>`<span>${esc(x)}</span>`).join('');
  const map=document.querySelector('[data-map-frame]'); if(map&&s.mapEmbedQuery)map.src=`https://www.google.com/maps?q=${encodeURIComponent(s.mapEmbedQuery)}&output=embed`;
  const notice=document.querySelector('[data-notice-section]'); if(notice){notice.hidden=!s.notice?.enabled;if(s.notice?.enabled){txt('[data-notice-title]',s.notice.title);txt('[data-notice-text]',s.notice.text)}}
  const schema={"@context":"https://schema.org","@type":"BarOrPub",name:s.name,description:s.seoDescription||s.shortWelcome,address:{"@type":"PostalAddress",streetAddress:s.address},telephone:s.phone,email:s.email,sameAs:[s.facebook].filter(Boolean)};
  document.querySelector('#business-schema').textContent=JSON.stringify(schema);
}

const mins=t=>{const [h,m]=String(t||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null};
function renderHours(data){
  const grid=document.querySelector('[data-hours-grid]');
  if(grid)grid.innerHTML=data.hours.map(x=>`<div class="hours-row"><strong>${esc(x.day)}</strong><span>${esc(x.closed?'Closed':x.display)}</span></div>`).join('');
  const now=new Date(),day=now.toLocaleDateString('en-GB',{weekday:'long'}),row=data.hours.find(h=>h.day===day);
  if(!row){txt('[data-today-status]','See opening hours');return}
  if(row.closed){txt('[data-today-status]','Closed today');txt('[data-today-hours]','');return}
  const current=now.getHours()*60+now.getMinutes(),open=mins(row.opens),close=mins(row.closes);
  const isOpen=open!==null&&close!==null&&(close>open?current>=open&&current<close:current>=open||current<close);
  txt('[data-today-status]',isOpen?'Open now':'Closed now');
  txt('[data-today-hours]',row.display);
}
function renderDrinks(d){const section=document.querySelector('[data-drinks-section]');if(!d.enabled){if(section)section.hidden=true;return}if(section)section.hidden=false;txt('[data-drinks="heading"]',d.heading);txt('[data-drinks="intro"]',d.intro);document.querySelector('[data-drink-grid]').innerHTML=(d.items||[]).map(x=>`<article class="card"><small>${esc(x.category)}</small><h3>${esc(x.name)}</h3><p>${esc(x.style)}</p>${x.abv?`<strong>${esc(x.abv)}</strong>`:''}</article>`).join('')}
function renderMenu(d){const section=document.querySelector('[data-food-section]'),nav=document.querySelector('[data-nav-food]');if(!d.enabled){if(section)section.hidden=true;if(nav)nav.hidden=true;return}section.hidden=false;nav.hidden=false;txt('[data-food="heading"]',d.heading);txt('[data-food="intro"]',d.intro);document.querySelector('[data-menu-sections]').innerHTML=(d.sections||[]).map(s=>`<div class="menu-block"><h3>${esc(s.name)}</h3>${(s.items||[]).filter(i=>i.available).map(i=>`<div class="menu-item"><div><strong>${esc(i.name)}</strong><p>${esc(i.description)}</p></div><b>${esc(i.price)}</b></div>`).join('')}</div>`).join('')}
function renderEvents(d){txt('[data-events="intro"]',d.intro);document.querySelector('[data-event-grid]').innerHTML=(d.items||[]).filter(x=>x.enabled).map(x=>`<article class="card"><small>${esc(x.when)}</small><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p></article>`).join('')}
function renderFeatures(d){document.querySelector('[data-feature-strip]').innerHTML=(d.items||[]).filter(x=>x.enabled).map(x=>`<span>${esc(x.label)}</span>`).join('')}
function renderGallery(d){const section=document.querySelector('[data-gallery-section]');if(!d.enabled||!(d.items||[]).length){section.hidden=true;return}section.hidden=false;document.querySelector('[data-gallery-grid]').innerHTML=d.items.map((x,i)=>`<button class="gallery-item" type="button" data-gallery-index="${i}" aria-label="View ${esc(x.alt)}"><img src="${esc(x.image)}" alt="${esc(x.alt)}" loading="lazy"></button>`).join('');document.querySelector('[data-gallery-grid]').onclick=e=>{const button=e.target.closest('[data-gallery-index]');if(!button)return;const item=d.items[Number(button.dataset.galleryIndex)];openLightbox(item)}}
function theme(t){Object.entries({primary:t.primary,'primary-2':t.primaryDark,accent:t.accent,alert:t.alert,paper:t.paper,'paper-deep':t.paperDeep,surface:t.surface,ink:t.ink}).forEach(([k,v])=>v&&document.documentElement.style.setProperty(`--${k}`,v))}
function openLightbox(item){const dialog=document.querySelector('[data-lightbox]'),img=document.querySelector('[data-lightbox-image]');if(!dialog||!img)return;img.src=item.image;img.alt=item.alt||'';dialog.showModal()}
document.querySelector('[data-lightbox-close]')?.addEventListener('click',()=>document.querySelector('[data-lightbox]')?.close());
document.querySelector('[data-lightbox]')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});

Promise.all(Object.values(files).map(load)).then(([s,h,d,m,e,f,g,t])=>{renderSite(s);renderHours(h);renderDrinks(d);renderMenu(m);renderEvents(e);renderFeatures(f);renderGallery(g);theme(t);txt('[data-current-year]',new Date().getFullYear())}).catch(err=>{console.error(err);document.querySelector('[data-load-error]').hidden=false;txt('[data-current-year]',new Date().getFullYear())});
const toggle=document.querySelector('.nav-toggle'),nav=document.querySelector('.primary-nav');toggle?.addEventListener('click',()=>{nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(nav.classList.contains('open')))});nav?.addEventListener('click',e=>{if(e.target.matches('a')){nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false')}});
