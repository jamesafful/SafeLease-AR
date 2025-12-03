import { startAR } from './ar.js';

const state = {
  version: 1,
  address: '',
  checks: {},                  // { "Kitchen:gfci": true }
  photos: [],                  // data URLs (jpeg)
  photosMeta: {},              // { idx: {w,h,bytes} }
  lastCaptureTs: 0,
  canvasCaptureEnabled: null   // set after capability probe
};

const UI = {
  addr: document.getElementById('addr'),
  addrStatus: document.getElementById('addr-status'),
  rooms: document.getElementById('rooms'),
  btnXR: document.getElementById('btn-xr'),
  btnPhoto: document.getElementById('btn-photo'),
  btnExport: document.getElementById('btn-export'),
  hint: document.getElementById('hint'),
  gallery: document.getElementById('gallery'),
  photoCount: document.getElementById('photo-count'),
  pdfEstimate: document.getElementById('pdf-estimate'),
  compatBadge: document.getElementById('compat-badge'),
  meta: document.getElementById('meta'),
  canvas: document.getElementById('xr-canvas')
};

const MAX_PHOTOS_DEFAULT = 24;
const JPEG_QUALITY = 0.78;
const MAX_EDGE = 1280; // px

function sortRooms(rooms){
  return rooms.map(r => ({...r, items: [...r.items].sort((a,b)=>a.id.localeCompare(b.id))}))
              .sort((a,b)=>a.name.localeCompare(b.name));
}

async function loadChecklist(){
  const res = await fetch('./src/checklist.json');
  const data = await res.json();
  if (data.address) {
    UI.addr.value = data.address;
    state.address = data.address;
  }
  const rooms = sortRooms(data.rooms || []);
  renderRooms(rooms);
}

function renderRooms(rooms){
  UI.rooms.innerHTML = '';
  for (const room of rooms){
    const wrap = document.createElement('div');
    wrap.className = 'room';
    const h = document.createElement('h3');
    h.textContent = room.name;
    wrap.appendChild(h);
    for (const item of room.items){
      const row = document.createElement('div'); row.className = 'item';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.id = item.id;
      cb.checked = !!state.checks[item.id];
      cb.addEventListener('change', ()=>{
        state.checks[item.id] = cb.checked;
      });
      const lab = document.createElement('label'); lab.htmlFor = item.id; lab.textContent = item.title;
      row.appendChild(cb); row.appendChild(lab);
      wrap.appendChild(row);
    }
    UI.rooms.appendChild(wrap);
  }
}

function updateMeta(){
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  const now = new Date();
  UI.meta.textContent = `${now.toISOString().slice(0,10)} • ${tz}`;
}

function setHint(msg, tone=''){
  UI.hint.textContent = msg || '';
  UI.hint.style.color = tone==='warn' ? '#f59e0b' : '#aab0b6';
}

