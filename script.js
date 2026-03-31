
// ─── State ───────────────────────────────────────────────────
const state = {
  audios: [],
  videos: [],        // {name, file, url, slotIdx}
  queue: [],
  doneBlobs: [],
  subtitlesEnabled: true,
  subtitleColor: '#ff3c5f',
  isGenerating: false,
  videoSlotTarget: 0
};

const MAX_SLOTS = 6;

// ─── Init video slots ─────────────────────────────────────────
function initVideoSlots() {
  const grid = document.getElementById('videoGrid');
  grid.innerHTML = '';
  for (let i = 0; i < MAX_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className = 'video-slot';
    slot.id = `vslot_${i}`;
    slot.onclick = () => {
      state.videoSlotTarget = i;
      document.getElementById('videoInputHidden').click();
    };
    slot.innerHTML = `
      <div class="slot-add">+</div>
      <div class="video-slot-label">Gameplay ${i + 1}</div>
    `;
    grid.appendChild(slot);
  }
}

// ─── Video slot loading ────────────────────────────────────────
function handleVideoFileFromInput(input) {
  const f = input.files[0];
  if (!f) return;
  loadVideoIntoSlot(state.videoSlotTarget, f);
  input.value = ''; // reset so same file can be reloaded
}

function loadVideoIntoSlot(slotIdx, file) {
  // Remove existing video in this slot if any
  const existing = state.videos.findIndex(v => v.slotIdx === slotIdx);
  if (existing >= 0) {
    URL.revokeObjectURL(state.videos[existing].url);
    state.videos.splice(existing, 1);
  }

  const url = URL.createObjectURL(file);
  state.videos.push({ name: file.name, file, url, slotIdx });
  state.videos.sort((a, b) => a.slotIdx - b.slotIdx);

  renderVideoSlots();
  updateStats();
  log(`Gameplay ajouté : ${file.name}`, 'ok');
}

function removeVideoSlot(slotIdx) {
  const idx = state.videos.findIndex(v => v.slotIdx === slotIdx);
  if (idx >= 0) {
    URL.revokeObjectURL(state.videos[idx].url);
    state.videos.splice(idx, 1);
  }
  renderVideoSlots();
  updateStats();
}

function renderVideoSlots() {
  for (let i = 0; i < MAX_SLOTS; i++) {
    const slot = document.getElementById(`vslot_${i}`);
    const vid = state.videos.find(v => v.slotIdx === i);
    if (vid) {
      slot.classList.add('loaded');
      slot.onclick = null;
      slot.innerHTML = `
        <video src="${vid.url}" muted loop autoplay playsinline></video>
        <div class="video-slot-name">${vid.name.replace(/\.[^.]+$/, '').substring(0, 18)}</div>
        <button class="video-slot-remove" onclick="event.stopPropagation();removeVideoSlot(${i})">×</button>
      `;
    } else {
      slot.classList.remove('loaded');
      slot.onclick = () => {
        state.videoSlotTarget = i;
        document.getElementById('videoInputHidden').click();
      };
      slot.innerHTML = `
        <div class="slot-add">+</div>
        <div class="video-slot-label">Gameplay ${i + 1}</div>
      `;
    }
  }
}

// ─── Drag & Drop (audio) ───────────────────────────────────────
const dz = document.getElementById('dropZone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', e => {
  e.preventDefault();
  dz.classList.remove('drag-over');
  const files = [...e.dataTransfer.files].filter(f =>
    f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(f.name)
  );
  if (files.length) handleAudioFiles(files);
  else notif('Aucun fichier audio détecté', 'warn');
});
dz.addEventListener('click', () => document.getElementById('audioInput').click());

// Global drag & drop for video files
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  const audioFiles = files.filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(f.name));
  const videoFiles = files.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv)$/i.test(f.name));

  if (audioFiles.length) handleAudioFiles(audioFiles);
  videoFiles.forEach(f => {
    const emptySlot = Array.from({ length: MAX_SLOTS }, (_, i) => i).find(i => !state.videos.find(v => v.slotIdx === i));
    if (emptySlot !== undefined) loadVideoIntoSlot(emptySlot, f);
  });
});

