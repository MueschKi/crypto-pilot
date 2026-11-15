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
  <path d="M-34 32 V-23 L0 -49 L34 -23 V32" stroke="#8f5149" stroke-width="6" fill="none"/>
  <path d="M-39 -24 L0 -54 L39 -24" stroke="#a15348" stroke-width="7" fill="none"/>
  <path d="M-30 -16 V29 M29 -17 V27" stroke="#894f48" stroke-width="3" fill="none"/>
  <path d="M-27 21 H25" stroke="#314b3f" stroke-width="2.8"/>
  <g transform="translate(-3 5)">
    <!-- high swept tail, thick haunches and double feather marking -->
    <path d="M-25 10 Q-36 -6 -30 -18 Q-23 -18 -17 -9 Q-24 -26 -11 -25 L-5 -8 Q12 -20 22 -6 Q30 6 20 19 Q12 29 -7 23 Q-21 22 -25 10Z" fill="#53695a" stroke="#233a30" stroke-width="3.5"/>
    <path d="M-13 8 Q-12 -5 4 -6 Q17 -5 13 8 Q10 22 -3 19 Q-11 16 -13 8Z" fill="#b3c3ac" stroke="#263b30" stroke-width="2.5"/>
    <path d="M10 -9 L8 -21 Q13 -28 18 -21 Q17 -31 25 -28 Q29 -25 25 -17 Q32 -19 33 -13 L22 -8" fill="#9c5249" stroke="#314b3f" stroke-width="2"/>
    <path d="M22 -6 L35 1 L21 6Z" fill="#95564b" stroke="#304436" stroke-width="1.5"/>
    <circle cx="17" cy="-7" r="2.8" fill="#20352c"/>
    <path d="M-4 24 v6 m8 -5 v5 m-12 1 h9 m2 0 h9" stroke="#253d32" stroke-width="2"/>
    <path d="M-10 5 Q-6 1 -2 4 Q4 7 6 1" fill="none" stroke="#3d5c4b" stroke-width="2"/>
  </g>
</g>`;

houses.innerHTML=[
  henHouse('tl',249,189,false),
  henHouse('bl',249,344,false),
  henHouse('tr',835,189,true),
  henHouse('br',835,344,true)
].join('');

// Remove old oversized rails. Keep the four distinct LCD rolling lanes and
// drop-target positions unchanged to avoid desynchronising the rules engine.
for(const child of [...scene.children]){
  if(child.tagName.toLowerCase()==='g'&&!child.id)child.remove();
}
const tracks=document.createElementNS(svgNS,'g');tracks.id='lcd-art-tracks';
tracks.innerHTML=`
<g fill="none" stroke-linejoin="round" stroke-linecap="round">
 <path d="M281 225 L459 293 M803 225 L622 293 M281 363 L459 402 M803 363 L622 402" stroke="#95594e" stroke-width="5.2"/>
 <path d="M283 230 L459 298 M801 230 L622 298 M283 368 L459 407 M801 368 L622 407" stroke="#344c40" stroke-width="2"/>
 <path d="M280 224 L280 235 M803 224 L803 235 M280 361 L280 373 M803 361 L803 373" stroke="#283d34" stroke-width="2.5"/>
</g>
<g fill="#345947" opacity=".95">
  <path d="M207 410 l17 -4 7 5 21 -4 8 7 15 -4 10 7 -5 5 -22 -2 -12 6 -24 -6 -15 2Z"/>
  <path d="M316 433 l15 -6 17 4 12 -5 13 6 22 -5 10 7 -7 5 -23 -2 -14 6 -16 -6 -13 4Z"/>
  <path d="M664 430 l18 -6 16 4 12 -5 21 5 13 -4 13 7 -11 6 -21 -1 -13 6 -17 -4 -23 2Z"/>
  <path d="M790 411 l15 -8 20 4 14 -6 17 8 17 -2 7 11 -19 -2 -21 7 -16 -5 -13 4Z"/>
  <path d="M786 159 l17 5 13 -7 13 5 9 -5 16 4 14 -6 12 8 -10 8 -20 -1 -14 10 -17 -5 -16 4Z"/>
  <path d="M206 381 l15 -4 8 6 18 -3 6 5 -7 5 -27 -2 -14 3Z"/>
  <path d="M809 384 l17 -4 12 3 18 -3 6 8 -18 -2 -13 5 -18 -2Z"/>
</g>
<g stroke="#273e32" stroke-width="2" fill="none" opacity=".75">
 <path d="M214 423 h35 m89 15 h40 m315 -1 h44 m85 -17 h40"/>
