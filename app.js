const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CT=new URLSearchParams(location.search).get('c');let token=localStorage.getItem('st_token'),st=null,sel=null,tab='out',map,marker,line,watch=null,lastSent=0,fitted=null;
const LBL={pending:'Menunggu izin',granted:'Diizinkan',denied:'Ditolak',revoked:'Dicabut'};
async function api(p,b){const r=await fetch('/api/'+p,{method:b?'POST':'GET',headers:{'content-type':'application/json','x-token':token||''},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Gagal');return j}
const ago=t=>{if(!t)return'belum ada data';const s=Math.round((Date.now()-t)/1000);return s<10?'baru saja':s<60?s+' detik lalu':s<3600?Math.round(s/60)+' menit lalu':new Date(t).toLocaleString('id-ID')};
$('#regForm').onsubmit=async e=>{e.preventDefault();try{const r=await api('register',{name:$('#rName').value,phone:$('#rPhone').value});token=r.token;localStorage.setItem('st_token',token);boot()}catch(x){$('#regErr').textContent=x.message}};
function initMap(){if(map)return;map=L.map('map',{zoomControl:false}).setView([-2.5,118],5);L.control.zoom({position:'topright'}).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
line=L.polyline([],{color:'#1f7a8c',weight:4,opacity:.7}).addTo(map)}
async function boot(){if(CT)return consent();if(!token){$('#onboard').classList.remove('hidden');return}
$('#onboard').classList.add('hidden');$('#app').classList.remove('hidden');initMap();setTimeout(()=>map.invalidateSize(),50);await refresh();setInterval(refresh,4000)}
async function refresh(){try{st=await api('state')}catch(e){if(e.message==='auth'){localStorage.removeItem('st_token');token=null;location.reload()}return}
$('#meLabel').textContent=st.me.name+' · +'+st.me.phone;render();syncShare();if(sel)poll()}
function render(){const pend=st.in.filter(g=>g.status==='pending').length;$('#cIn').textContent=pend||'';$('#cOut').textContent=st.out.filter(g=>g.status==='granted').length||'';
document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
const items=tab==='out'?st.out:st.in;
if(!items.length){$('#list').innerHTML=`<p class="empty">${tab==='out'?'Belum ada nomor. Masukkan nomor di atas untuk meminta izin. Setelah disetujui, Anda bisa melacaknya kapan saja tanpa minta izin lagi.':'Belum ada yang meminta izin lokasi Anda.'}</p>`;return}
$('#list').innerHTML=items.map(g=>{const out=tab==='out';let acts='';
if(out){if(g.status==='granted')acts=`<button class="btn primary sm" data-a="view" data-id="${g.id}">Lihat di peta</button><button class="btn ghost sm" data-a="revoke" data-id="${g.id}">Hentikan</button>`;
else if(g.status==='pending')acts=`<button class="btn ghost sm" data-a="wa" data-p="${g.phone}" data-ct="${g.ct}">Kirim pengingat WhatsApp</button>`;
else acts=`<button class="btn primary sm" data-a="again" data-p="${g.phone}">Minta izin lagi</button>`}
else{if(g.status==='pending')acts=`<button class="btn ok sm" data-a="allow" data-id="${g.id}">Izinkan</button><button class="btn bad sm" data-a="deny" data-id="${g.id}">Tolak</button>`;
else if(g.status==='granted')acts=`<button class="btn bad sm" data-a="revoke" data-id="${g.id}">Cabut izin</button>`}
const sub=out?(g.status==='granted'?'Update: '+ago(g.at):'+'+g.phone):(g.status==='granted'&&g.lastViewed?'Terakhir dilihat '+ago(g.lastViewed):'+'+g.phone);
return`<div class="item ${sel===g.id?'sel':''}"><div class="top"><div class="av">${esc(g.name[0]||'?').toUpperCase()}</div><div><strong>${esc(g.name)}</strong><small>${esc(sub)}</small></div><span class="tag ${g.status}">${LBL[g.status]}</span></div>${acts?`<div class="acts">${acts}</div>`:''}</div>`}).join('')}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
$('#list').onclick=async e=>{const b=e.target.closest('button');if(!b)return;const{a,id,p,ct}=b.dataset;
try{if(a==='view'){sel=id;fitted=null;await poll()}
else if(a==='allow'||a==='deny'){await api('respond',{id,allow:a==='allow'})}
else if(a==='revoke'){if(!confirm('Hentikan berbagi lokasi ini? Izin baru perlu diminta lagi.'))return;await api('revoke',{id});if(sel===id)clearSel()}
else if(a==='again'){await request(p)}else if(a==='wa')window.open(waLink(p,ct),'_blank');await refresh()}catch(x){alert(x.message)}};
const link=ct=>location.origin+'/?c='+ct;
const waLink=(p,ct)=>`https://wa.me/${p}?text=`+encodeURIComponent(`Halo, saya ${st.me.name} ingin melihat lokasimu lewat SafeTrack. Klik link ini lalu tekan "Izinkan": ${link(ct)}`);
async function request(p){const r=await api('request',{phone:p,name:$('#reqName').value});const m=$('#reqMsg');
if(r.reused){m.textContent='Izin sudah ada, Anda bisa langsung melacak tanpa minta izin lagi.';sel=r.grant.id;fitted=null;await poll()}
else m.innerHTML=`Permintaan dibuat. <a target="_blank" rel="noopener" href="${waLink(r.grant.to,r.grant.ct)}">Kirim via WhatsApp</a> atau salin link ini:<br><input readonly value="${link(r.grant.ct)}" onclick="this.select()" style="width:100%;margin-top:6px">`}
$('#reqForm').onsubmit=async e=>{e.preventDefault();try{await request($('#reqPhone').value);$('#reqPhone').value='';await refresh()}catch(x){$('#reqMsg').textContent=x.message}};
function clearSel(){sel=null;marker&&map.removeLayer(marker);marker=null;line.setLatLngs([]);$('#mapInfo').classList.add('hidden')}
async function poll(){try{const r=await api('track/'+sel),info=$('#mapInfo');info.classList.remove('hidden');
if(!r.loc){info.innerHTML=`<strong>${esc(r.name)}</strong><br>Izin aktif, tapi lokasi belum masuk. Minta ${esc(r.name)} membuka SafeTrack di HP-nya.`;return}
const ll=[r.loc.lat,r.loc.lng];if(!marker)marker=L.marker(ll,{icon:L.divIcon({className:'',html:'<div class="dot"></div>',iconSize:[22,22],iconAnchor:[11,11]})}).addTo(map);else marker.setLatLng(ll);
line.setLatLngs(r.trail);if(fitted!==sel){map.flyTo(ll,16);fitted=sel}
info.innerHTML=`<strong>${esc(r.name)}</strong><br>${ago(r.loc.t)} · akurasi ± ${Math.round(r.loc.acc)} m<br><small>${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}</small>`}catch(x){clearSel()}}
function syncShare(){const act=st.in.filter(g=>g.status==='granted'),box=$('#sharing');
if(!act.length){box.classList.add('hidden');if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null}return}
box.classList.remove('hidden');box.innerHTML=`<b>Lokasi Anda dibagikan</b> ke ${act.map(g=>esc(g.name)).join(', ')}. Biarkan halaman ini terbuka. Cabut kapan saja di tab Izin masuk.`;
if(watch===null&&navigator.geolocation)watch=navigator.geolocation.watchPosition(p=>{if(Date.now()-lastSent<5000)return;lastSent=Date.now();api('location',{lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}).catch(()=>{})},e=>{box.innerHTML='Izin lokasi browser ditolak. Aktifkan lokasi untuk situs ini agar bisa dibagikan.'},{enableHighAccuracy:true,maximumAge:5000,timeout:20000})}
boot();

async function consent(){
  $('#consent').classList.remove('hidden');
  const box=$('#cBox');let w=null,last=0,cur='';
  const call=(p,b)=>fetch('/api/consent/'+CT+p,{method:b?'POST':'GET',headers:{'content-type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Gagal');return j});
  const stop=()=>{if(w!==null){navigator.geolocation.clearWatch(w);w=null}};
  const start=()=>{if(w!==null)return;if(!navigator.geolocation){box.insertAdjacentHTML('beforeend','<p class="err">Browser ini tidak mendukung lokasi.</p>');return}
    w=navigator.geolocation.watchPosition(p=>{if(Date.now()-last<5000)return;last=Date.now();call('/location',{lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}).then(()=>{const e=$('#cLast');if(e)e.textContent='Terakhir terkirim: '+new Date().toLocaleTimeString('id-ID')}).catch(()=>{})},
    ()=>{const e=$('#cErr');if(e)e.textContent='Izin lokasi browser ditolak. Aktifkan lokasi untuk situs ini, lalu muat ulang halaman.'},{enableHighAccuracy:true,maximumAge:5000,timeout:20000})};
  async function draw(){let g;try{g=await call('')}catch(e){box.innerHTML='<div class="logo">◎</div><h1>Link tidak valid</h1><p>Link ini salah atau sudah diganti. Minta pengirim membuat link baru.</p>';return}
    if(g.status===cur)return;cur=g.status;const n=esc(g.from);
    if(g.status==='pending'){stop();box.innerHTML=`<div class="logo">◎</div><h1>${n} ingin melihat lokasimu</h1><p>Jika kamu izinkan, ${n} bisa melihat lokasimu di peta. Cukup izinkan sekali, tidak akan ditanya lagi. Kamu bisa mencabutnya kapan saja dari halaman ini.</p><button class="btn ok" id="cYes">Izinkan</button><button class="btn ghost" id="cNo">Tolak</button><p id="cErr" class="err"></p>`}
    else if(g.status==='granted'){box.innerHTML=`<div class="logo">◎</div><h1>Lokasimu dibagikan ke ${n}</h1><p>Biarkan halaman ini tetap terbuka agar lokasimu terus terkirim. Buka link yang sama kapan saja untuk melanjutkan atau mencabut izin.</p><p id="cLast" class="hint">Menunggu lokasi…</p><button class="btn bad" id="cOff">Cabut izin</button><p id="cErr" class="err"></p>`;start()}
    else{stop();box.innerHTML=`<div class="logo">◎</div><h1>${g.status==='denied'?'Permintaan ditolak':'Izin dicabut'}</h1><p>${n} tidak bisa lagi melihat lokasimu. Kamu boleh menutup halaman ini.</p>`}}
  box.onclick=async e=>{const id=e.target.id;try{
    if(id==='cYes'){await call('/respond',{allow:true});cur='';await draw()}
    else if(id==='cNo'){await call('/respond',{allow:false});cur='';await draw()}
    else if(id==='cOff'){if(!confirm('Cabut izin? Lokasimu tidak akan terlihat lagi.'))return;await call('/revoke',{});cur='';await draw()}}catch(x){alert(x.message)}};
  await draw();setInterval(draw,10000);
}