// ─── Audio handling ────────────────────────────────────────────
function handleAudioFiles(files) {
  [...files].forEach(f => {
    if (state.audios.find(a => a.name === f.name)) return;
    const url = URL.createObjectURL(f);
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      state.audios.push({ name: f.name, file: f, url, duration: audio.duration });
      renderAudioList();
      updateStats();
      log(`Audio ajouté : ${f.name}`, 'ok');
    });
    audio.onerror = () => {
      // Try adding without duration
      state.audios.push({ name: f.name, file: f, url, duration: 0 });
      renderAudioList();
      updateStats();
      log(`Audio ajouté (durée inconnue) : ${f.name}`, 'warn');
    };
  });
}

function renderAudioList() {
  const list = document.getElementById('audioList');
  list.innerHTML = '';
  state.audios.forEach((a, i) => {
    const item = document.createElement('div');
    item.className = 'audio-item';
    item.innerHTML = `
      <span class="audio-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="audio-name" title="${a.name}">${a.name.replace(/\.[^.]+$/, '')}</span>
      <span class="audio-dur">${formatDur(a.duration)}</span>
      <button class="btn-remove" onclick="removeAudio(${i})">×</button>
    `;
    list.appendChild(item);
  });
}

function removeAudio(i) {
  URL.revokeObjectURL(state.audios[i].url);
  state.audios.splice(i, 1);
  renderAudioList();
  updateStats();
}

// ─── Settings ─────────────────────────────────────────────────
document.getElementById('audioVol').addEventListener('input', function () {
  document.getElementById('audioVolVal').textContent = this.value + '%';
});
document.getElementById('gameVol').addEventListener('input', function () {
  document.getElementById('gameVolVal').textContent = this.value + '%';
});

function toggleSubtitles() {
  state.subtitlesEnabled = !state.subtitlesEnabled;
  document.getElementById('subtitleToggle').classList.toggle('on', state.subtitlesEnabled);
}

function pickColor(el) {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  state.subtitleColor = el.dataset.c;
  updateSubPreview();
}

const demoTexts = ['UNE HISTOIRE VRAIE...', 'IL ÉTAIT AVEC ELLE', 'PENDANT TOUT CE TEMPS', 'LA VÉRITÉ ÉCLATE'];
let demoIdx = 0;

function updateSubPreview() {
  const style = document.getElementById('subtitleStyle').value;
  const el = document.getElementById('subPreviewText');
  const c = state.subtitleColor;
  el.style.cssText = '';
  el.style.fontFamily = "'Bebas Neue', Impact, sans-serif";
  el.style.letterSpacing = '1px';

  if (style === 'tiktok') {
    const words = demoTexts[demoIdx].split(' ');
    el.innerHTML = words.map((w, i) => `<span style="color:${i % 3 === 0 ? c : '#fff'};text-shadow:-2px -2px 0 #000,2px 2px 0 #000">${w}</span>`).join(' ');
    el.style.fontSize = '15px'; el.style.background = 'none';
  } else if (style === 'clean') {
    el.textContent = demoTexts[demoIdx];
    el.style.color = '#fff'; el.style.background = 'rgba(0,0,0,0.55)';
    el.style.padding = '4px 12px'; el.style.borderRadius = '4px';
  } else if (style === 'outline') {
    el.textContent = demoTexts[demoIdx];
    el.style.color = '#fff';
    el.style.textShadow = '-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000';
    el.style.fontSize = '15px'; el.style.background = 'none';
  } else if (style === 'highlight') {
    el.textContent = demoTexts[demoIdx];
    el.style.color = '#000'; el.style.background = c;
    el.style.padding = '4px 12px'; el.style.borderRadius = '4px'; el.style.fontWeight = '900';
  }
}

setInterval(() => {
  demoIdx = (demoIdx + 1) % demoTexts.length;
  document.getElementById('subPreviewText').textContent = demoTexts[demoIdx];
  updateSubPreview();
}, 2500);