function bytesHuman(n){
  if (n < 1024) return `${n} B`;
  if (n < 1024*1024) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(2)} MB`;
}

function estimatePdfSize(){
  const sum = Object.values(state.photosMeta).reduce((a,m)=>a + (m?.bytes||0), 0);
  UI.pdfEstimate.textContent = state.photos.length ? `Estimated PDF size: ~${bytesHuman(sum + 75*1024)}` : 'Estimated PDF size: ~30–60 KB (no photos)';
}

function renderGallery(){
  UI.gallery.innerHTML='';
  for (let i=0; i<state.photos.length; i++){
    const img = document.createElement('img');
    img.className='thumb';
    img.src = state.photos[i];
    img.alt = `Photo ${i+1}`;
    UI.gallery.appendChild(img);
  }
  UI.photoCount.textContent = String(state.photos.length);
  estimatePdfSize();
}

async function probeCanvasCapture(){
  try{
    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const ctx = c.getContext('2d', {alpha:false});
    ctx.fillStyle = '#111'; ctx.fillRect(0,0,2,2);
    const data = c.toDataURL('image/jpeg', 0.5);
    state.canvasCaptureEnabled = data.startsWith('data:image/jpeg');
  }catch(e){
    state.canvasCaptureEnabled = false;
  }
  if (!state.canvasCaptureEnabled){
    setHint('Screenshot capture unavailable—PDF will exclude thumbnails.', 'warn');
  }
}

function detectCompat(){
  const xr = ('xr' in navigator);
  const webgl = !!UI.canvas.getContext('webgl');
  let text = [];
  text.push(webgl ? 'WebGL ✅' : 'WebGL ❌');
  text.push(xr ? 'WebXR (best on Chrome/Android) ✅' : 'WebXR ❌');
  UI.compatBadge.textContent = text.join(' • ');
}

function throttleCapture(){
  const now = performance.now();
  if (now - state.lastCaptureTs < 500) return true;
  state.lastCaptureTs = now; return false;
}

async function downscaleToJpeg(dataUrl, maxEdge = MAX_EDGE, quality = JPEG_QUALITY){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = ()=>{
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d', {alpha:false, desynchronized:true});
      ctx.drawImage(img, 0, 0, w, h);
      const out = c.toDataURL('image/jpeg', quality);
      resolve({dataUrl: out, w, h, bytes: Math.ceil((out.length - 'data:image/jpeg;base64,'.length) * 3/4)});
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function capturePhotoFromCanvas(){
  if (!state.canvasCaptureEnabled){ setHint('Screenshot capture blocked by browser settings.', 'warn'); return; }
  if (state.photos.length >= MAX_PHOTOS_DEFAULT){
    setHint(`Photo cap reached (${MAX_PHOTOS_DEFAULT}). Export or remove some before adding more.`, 'warn');
    return;
  }
  if (throttleCapture()) return;
  const data = UI.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const downsized = await downscaleToJpeg(data, MAX_EDGE, JPEG_QUALITY);
  const idx = state.photos.length;
  state.photos.push(downsized.dataUrl);
  state.photosMeta[idx] = { w: downsized.w, h: downsized.h, bytes: downsized.bytes };
  renderGallery();
}

function getCheckedItems(){
  const entries = Object.entries(state.checks).filter(([,v])=>!!v).map(([k])=>k).sort();
  return entries;
}

function computeChecklistHash(rooms){
  const enc = new TextEncoder();
  const flat = rooms.map(r => r.name + ':' + r.items.map(i=>i.id+':'+i.title).join('|')).join('||');
  return crypto.subtle.digest('SHA-256', enc.encode(flat)).then(buf=>{
    const b = new Uint8Array(buf);
    return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).slice(0,8).join('');
  });
}

async function exportPDF(){
  // @ts-ignore
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF){
    setHint('jsPDF failed to load. Check network connectivity on first load.', 'warn');
    return;
  }
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const page = { w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight() };
  const margin = 40;
  let y = margin;

  // Header
  doc.setFont('helvetica','bold').setFontSize(16).text('SafeLease AR — Inspection Report', margin, y);
  y += 22;
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  doc.setFont('helvetica','normal').setFontSize(11);
  doc.text(`Timestamp: ${now.toLocaleString()} (${tz})`, margin, y); y += 16;
  if (state.address) { doc.text(`Address: ${state.address}`, margin, y); y += 16; }

  // Checklist
  doc.setFont('helvetica','bold').setFontSize(13).text('Checklist', margin, y); y += 16;
  doc.setFont('helvetica','normal').setFontSize(11);
  const checked = getCheckedItems();
  if (checked.length === 0){
    doc.text('No items checked.', margin, y); y += 16;
  } else {
    for (const id of checked){
      if (y > page.h - margin){ doc.addPage(); y = margin; }
      doc.text(`• ${id}`, margin, y);
      y += 14;
    }
  }

  // Photos grid
  doc.addPage(); y = margin;
  doc.setFont('helvetica','bold').setFontSize(13).text('Photos', margin, y); y += 14;
  doc.setFont('helvetica','normal').setFontSize(10);
  if (state.photos.length === 0){
    doc.text('No photos captured.', margin, y); y += 14;
  } else {
    const cols = 3;
    const gap = 8;
    const cellW = Math.floor((page.w - margin*2 - gap*(cols-1)) / cols);
    let col = 0;
    for (let i=0; i<state.photos.length; i++){
      const img = state.photos[i];
      // Assume 4:3 box; we letterbox to fit width
      const cellH = Math.floor(cellW * 0.75);
      if (y + cellH + 30 > page.h - margin){
        doc.addPage(); y = margin;
      }
      const x = margin + col * (cellW + gap);
      doc.addImage(img, 'JPEG', x, y, cellW, cellH, undefined, 'FAST');
      doc.text(`Photo ${i+1}`, x, y + cellH + 12);
      col = (col + 1) % cols;
      if (col === 0) y += cellH + 28;
    }
  }

  // Footer
  const appVersion = 'v1.0';
  const roomsData = await (await fetch('./src/checklist.json')).json();
  const checklistHash = await computeChecklistHash(roomsData.rooms || []);
  doc.setFont('helvetica','normal').setFontSize(9);
  const footer = `Generated with SafeLease-AR ${appVersion} • checklist ${checklistHash}`;
  doc.text(footer, margin, page.h - margin/2);

  doc.save('SafeLease_Report.pdf');
}

async function main(){
  updateMeta();
  detectCompat();
  await probeCanvasCapture();
  await loadChecklist();
  UI.addr.addEventListener('input', ()=>{ state.address = UI.addr.value.trim(); });
  UI.btnExport.addEventListener('click', exportPDF);
  UI.btnPhoto.addEventListener('click', capturePhotoFromCanvas);

  let arHandle = null;
  UI.btnXR.addEventListener('click', async () => {
    try{
      UI.canvas.style.display = 'block';
      setHint('Starting AR session…');
      arHandle = await startAR(UI.canvas, ()=>{
        UI.btnPhoto.disabled = !state.canvasCaptureEnabled;
      });
      setHint('AR session active. Tap the canvas to place markers. Use "Take photo" to capture.');
    }catch(e){
      console.error(e);
      UI.canvas.style.display = 'none';
      setHint('AR unavailable. You can still complete the checklist and export a PDF.', 'warn');
    }
  });
}

main();