</g>`;
scene.insertBefore(tracks,hare);

// Long-eared rabbit with a head, paws, feet and a hand bell, not a generic
// shadow silhouette. Its opacity remains driven by the original rules engine.
hare.setAttribute('transform','translate(325 205)');
hare.innerHTML=`
 <g fill="#567362" stroke="#273c32" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M-17 -32 Q-30 -77 -20 -85 Q-8 -90 -4 -48 L2 -84 Q13 -92 17 -79 Q19 -67 14 -36" fill="#819c86"/>
  <path d="M-15 -39 L-18 -77 M6 -44 L8 -79" stroke="#304b3b" stroke-width="2" fill="none"/>
  <path d="M-23 -31 Q-32 -8 -20 8 L-11 17 Q-7 34 9 29 Q34 23 30 -2 Q24 -25 7 -34 Q-4 -42 -23 -31Z" fill="#7f9985"/>
  <path d="M-24 -1 Q-26 20 -13 28 L0 29 Q9 14 -5 0" fill="#bdcbb4" stroke-width="2"/>
  <path d="M-5 29 Q-25 25 -30 39 L-2 39 Q14 33 10 25" fill="#4c6656"/>
  <path d="M21 25 Q41 26 42 34 L16 39 L4 36" fill="#4e6958"/>
  <path d="M10 -8 Q22 -9 28 1 Q16 14 4 8" fill="#c3d0b9" stroke-width="2"/>
  <circle cx="7" cy="-20" r="4.5" fill="#d4dfc7" stroke-width="1.8"/>
  <circle cx="8.5" cy="-19" r="1.7" fill="#263a30" stroke="none"/>
  <circle cx="27" cy="0" r="3" fill="#273e33" stroke="none"/>
  <path d="M-4 10 Q11 19 21 10 M20 10 l5 5 M11 10 l-1 4" fill="none" stroke-width="2"/>
  <path d="M-9 8 Q-1 3 5 11" fill="none" stroke-width="2.3"/>
  <path d="M-5 20 L32 17 L45 4" fill="none" stroke-width="8"/>
  <path d="M37 4 l11 0" stroke-width="5"/>
  <path d="M-19 15 L-13 24" stroke-width="5"/>
 </g>
 <g id="rabbitBell" transform="translate(48 5)" fill="#485f4f" stroke="#273c32" stroke-width="2.5" stroke-linejoin="round">
   <path d="M-11 0 Q-15 -22 0 -22 Q14 -22 12 0 L18 7 H-17 Z"/>
   <circle cx="0" cy="11" r="4"/>
   <path d="M0 -21 v-6" fill="none"/>
 </g>`;

// Keep original element IDs required by the core script; hide those originals
// while rendering a clean, compact wolf silhouette with its own basket/arm.
const prior=wolf.innerHTML;
wolf.innerHTML=`<g display="none">${prior}</g>
<g transform="translate(540 365)" id="artWolf" stroke="#243a30" stroke-linecap="round" stroke-linejoin="round">
  <!-- fluffy sweeping tail, tucked behind body -->
  <path d="M34 6 Q56 -6 76 -29 L65 -13 L90 -29 Q89 0 65 17 Q49 24 38 22Z" fill="#566e5d" stroke-width="5"/>
  <path d="M43 9 Q64 11 77 -5" fill="none" stroke="#b8c4ae" stroke-width="3"/>
  <!-- trouser legs: a running stance (not the original copyrighted wolf sprite) -->
  <path d="M-18 47 Q-28 65 -36 80 L-55 108 L-31 110 L2 78 L14 54" fill="#5b7461" stroke-width="5"/>
  <path d="M17 49 Q31 66 18 85 L44 111 L59 107 L42 74 L48 47" fill="#667f6d" stroke-width="5"/>
  <path d="M-56 105 Q-71 111 -73 119 Q-57 125 -37 118 L-28 108 M41 107 Q57 97 69 105 L76 118 Q66 127 51 122 L37 115" fill="#283f33" stroke-width="4"/>
  <!-- long torso with belly, belt and ragged jacket -->
  <path d="M-31 -29 Q0 -48 28 -26 Q47 -11 42 17 L45 55 Q7 69 -37 53 L-37 10 Q-42 -10 -31 -29Z" fill="#708a73" stroke-width="5"/>
  <path d="M-15 -30 Q9 -20 11 10 Q12 38 2 52 L-26 52 L-19 17" fill="#c7d0b8" stroke="none"/>
  <path d="M-36 41 Q-2 51 44 42 L43 58 Q9 70 -35 58Z" fill="#3c5645" stroke-width="3"/>
  <path d="M-18 41 V59 M6 45 V62 M25 45 V60" fill="none" stroke="#9c6b56" stroke-width="4"/>
  <!-- ears and unmistakable long-nosed wolf head -->
  <path d="M-31 -91 L-29 -139 L-8 -115 L13 -147 L25 -100 Q46 -88 43 -60 L34 -42 Q7 -21 -26 -46 Q-43 -63 -31 -91Z" fill="#627d69" stroke-width="5"/>
  <path d="M-24 -97 L-23 -126 L-10 -108 M9 -112 L14 -135 L18 -101" fill="#bcc8af" stroke-width="3"/>
  <path d="M-29 -64 Q-41 -54 -35 -46 L-23 -50 L-30 -38 L-12 -46" fill="#3c5848" stroke-width="3"/>
  <!-- whiskers, big muzzle, chin and black tip of nose -->
  <path d="M-21 -75 Q-42 -72 -52 -61 L-81 -55 Q-91 -48 -83 -40 Q-62 -35 -45 -40 L-17 -42 Q1 -51 -10 -70Z" fill="#c3ceb7" stroke-width="4"/>
  <path d="M-84 -44 Q-74 -23 -47 -30 Q-33 -34 -27 -44" fill="#526e5c" stroke-width="4"/>
  <ellipse cx="-84" cy="-51" rx="10" ry="7" fill="#22372e" stroke-width="1"/>
  <path d="M-69 -36 Q-51 -32 -40 -41" fill="none" stroke-width="2.5"/>
  <path d="M-48 -38 l6 4 6 -5" fill="#f0ead2" stroke-width="1.5"/>
  <path d="M-53 -56 l-16 -2 M-50 -49 l-18 3" fill="none" stroke-width="1.7"/>
  <path d="M-10 -78 Q-2 -88 8 -79 M22 -79 Q31 -90 39 -79" fill="none" stroke-width="3.3"/>
  <ellipse cx="1" cy="-69" rx="8" ry="14" fill="#d5dfc5" stroke-width="2"/>
  <ellipse cx="23" cy="-67" rx="7.5" ry="14" fill="#d5dfc5" stroke-width="2"/>
  <ellipse cx="-1" cy="-66" rx="3.2" ry="5.2" fill="#1c3329" stroke="none"/>
  <ellipse cx="21" cy="-63" rx="3.2" ry="5.2" fill="#1c3329" stroke="none"/>
  <path d="M5 -39 Q21 -35 30 -47" fill="none" stroke-width="2.5"/>
  <path d="M17 -27 Q35 -24 36 -11" fill="none" stroke-width="5"/>
  <!-- collar with small neckerchief in a muted second LCD color -->
  <path d="M-16 -39 L4 -20 L25 -35 L12 -8 L-6 -15 L-22 -12Z" fill="#8b6153" stroke-width="3"/>
  <!-- away arm and gripping paw -->
  <path d="M28 -19 Q55 -10 53 15 L39 21 L26 0" fill="#607e69" stroke-width="5"/>
  <circle cx="42" cy="19" r="9" fill="#c0cdb6" stroke-width="3"/>
  <!-- arm and woven hand basket move together between upper/lower chutes -->
  <path id="artArm" d="M-27 -19 Q-45 -18 -60 -41" fill="none" stroke="#263d32" stroke-width="15"/>
  <path id="artArmInside" d="M-27 -19 Q-45 -18 -60 -41" fill="none" stroke="#829983" stroke-width="9"/>
  <g id="artBasket" transform="translate(-70 -45)">
     <path d="M-24 -6 H24 L17 21 Q0 33 -18 21Z" fill="#75917a" stroke="#243a30" stroke-width="3.8"/>
     <path d="M-27 -8 H27 M-21 6 H21 M-16 18 H16 M-12 -5 L-8 25 M0 -5 V28 M12 -5 L9 25" stroke="#283d33" fill="none" stroke-width="2.4"/>
     <path d="M-25 -7 Q-23 -30 0 -29 Q23 -30 25 -7" fill="none" stroke="#293f34" stroke-width="3"/>
  </g>
</g>`;

const styled=document.createElement('style');styled.id='art-v13-style';styled.textContent=`
  #handheld .topbar{display:none}
  #handheld #start,#handheld #message{display:none!important}
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
if(score){score.setAttribute('x','545');score.setAttribute('y','174');score.setAttribute('font-size','42');}
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