// ─── Queue ────────────────────────────────────────────────────
function addAllToQueue() {
  if (!state.audios.length) { notif('Aucun audio chargé', 'warn'); return; }
  if (!state.videos.length) { notif('Aucun gameplay chargé', 'warn'); return; }

  const mode = document.getElementById('videoMode').value;
  let videoPool = [...state.videos];
  if (mode === 'shuffle') videoPool = shuffleArray([...state.videos]);
  let seqIdx = 0;

  // Only add audios not yet in queue
  const newItems = state.audios
    .filter(audio => !state.queue.find(q => q.audio.name === audio.name))
    .map((audio, i) => {
      let video;
      if (mode === 'random') video = videoPool[Math.floor(Math.random() * videoPool.length)];
      else if (mode === 'shuffle') { video = videoPool[seqIdx % videoPool.length]; seqIdx++; }
      else { video = videoPool[(state.queue.length + i) % videoPool.length]; }
      return {
        id: Date.now() + i,
        audio, video,
        status: 'waiting',
        progress: 0,
        blob: null,
        outputName: `triangle_${sanitize(audio.name)}_${Date.now()}.mp4`
      };
    });

  if (!newItems.length) { notif('Tous les audios sont déjà en file', 'warn'); return; }

  state.queue.push(...newItems);
  renderQueue();
  updateStats();
  log(`${newItems.length} vidéo(s) ajoutée(s) en file`, 'ok');
  notif(`${newItems.length} vidéo(s) en file`, 'ok');
}

function renderQueue() {
  const list = document.getElementById('queueList');
  document.getElementById('queueCount').textContent = `${state.queue.length} vidéo${state.queue.length > 1 ? 's' : ''}`;

  if (!state.queue.length) {
    list.innerHTML = `<div class="empty-queue"><div class="big">▷</div>Ajoute des audios et des gameplays<br>puis clique sur Générer</div>`;
    return;
  }

  list.innerHTML = '';
  state.queue.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'queue-item' + (item.status === 'done' ? ' done' : '');
    el.id = `qi_${item.id}`;
    const statusLabel = { waiting: 'En attente', processing: 'Traitement...', done: 'Terminé ✓', error: 'Erreur' }[item.status];
    el.innerHTML = `
      <div class="queue-item-progress" style="width:${item.progress}%"></div>
      <span class="queue-item-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="queue-item-info">
        <div class="queue-item-title">${item.audio.name.replace(/\.[^.]+$/, '').substring(0, 28)}</div>
        <div class="queue-item-meta">
          <span class="status-dot ${item.status}"></span>
          <span>${statusLabel}</span>
          <span>·</span>
          <span style="color:var(--accent2)">${item.video.name.replace(/\.[^.]+$/, '').substring(0, 16)}</span>
        </div>
      </div>
      <div class="queue-item-actions">
        ${item.status === 'done' ? `<button class="btn-dl" onclick="downloadOne(${i})">⬇ DL</button>` : ''}
      </div>
    `;
    list.appendChild(el);
  });

  document.getElementById('dlAllBtn').style.display =
    state.queue.filter(q => q.status === 'done').length > 0 ? 'block' : 'none';
}

// ─── Generation ───────────────────────────────────────────────
async function startGeneration() {
  if (!state.audios.length || !state.videos.length) {
    notif('Charge des audios ET des gameplays', 'warn'); return;
  }

  if (!state.queue.length || !state.queue.find(q => q.status === 'waiting')) {
    addAllToQueue();
    if (!state.queue.length) return;
  }

  if (state.isGenerating) return;
  state.isGenerating = true;
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.textContent = '⏳ GÉNÉRATION EN COURS...';

  const waiting = state.queue.filter(q => q.status === 'waiting');
  log(`Démarrage : ${waiting.length} vidéo(s) à générer`, 'warn');

  for (let i = 0; i < state.queue.length; i++) {
    if (state.queue[i].status !== 'waiting') continue;
    await processItem(i);
  }

  state.isGenerating = false;
  btn.disabled = false;
  btn.textContent = '▶ GÉNÉRER LES VIDÉOS';

  const done = state.queue.filter(q => q.status === 'done').length;
  log(`Terminé ! ${done} vidéo(s) prête(s)`, 'ok');
  notif(`${done} vidéo(s) générée(s) !`, 'ok');
  updateStats();
  renderQueue();
}

