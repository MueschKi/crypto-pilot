/* EIERALARM LCD – independent, hand-drawn scalable vector art, v1.3.
   The geometry is inspired by the 1980s four-chute egg-catching genre;
   no sprites, copyrighted character outlines, or scans are reused. */
(()=>{
'use strict';
const svgNS='http://www.w3.org/2000/svg';
const svg=document.querySelector('#handheld svg');
const scene=document.getElementById('lcd-scene');
const houses=document.getElementById('houses');
const wolf=document.getElementById('wolf');
const hare=document.getElementById('hare');
if(!svg||!scene||!houses||!wolf||!hare)return;

// Corner enclosures and game LCD occupy the same proportions as a handheld,
// but the houses, animals and brand lettering are entirely original artwork.
const henHouse=(id,x,y,mirror=false)=>`<g id="hen-${id}" transform="translate(${x} ${y}) scale(${mirror?-1:1} 1)">
  <path d="M-34 30 V-23 L0 -48 L34 -23 V30 M-39 -23 L0 -54 L39 -23" stroke="#465448" stroke-width="5" fill="none"/>
  <path d="M-28 29 V-15 M28 29 V-15 M-27 22 H27" stroke="#465448" stroke-width="3" fill="none"/>
  <g fill="#26392f" stroke="#26392f" stroke-linejoin="round">
    <path d="M-29 9 Q-37 -2 -32 -18 L-20 -11 L-23 -24 L-9 -13 Q3 -20 15 -10 Q24 -7 25 4 Q27 18 10 21 L-8 21 Q-25 20 -29 9Z"/>
    <path d="M14 -10 L12 -22 L19 -18 L22 -26 L28 -18 L27 -8Z"/>
    <path d="M23 -4 L39 2 L23 8Z"/>
    <path d="M-9 18 L-11 28 M4 18 L5 28 M-18 29 H-5 M-2 29 H12" stroke-width="3" fill="none"/>
  </g>
  <path d="M-15 3 Q-9 -3 1 -2 Q9 1 8 11 Q-4 17 -15 3Z" fill="#c0c9b9"/>
  <circle cx="17" cy="-5" r="2.5" fill="#c0c9b9"/>
</g>`;
houses.innerHTML=[
  henHouse('tl',225,189,false),
  henHouse('bl',225,344,false),
  henHouse('tr',860,189,true),
  henHouse('br',860,344,true)
].join('');

// Remove old oversized rails. Keep the four distinct LCD rolling lanes and
// drop-target positions unchanged to avoid desynchronising the rules engine.
for(const child of [...scene.children]){
  if(child.tagName.toLowerCase()==='g'&&!child.id)child.remove();
}
const tracks=document.createElementNS(svgNS,'g');tracks.id='lcd-art-tracks';
tracks.innerHTML=`
<!-- Four separate diagonal trays and their support posts, as on the LCD reference -->
<g fill="none" stroke-linecap="square" stroke-linejoin="miter">
 <path d="M272 223 L459 293 M811 223 L622 293 M272 363 L459 402 M811 363 L622 402" stroke="#88623b" stroke-width="7"/>
 <path d="M272 229 L459 299 M811 229 L622 299 M272 369 L459 408 M811 369 L622 408" stroke="#26392f" stroke-width="2.4"/>
 <path d="M294 238 V273 M785 238 V273 M314 373 V411 M765 373 V411" stroke="#88623b" stroke-width="6"/>
 <path d="M284 378 V403 M800 378 V403" stroke="#88623b" stroke-width="4"/>
</g>
<!-- Discrete, empty LCD rolling positions; live eggs are drawn on top -->
<g fill="#bac7b7" stroke="#26392f" stroke-width="3.5">
 <ellipse cx="310" cy="232" rx="11" ry="8" transform="rotate(-23 310 232)"/>
 <ellipse cx="346" cy="246" rx="11" ry="8" transform="rotate(-23 346 246)"/>
 <ellipse cx="383" cy="261" rx="11" ry="8" transform="rotate(-23 383 261)"/>
 <ellipse cx="421" cy="276" rx="11" ry="8" transform="rotate(-23 421 276)"/>
 <ellipse cx="773" cy="232" rx="11" ry="8" transform="rotate(23 773 232)"/>
 <ellipse cx="737" cy="246" rx="11" ry="8" transform="rotate(23 737 246)"/>
 <ellipse cx="700" cy="261" rx="11" ry="8" transform="rotate(23 700 261)"/>
 <ellipse cx="662" cy="276" rx="11" ry="8" transform="rotate(23 662 276)"/>
 <ellipse cx="310" cy="370" rx="11" ry="8" transform="rotate(-18 310 370)"/>
 <ellipse cx="348" cy="378" rx="11" ry="8" transform="rotate(-18 348 378)"/>
 <ellipse cx="386" cy="386" rx="11" ry="8" transform="rotate(-18 386 386)"/>
 <ellipse cx="423" cy="394" rx="11" ry="8" transform="rotate(-18 423 394)"/>
 <ellipse cx="773" cy="370" rx="11" ry="8" transform="rotate(18 773 370)"/>
 <ellipse cx="735" cy="378" rx="11" ry="8" transform="rotate(18 735 378)"/>
 <ellipse cx="697" cy="386" rx="11" ry="8" transform="rotate(18 697 386)"/>
 <ellipse cx="660" cy="394" rx="11" ry="8" transform="rotate(18 660 394)"/>
</g>
<!-- Sparse LCD shrubs and ground, no painted scenery -->
<g fill="#314b24">
 <path d="M202 414 l12 -12 12 6 13 -9 10 9 14 -4 10 13 -4 8 -67 0Z"/>
 <path d="M279 432 l9 -12 10 5 13 -8 13 10 14 -5 10 12 -69 3Z"/>
 <path d="M381 430 l12 -8 10 6 14 -10 13 10 18 -5 10 10 -77 3Z"/>
 <path d="M638 431 l10 -10 13 7 12 -9 12 9 17 -6 12 12 -76 2Z"/>
 <path d="M751 429 l10 -10 12 8 12 -11 12 10 17 -7 11 13 -74 2Z"/>
 <path d="M817 413 l10 -10 12 7 13 -10 12 9 12 -5 13 12 -72 4Z"/>
 <path d="M814 151 l16 -8 15 5 10 -10 17 8 13 -6 10 11 -10 9 -71 0Z"/>
</g>
<g fill="#26392f">
 <path d="M235 424 l-4 -12 7 5 4 -11 5 11 8 -5 -5 12Z"/>
 <path d="M836 424 l-4 -12 7 5 4 -11 5 11 8 -5 -5 12Z"/>
</g>`
scene.insertBefore(tracks,hare);

// Long-eared rabbit with a head, paws, feet and a hand bell, not a generic
// shadow silhouette. Its opacity remains driven by the original rules engine.
hare.setAttribute('transform','translate(305 185)');
hare.innerHTML=`
 <g fill="#26392f" stroke="#26392f" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
  <path d="M-20 -26 Q-31 -53 -29 -70 Q-25 -79 -17 -70 L-8 -42 Q-10 -72 -3 -83 Q4 -89 8 -77 L10 -42 Q28 -38 31 -18 Q38 2 22 15 L12 23 Q1 33 -14 24 Q-30 15 -28 -3 Q-27 -16 -20 -26Z"/>
  <path d="M-22 11 Q-42 12 -46 27 L-22 25 L-8 19 M6 21 Q24 29 29 38 L9 37 L-5 28"/>
  <path d="M23 -6 L37 0 L22 7Z"/>
  <path d="M-7 23 L-3 36 L16 39 M-22 17 L-29 30 L-13 34" fill="none" stroke-width="6"/>
 </g>
 <path d="M-22 -59 L-18 -43 M0 -68 L2 -45" stroke="#c0c9b9" stroke-width="3" fill="none"/>
 <ellipse cx="12" cy="-16" rx="8" ry="10" fill="#c0c9b9"/>
 <circle cx="15" cy="-17" r="3.4" fill="#26392f"/>
 <path d="M17 7 Q23 12 29 5" stroke="#c0c9b9" stroke-width="2" fill="none"/>
 <g id="rabbitBell" transform="translate(48 5)" fill="#26392f" stroke="#26392f" stroke-width="2">
  <path d="M-11 0 Q-14 -20 0 -21 Q14 -20 11 0 L17 7 H-17Z"/>
  <circle cx="0" cy="11" r="4"/>
 </g>`;

// Keep original element IDs required by the core script; hide those originals
// while rendering a clean, compact wolf silhouette with its own basket/arm.
const prior=wolf.innerHTML;
wolf.innerHTML=`<g display="none">${prior}</g>
<g transform="translate(540 365)" id="artWolf" fill="#26392f" stroke="#26392f" stroke-linecap="round" stroke-linejoin="round">
 <path d="M25 22 Q58 10 72 -21 Q68 10 54 30 L38 41Z"/>
 <path d="M-25 39 Q-36 61 -48 90 L-69 107 L-42 114 L-7 76 L8 53Z"/>
 <path d="M9 47 Q29 70 24 88 L47 113 L72 110 L46 76 L41 39Z"/>
 <path d="M-34 -24 Q0 -43 31 -20 L40 42 Q7 60 -33 43Z"/>
 <path d="M-31 -85 L-34 -141 L-8 -112 L14 -146 L28 -98 Q48 -81 35 -52 Q12 -30 -22 -48Z"/>
 <path d="M-27 -72 Q-50 -70 -64 -55 L-87 -51 Q-99 -44 -85 -35 Q-57 -30 -32 -44 L-14 -54Z"/>
 <path d="M-39 -39 Q-55 -26 -73 -34" fill="none" stroke-width="4"/>
 <path d="M25 -18 Q50 -8 48 20" fill="none" stroke-width="14"/>
 <path id="artArm" d="M-25 -17 Q-45 -19 -59 -41" fill="none" stroke-width="15"/>
 <path id="artArmInside" d="M-25 -17 Q-45 -19 -59 -41" fill="none" stroke="#26392f" stroke-width="8"/>
 <g id="artBasket" transform="translate(-70 -45)">
  <path d="M-27 -8 H27 L18 24 Q0 32 -18 24Z"/>
  <path d="M-26 -8 Q-22 -31 0 -31 Q22 -31 26 -8" fill="none" stroke-width="4"/>
  <path d="M-16 0 L-9 24 M0 0 V27 M16 0 L9 24 M-21 10 H21" fill="none" stroke="#c0c9b9" stroke-width="2.5"/>
 </g>
 <path d="M-20 -125 L-19 -113 M13 -129 L17 -110" fill="none" stroke="#c0c9b9" stroke-width="3"/>
 <ellipse cx="-1" cy="-70" rx="9" ry="13" fill="#c0c9b9"/>
 <ellipse cx="22" cy="-69" rx="8" ry="12" fill="#c0c9b9"/>
 <circle cx="-3" cy="-69" r="3.5"/><circle cx="20" cy="-68" r="3.5"/>
 <ellipse cx="-86" cy="-48" rx="7" ry="5"/>
 <path d="M-30 -47 Q-17 -38 -9 -48" fill="none" stroke="#c0c9b9" stroke-width="2"/>
</g>`;

const styled=document.createElement('style');styled.id='art-v13-style';styled.textContent=`
  #handheld .topbar{display:none}
  #handheld #start:not([hidden]){display:block} #handheld #start[hidden]{display:none} #handheld #message:not(:empty){display:block} #handheld #message:empty{display:none}
  .face-button{color:transparent!important;text-shadow:none!important}
  #handheld>svg [aria-label]{font-family:system-ui}
  #handheld .micro-button{background:linear-gradient(#d3d4cf,#989e9c 50%,#565d5e);border-color:#6d7270}
  #handheld .micro-button.active{outline:1.5px solid #8e5751;outline-offset:2px}
  #handheld .face-button{background:radial-gradient(circle at 34% 24%,#e56a65 0%,#ba3133 40%,#7f2025 78%,#491619 100%)}
`;
document.head.appendChild(styled);

// The original was a modestly squared-off plastic console, not a pill-shaped arcade panel.
const rects=[...svg.querySelectorAll('rect')];
for(const r of rects){if(r.getAttribute('x')==='4'&&r.getAttribute('width')==='1072')r.setAttribute('rx','18');
else if(r.getAttribute('x')==='12'&&r.getAttribute('width')==='1056')r.setAttribute('rx','14');
else if(r.getAttribute('x')==='166'&&r.getAttribute('width')==='755')r.setAttribute('rx','9');
else if(r.getAttribute('x')==='178'&&r.getAttribute('width')==='729')r.setAttribute('rx','6');}
for(const t of svg.querySelectorAll('text[x="947"]')){t.setAttribute('x','1010');t.setAttribute('font-size','12');}
const logo=document.createElementNS(svgNS,'g'); logo.setAttribute('id','egg-brand');
logo.innerHTML='<ellipse cx="73" cy="73" rx="19" ry="26" fill="none" stroke="#575f58" stroke-width="4"/><path d="M62 79 q12 19 24 0" fill="none" stroke="#575f58" stroke-width="3"/><text x="108" y="79" font-size="15" fill="#575f58" font-weight="bold" letter-spacing="1">EI</text>';
svg.appendChild(logo);

const score=document.getElementById('lcdScore');
if(score){score.setAttribute('x','715');score.setAttribute('y','177');score.setAttribute('font-size','48');}
const modeText=document.getElementById('lcdMode');
if(modeText){modeText.setAttribute('x','212');modeText.setAttribute('y','437');modeText.setAttribute('text-anchor','start');modeText.setAttribute('font-size','14');}
for(const t of svg.querySelectorAll('text')){
 if(t.getAttribute('x')==='685'&&t.textContent==='PUNKTE')t.textContent='';
}
const label=(x,y,string)=>[...svg.querySelectorAll('text')].find(el=>el.getAttribute('x')===String(x)&&el.getAttribute('y')===String(y))?.replaceChildren(document.createTextNode(string));
label(545,84,'EIERALARM · LCD');label(545,505,'EIERSPIEL · RETRO');label(47,147,'');label(44,325,'');label(969,479,'v1.3');
const heading=[...svg.querySelectorAll('text')].find(el=>el.getAttribute('x')==='545'&&el.getAttribute('y')==='84');
if(heading){heading.setAttribute('font-size','19');heading.setAttribute('letter-spacing','1.2');heading.setAttribute('fill','#575c57');heading.setAttribute('font-weight','700');}
const footer=[...svg.querySelectorAll('text')].find(el=>el.getAttribute('x')==='545'&&el.getAttribute('y')==='505');
if(footer){footer.setAttribute('font-size','17');footer.setAttribute('letter-spacing','2');footer.setAttribute('fill','#636761');}
const oldDraw=window.draw;
if(typeof oldDraw!=='function')return;
window.draw=function(){
  oldDraw();
  const scoreValue=document.getElementById('lcdScore');
  if(game.status==='paused')scoreValue.textContent='PAUSE';
  if(game.status==='ready')document.getElementById('lcdMode').textContent='SPIEL A / B';
  if(game.status==='over')document.getElementById('lcdMode').textContent='ENDE';
  const left=game.lane.endsWith('l'),upper=game.lane.startsWith('t');
  // Four stable LCD frames with matched basket and track coordinates.
  const cx=left?506:574,cy=upper?325:356;
  wolf.setAttribute('transform',`translate(${cx} ${cy}) scale(${left?'.68':'-.68'} .68) translate(-540 -365)`);
  const by=upper?-45:69;
  document.getElementById('artBasket').setAttribute('transform',`translate(-70 ${by})`);
  const arm=upper?'M-27 -19 Q-46 -21 -65 -45':'M-27 -19 Q-54 15 -65 66';
  document.getElementById('artArm').setAttribute('d',arm);
  document.getElementById('artArmInside').setAttribute('d',arm);
  // The originals used discrete, unfilled LCD segments for the rolling eggs.
  const eggs=document.getElementById('eggs');
  for(const egg of eggs.children){
    egg.setAttribute('fill','#aebfab');
    egg.setAttribute('stroke','#23382f');
    egg.setAttribute('stroke-width','3.3');
    egg.setAttribute('rx','8.5');egg.setAttribute('ry','11');
  }
  // Tiny chicks indicate penalty marks like an etched LCD handheld.
  const penalties=document.getElementById('missIcons');penalties.replaceChildren();
  for(let i=0;i<Math.ceil(game.misses);i++){
    if(i===Math.floor(game.misses)&&game.misses%1&&Math.floor(game.elapsed/330)%2)continue;
    const p=document.createElementNS(svgNS,'g');p.setAttribute('transform',`translate(${704+i*34} 425)`);
    p.innerHTML='<path d="M-10 4 Q-16 -10 -7 -14 Q1 -20 9 -11 Q15 -6 11 6 L17 11 L2 11 L-3 14 L-13 12Z" fill="#304939"/><path d="M8 -10 L18 -6 L8 -2" fill="#965c4e"/><circle cx="6" cy="-9" r="2" fill="#b8c7b1"/><path d="M-3 13 L-6 20 m9 -7 v7 m-15 1 h9 m-3 0 h9" stroke="#2d4537" stroke-width="2" fill="none"/>';
    penalties.appendChild(p);
  }
  if(game.misses%1!==0)penalties.setAttribute('aria-label','Ein halber Fehler blinkt');
  // A hatchling appears only during a rabbit-assisted missed catch.
  if(game.chickUntil>game.elapsed&&game.chickLane){const end=lanes[game.chickLane].end;
    const c=document.createElementNS(svgNS,'g');c.setAttribute('transform',`translate(${end[0]} ${end[1]+27})`);
    c.innerHTML='<path d="M-13 3 q-5 -16 5 -22 q13 -6 19 9 q5 10 -1 16 l10 4 -10 4 -3 8 -7 -7 -11 1 Z" fill="#3e5b47"/><path d="M9 -8 l12 4 -11 5" fill="#965b4c"/><circle cx="4" cy="-10" r="2" fill="#d8dfca"/><path d="M-4 19 l-3 8 m9 -8 v8" stroke="#273d32" stroke-width="2"/>';
    penalties.appendChild(c);
  }
  const bell=document.getElementById('rabbitBell');
  if(bell)bell.setAttribute('transform',`translate(48 5) rotate(${game.hareVisible&&Math.floor(game.elapsed/260)%2?-10:9} 0 -20)`);
};
window.draw();
})();