async function processItem(idx) {
  const item = state.queue[idx];
  item.status = 'processing';
  item.progress = 5;
  renderQueue();
  log(`Traitement : ${item.audio.name}`, 'info');

  try {
    const blob = await renderVideo(item, (p) => {
      item.progress = p;
      const el = document.getElementById(`qi_${item.id}`);
      if (el) el.querySelector('.queue-item-progress').style.width = p + '%';
    });

    item.blob = blob;
    item.status = 'done';
    item.progress = 100;
    state.doneBlobs.push({ blob, name: item.outputName });
    log(`✓ ${item.audio.name}`, 'ok');
    updateStats();
    renderQueue();
  } catch (e) {
    item.status = 'error';
    item.progress = 0;
    log(`Erreur : ${e.message}`, 'err');
    console.error(e);
    renderQueue();
  }
}

// ─── Video rendering ──────────────────────────────────────────
async function renderVideo(item, onProgress) {
  onProgress(10);

  const fmt = document.getElementById('outputFormat').value;
  let cw, ch;
  if (fmt === '9:16') { cw = 1080; ch = 1920; }
  else if (fmt === '1:1') { cw = 1080; ch = 1080; }
  else { cw = 1920; ch = 1080; }

  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // Load video element
  const videoEl = document.createElement('video');
  videoEl.src = item.video.url;
  videoEl.muted = true;
  videoEl.loop = true;
  videoEl.preload = 'auto';

  await new Promise((res, rej) => {
    videoEl.oncanplaythrough = res;
    videoEl.onerror = (e) => rej(new Error('Impossible de charger la vidéo : ' + item.video.name));
    videoEl.load();
  });

  onProgress(20);

  // Audio setup with Web Audio API
  const audioCtx = new AudioContext();
  const gainAudio = audioCtx.createGain();
  const gainGame = audioCtx.createGain();
  const dest = audioCtx.createMediaStreamDestination();

  gainAudio.gain.value = parseInt(document.getElementById('audioVol').value) / 100;
  gainGame.gain.value = parseInt(document.getElementById('gameVol').value) / 100;

  // Decode story audio first to get buffer
  const arrayBuf = await item.audio.file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);

  // Get audio duration
  let audioDur = audioBuffer.duration;
  if (!audioDur || audioDur <= 0) audioDur = 30;

  // Generate subtitles
  let subtitles = [];
  if (state.subtitlesEnabled) {
    let apiKey = localStorage.getItem('googleApiKey');
    if (apiKey) {
      try {
        log(`Génération des sous-titres via Google API...`, 'info');
        subtitles = await generateSubtitlesAPI(audioBuffer, apiKey);
        log(`${subtitles.length} sous-titres générés`, 'ok');
      } catch (e) {
        log(`Erreur API sous-titres : ${e.message}`, 'err');
        subtitles = generateFallbackSubtitles(item.audio.name, audioDur);
      }
    } else {
      log('Pas de clé API Google, sous-titres auto-générés (fallback)', 'warn');
      subtitles = generateFallbackSubtitles(item.audio.name, audioDur);
    }
  }

  onProgress(35);

  const audioSrc = audioCtx.createBufferSource();
  audioSrc.buffer = audioBuffer;
  audioSrc.connect(gainAudio);
  gainAudio.connect(dest);

  // Gameplay audio
  let gameAudioSrc = null;
  try {
    gameAudioSrc = audioCtx.createMediaElementSource(videoEl);
    gameAudioSrc.connect(gainGame);
    gainGame.connect(dest);
  } catch (e) {
    // Already captured or not available
    log('Audio gameplay non disponible (ignoré)', 'warn');
  }

  onProgress(40);

  // Canvas stream
  const fps = 30;
  const canvasStream = canvas.captureStream(fps);
  const audioTrack = dest.stream.getAudioTracks()[0];
  if (audioTrack) canvasStream.addTrack(audioTrack);

  // MediaRecorder
  const mimeTypes = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9', 'video/webm'];
  const supportedMime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';

  const recorder = new MediaRecorder(canvasStream, { mimeType: supportedMime, videoBitsPerSecond: 8000000 });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  // Start
  videoEl.currentTime = 0;
  await videoEl.play();
  audioSrc.start(0);
  recorder.start(100);

  const startTime = audioCtx.currentTime;

  await new Promise(resolve => {
    let rafId;
    let lastTime = 0;
    const frameDuration = 1000 / fps;

    function renderLoop(timestamp) {
      const elapsed = audioCtx.currentTime - startTime;

      if (elapsed >= audioDur) {
        resolve();
        return;
      }

      const progress = 40 + Math.round(Math.min(elapsed / audioDur, 1) * 57);
      onProgress(progress);

      // Throttle to fps
      if (timestamp - lastTime >= frameDuration) {
        drawFrame(ctx, videoEl, cw, ch, subtitles, elapsed);
        lastTime = timestamp;
      }

      rafId = requestAnimationFrame(renderLoop);
    }

    audioSrc.onended = () => {
      cancelAnimationFrame(rafId);
      resolve();
    };

    rafId = requestAnimationFrame(renderLoop);
  });

  recorder.stop();
  videoEl.pause();

  onProgress(97);

  await new Promise(r => { recorder.onstop = r; });
  await audioCtx.close();

  const blob = new Blob(chunks, { type: supportedMime });
  onProgress(100);
  return blob;
}

// ─── Frame drawing ────────────────────────────────────────────
function drawFrame(ctx, videoEl, cw, ch, subtitles, elapsed) {
  // Draw video (cover fill)
  if (videoEl.readyState >= 2) {
    const vw = videoEl.videoWidth || cw;
    const vh = videoEl.videoHeight || ch;
    const vAR = vw / vh;
    const cAR = cw / ch;
    let sx, sy, sw, sh;
    if (vAR > cAR) {
      sh = vh; sw = sh * cAR;
      sx = (vw - sw) / 2; sy = 0;
    } else {
      sw = vw; sh = sw / cAR;
      sx = 0; sy = (vh - sh) / 2;
    }
    ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, cw, ch);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
  }

  // Vignette
  const vig = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, cw, ch);

  // Bottom gradient for subtitles
  if (subtitles.length) {
    const grad = ctx.createLinearGradient(0, ch * 0.65, 0, ch);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, ch * 0.65, cw, ch * 0.35);
  }

  // Subtitles
  if (subtitles.length) {
    const sub = subtitles.find(s => elapsed >= s.start && elapsed < s.end);
    if (sub) drawSubtitle(ctx, sub.text, cw, ch);
  }
}

function drawSubtitle(ctx, text, cw, ch) {
  const style = document.getElementById('subtitleStyle').value;
  const color = state.subtitleColor;
  const fontSize = Math.max(Math.round(cw * 0.085), 45); // VERY BIG
  const y = ch * 0.50; // VERY CENTERED
  const maxW = cw * 0.90;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${fontSize}px Impact, 'Arial Black', sans-serif`;

  const lines = wrapText(ctx, text, maxW);
  const lineH = fontSize * 1.35;
  const totalH = lines.length * lineH;
  const startY = y - totalH / 2 + lineH / 2;

  lines.forEach((line, li) => {
    const ly = startY + li * lineH;

    if (style === 'tiktok') {
      const words = line.split(' ');
      let xOffset = 0;
      const totalW = ctx.measureText(line).width;
      let curX = cw / 2 - totalW / 2;
      words.forEach((word, wi) => {
        const ww = ctx.measureText(word + ' ').width;
        const wx = curX + ww / 2;
        const isAccent = (li + wi) % 3 === 0;
        ctx.strokeStyle = '#000'; ctx.lineWidth = fontSize * 0.12;
        ctx.strokeText(word, wx, ly);
        ctx.fillStyle = isAccent ? color : '#fff';
        ctx.fillText(word, wx, ly);
        curX += ww;
      });
    } else if (style === 'clean') {
      const tw = ctx.measureText(line).width;
      const pad = fontSize * 0.4;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, cw / 2 - tw / 2 - pad, ly - fontSize / 2 - pad * 0.5, tw + pad * 2, fontSize + pad, fontSize * 0.25);
      ctx.fillStyle = '#fff';
      ctx.fillText(line, cw / 2, ly);
    } else if (style === 'outline') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = fontSize * 0.14; ctx.lineJoin = 'round';
      ctx.strokeText(line, cw / 2, ly);
      ctx.fillStyle = '#fff';
      ctx.fillText(line, cw / 2, ly);
    } else if (style === 'highlight') {
      const tw = ctx.measureText(line).width;
      const pad = fontSize * 0.35;
      ctx.fillStyle = color;
      roundRect(ctx, cw / 2 - tw / 2 - pad, ly - fontSize / 2 - pad * 0.4, tw + pad * 2, fontSize + pad * 0.8, pad * 0.3);
      ctx.fillStyle = '#000';
      ctx.fillText(line, cw / 2, ly);
    }
  });

  ctx.restore();
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  });
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

// ─── Subtitles ────────────────────────────────────────────────
function generateFallbackSubtitles(name, duration) {
  const storyPhrases = [
    "UNE HISTOIRE VRAIE...",
    "TOUT A COMMENCÉ UN SOIR...",
    "IL ME PRÉSENTAIT COMME SON AMI",
    "MAIS QUELQUE CHOSE N'ALLAIT PAS",
    "J'AI DÉCOUVERT LA VÉRITÉ",
    "IL ÉTAIT AVEC EUX DEUX...",
    "PENDANT TOUT CE TEMPS...",
    "JE N'AVAIS RIEN VU VENIR",
    "C'ÉTAIT UN TRIANGLE",
    "ET MOI J'ÉTAIS LE DERNIER À SAVOIR",
    "CE QUI S'EST PASSÉ ENSUITE...",
    "VOUS N'ALLEZ PAS LE CROIRE",
    "IL M'A TOUT AVOUÉ",
    "LES LARMES AUX YEUX",
    "MAIS IL ÉTAIT TROP TARD",
    "J'AVAIS DÉJÀ TOURNÉ LA PAGE",
    "FIN.",
  ];

  const count = Math.ceil(duration / 2.5);
  const result = [];
  for (let i = 0; i < count; i++) {
    const phrase = storyPhrases[i % storyPhrases.length];
    result.push({
      start: i * 2.5,
      end: (i + 1) * 2.5,
      text: phrase
    });
  }
  return result;
}

// ─── Download ─────────────────────────────────────────────────
function downloadOne(idx) {
  const item = state.queue[idx];
  if (!item || !item.blob) return;
  triggerDownload(item.blob, item.outputName);
  log(`Téléchargement : ${item.outputName}`, 'ok');
}

function downloadAll() {
  const done = state.queue.filter(q => q.status === 'done');
  done.forEach((item, i) => {
    setTimeout(() => triggerDownload(item.blob, item.outputName), i * 700);
  });
  log(`${done.length} téléchargement(s) lancé(s)`, 'ok');
  notif(`${done.length} téléchargements lancés`, 'ok');
}

function triggerDownload(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ─── Utils ────────────────────────────────────────────────────
function clearAll() {
  if (state.isGenerating) { notif('Génération en cours, attends la fin', 'warn'); return; }
  state.audios.forEach(a => URL.revokeObjectURL(a.url));
  state.videos.forEach(v => URL.revokeObjectURL(v.url));
  state.audios = []; state.videos = []; state.queue = []; state.doneBlobs = [];
  renderAudioList(); renderVideoSlots(); renderQueue(); updateStats();
  log('Tout effacé', 'warn');
}

function updateStats() {
  document.getElementById('statAudios').textContent = state.audios.length;
  document.getElementById('statVideos').textContent = state.videos.length;
  document.getElementById('statDone').textContent = state.queue.filter(q => q.status === 'done').length;
  document.getElementById('totalCount').textContent =
    `${state.audios.length} audio${state.audios.length > 1 ? 's' : ''} · ${state.videos.length} vidéo${state.videos.length > 1 ? 's' : ''}`;
}

function formatDur(s) {
  if (!s || isNaN(s) || s <= 0) return '--:--';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
}

function saveApiKey(val) {
  localStorage.setItem('googleApiKey', val.trim());
}

async function resampleAudio(audioBuffer, targetSampleRate) {
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetSampleRate), targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  return await offlineCtx.startRendering();
}

async function generateSubtitlesAPI(audioBuffer, apiKey) {
  const targetSampleRate = 16000;
  const resampledBuffer = await resampleAudio(audioBuffer, targetSampleRate);

  const chunkDuration = 55; // Google recommends slightly less than 60s
  const totalDuration = resampledBuffer.duration;
  let allSubtitles = [];

  for (let startOffset = 0; startOffset < totalDuration; startOffset += chunkDuration) {
    const endOffset = Math.min(startOffset + chunkDuration, totalDuration);
    let chunkLength = Math.ceil((endOffset - startOffset) * targetSampleRate);
    if (chunkLength === 0) continue;

    const chunkBuffer = new Float32Array(chunkLength);
    resampledBuffer.copyFromChannel(chunkBuffer, 0, Math.floor(startOffset * targetSampleRate));

    // Convert to LINEAR16
    const intBuffer = new Int16Array(chunkLength);
    for (let i = 0; i < chunkLength; i++) {
      let s = Math.max(-1, Math.min(1, chunkBuffer[i]));
      intBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Base64 encode in small batches to avoid stack overflow
    let binary = '';
    const bytes = new Uint8Array(intBuffer.buffer);
    for (let i = 0; i < bytes.byteLength; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    }
    const base64Audio = window.btoa(binary);

    const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: targetSampleRate,
          languageCode: 'fr-FR',
          alternativeLanguageCodes: ['en-US', 'en-GB', 'es-ES'],
          enableWordTimeOffsets: true,
        },
        audio: {
          content: base64Audio
        }
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    if (data.results) {
      data.results.forEach(result => {
        const alt = result.alternatives[0];
        if (alt && alt.words) {
          let currentPhrase = [];
          let phraseStartTime = 0;
          alt.words.forEach(wordInfo => {
            const start = parseFloat(wordInfo.startTime.replace('s', '')) + startOffset;
            const end = parseFloat(wordInfo.endTime.replace('s', '')) + startOffset;
            if (currentPhrase.length === 0) phraseStartTime = start;
            currentPhrase.push(wordInfo.word);

            if (currentPhrase.length >= 3) {
              allSubtitles.push({ start: phraseStartTime, end: end, text: currentPhrase.join(' ').toUpperCase() });
              currentPhrase = [];
            }
          });
          if (currentPhrase.length > 0) {
            const lastWord = alt.words[alt.words.length - 1];
            allSubtitles.push({ start: phraseStartTime, end: parseFloat(lastWord.endTime.replace('s', '')) + startOffset, text: currentPhrase.join(' ').toUpperCase() });
          }
        }
      });
    }
  }

  if (allSubtitles.length === 0) {
    throw new Error("Aucun mot reconnu (Vérifiez la langue ou la qualité de l'audio)");
  }

  return allSubtitles;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let logStart = Date.now();
function log(msg, type = 'info') {
  const box = document.getElementById('logBox');
  const elapsed = (Date.now() - logStart) / 1000;
  const ts = String(Math.floor(elapsed / 60)).padStart(2, '0') + ':' + String(Math.floor(elapsed % 60)).padStart(2, '0');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">${ts}</span><span class="log-msg ${type}">${msg}</span>`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

let notifTimer;
function notif(msg, type = 'info') {
  const colors = { ok: '#22c55e', warn: '#ff9f1c', err: '#ff3c5f', info: '#6b7280' };
  document.getElementById('notifDot').style.background = colors[type] || colors.info;
  document.getElementById('notifMsg').textContent = msg;
  const el = document.getElementById('notif');
  el.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ─── Init ─────────────────────────────────────────────────────
initVideoSlots();
updateSubPreview();
updateStats();

const savedKey = localStorage.getItem('googleApiKey');
if (savedKey) {
  document.getElementById('googleApiKeyInput').value = savedKey;
} else {
  const initKey = prompt("Veuillez entrer votre clé API Google pour la génération de sous-titres :");
  if (initKey) {
    saveApiKey(initKey);
    document.getElementById('googleApiKeyInput').value = initKey;
  }
}
