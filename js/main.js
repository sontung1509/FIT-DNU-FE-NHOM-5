// ============================================================
// main.js — Logic trang khách hàng (index.html)
// Stack: Vanilla JS + jQuery + Bootstrap 5 Modal
// ============================================================

// ─── State ───────────────────────────────────────────────────
const State = {
  songs:          [],
  playlists:      [],
  queue:          [],
  currentIndex:   -1,
  isPlaying:      false,
  volume:         0.8,
  isDragging:     false,
  searchQuery:    '',
};

// ─── Shortcut helpers ─────────────────────────────────────────
const $id  = id  => document.getElementById(id);
const $all = sel => document.querySelectorAll(sel);

// ─── Audio Visualizer ─────────────────────────────────────────
let audioCtx, analyser, animFrameId;

function initVisualizer(audioEl) {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser  = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    const src = audioCtx.createMediaElementSource(audioEl);
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    drawVisualizer();
  } catch(e) { console.warn('Visualizer unavailable:', e); }
}

function drawVisualizer() {
  const canvas = $id('visualizer-canvas');
  if (!canvas || !analyser) return;
  const ctx = canvas.getContext('2d');
  const buf = new Uint8Array(analyser.frequencyBinCount);
  function draw() {
    animFrameId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(buf);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bw = canvas.width / buf.length;
    buf.forEach((v, i) => {
      const h = (v / 255) * canvas.height;
      ctx.fillStyle = `hsla(${(i / buf.length) * 180 + 200},80%,60%,0.85)`;
      ctx.fillRect(i * bw, canvas.height - h, bw - 1, h);
    });
  }
  draw();
}

// ─── Player ───────────────────────────────────────────────────
const Player = (() => {
  const audio = new Audio();
  audio.volume = State.volume;
  let vizInit = false;

  function load(song, autoplay = true) {
    if (!song) return;
    State.currentIndex = State.queue.findIndex(s => s.id === song.id);
    audio.src = song.url || '';
    renderPlayerUI(song);
    if (autoplay) play();
    API.incrementPlay(song.id);
  }

  function play() {
    if (!vizInit) { initVisualizer(audio); vizInit = true; }
    audio.play().catch(() => {});
    State.isPlaying = true;
    updatePlayBtn();
    $id('player-bar').classList.add('player-active');
  }

  function pause()  { audio.pause(); State.isPlaying = false; updatePlayBtn(); }
  function toggle() { State.isPlaying ? pause() : play(); }

  function next() {
    if (!State.queue.length) return;
    State.currentIndex = (State.currentIndex + 1) % State.queue.length;
    load(State.queue[State.currentIndex]);
  }

  function prev() {
    if (!State.queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    State.currentIndex = (State.currentIndex - 1 + State.queue.length) % State.queue.length;
    load(State.queue[State.currentIndex]);
  }

  function seek(ratio) { if (audio.duration) audio.currentTime = ratio * audio.duration; }
  function setVolume(v) { audio.volume = State.volume = v; }

  // Cập nhật progress bar
  audio.addEventListener('timeupdate', () => {
    if (State.isDragging) return;
    const prog = audio.duration ? audio.currentTime / audio.duration : 0;
    const bar  = $id('progress-bar');
    if (bar)  bar.style.setProperty('--prog', (prog * 100) + '%');
    const cur = $id('current-time');
    if (cur) cur.textContent = Utils.formatDuration(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    const dur = $id('duration');
    if (dur) dur.textContent = Utils.formatDuration(audio.duration);
  });

  audio.addEventListener('ended', next);

  function updatePlayBtn() {
    const btn = $id('play-pause-btn');
    if (!btn) return;
    btn.innerHTML = State.isPlaying
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`;
  }

  function renderPlayerUI(song) {
    const img    = $id('player-cover');
    const title  = $id('player-title');
    const artist = $id('player-artist');
    if (img)    { img.src = song.cover || Utils.albumPlaceholder(0); img.style.display = 'block'; }
    if (title)  title.textContent  = song.title;
    if (artist) artist.textContent = song.artist;
    // Highlight dòng đang phát
    $all('.song-row').forEach(r =>
      r.classList.toggle('song-playing', r.dataset.id === song.id));
  }

  return { load, play, pause, toggle, next, prev, seek, setVolume };
})();

// ─── Render: Song Row ─────────────────────────────────────────
function renderSongRow(song, idx) {
  const fav = API.getFavorites().includes(song.id);
  return `
  <div class="song-row fade-in" data-id="${song.id}" data-idx="${idx}"
       draggable="true" style="animation-delay:${idx * 0.04}s">
    <div class="song-num">${idx + 1}</div>
    <img class="song-cover" src="${song.cover}"
         onerror="this.src='${Utils.albumPlaceholder(idx)}'"
         alt="${Utils.escapeHtml(song.title)}">
    <div class="song-info">
      <div class="song-title">${Utils.escapeHtml(song.title)}</div>
      <div class="song-artist">${Utils.escapeHtml(song.artist)}</div>
    </div>
    <div class="song-album hide-sm">${Utils.escapeHtml(song.album || '')}</div>
    <div class="song-plays hide-sm">${Utils.formatPlays(song.plays)}</div>
    <div class="song-duration">${Utils.formatDuration(song.duration)}</div>
    <button class="fav-btn ${fav ? 'fav-active' : ''}" data-song="${song.id}" title="Yêu thích">
      <svg viewBox="0 0 24 24" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
    <button class="add-pl-btn" data-song="${song.id}" title="Thêm vào playlist">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  </div>`;
}

// ─── Render: Playlist Card ────────────────────────────────────
function renderPlaylistCard(pl) {
  const count = pl.songs?.length || 0;
  return `
  <div class="playlist-card fade-in" data-id="${pl.id}">
    <div class="playlist-card-img-wrap">
      <img src="${pl.cover}" alt="${Utils.escapeHtml(pl.name)}"
           onerror="this.src='${Utils.albumPlaceholder(0)}'">
      <button class="playlist-play-overlay" data-id="${pl.id}">
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
    </div>
    <div class="playlist-card-body">
      <div class="playlist-card-name">${Utils.escapeHtml(pl.name)}</div>
      <div class="playlist-card-meta">${count} bài · ${Utils.formatPlays(pl.plays)} lượt</div>
    </div>
  </div>`;
}

// ─── Section Loaders ──────────────────────────────────────────
async function loadTrendingSongs() {
  const container = $id('trending-songs');
  if (!container) return;
  container.innerHTML = Utils.skeletonCards(6, true);

  const songs = await API.getSongs(State.searchQuery);
  State.songs = songs;
  State.queue  = songs;

  container.innerHTML = songs.length
    ? songs.map(renderSongRow).join('')
    : `<div class="empty-state"><div class="empty-icon">🎵</div><p>Không tìm thấy bài hát nào.</p></div>`;

  bindSongRowEvents(container);
}

async function loadPlaylists() {
  const grid = $id('playlists-grid');
  if (!grid) return;
  grid.innerHTML = Utils.skeletonCards(4);

  const playlists = await API.getPlaylists();
  State.playlists = playlists;

  grid.innerHTML = playlists.length
    ? playlists.map(renderPlaylistCard).join('')
    : `<div class="empty-state"><div class="empty-icon">🎶</div><p>Chưa có playlist nào.</p></div>`;

  bindPlaylistCardEvents(grid);

  // Sidebar list (dùng jQuery)
  const $sideList = $('#sidebar-playlists');
  if ($sideList.length) {
    $sideList.html(playlists.map(p => `
      <li class="sidebar-pl-item" data-id="${p.id}">
        <img src="${p.cover}" onerror="this.src='${Utils.albumPlaceholder(0)}'">
        <span>${Utils.escapeHtml(p.name)}</span>
      </li>`).join(''));

    $sideList.find('.sidebar-pl-item').on('click', function() {
      openPlaylistDetail($(this).data('id'));
    });
  }
}

async function loadRecentlyPlayed() {
  const container = $id('recently-played');
  if (!container) return;
  const songs = await API.getRecentlyPlayed(6);
  container.innerHTML = songs.length
    ? songs.map(renderSongRow).join('')
    : `<div class="empty-state"><div class="empty-icon">⏱</div><p>Chưa có lịch sử phát.</p></div>`;
  if (songs.length) bindSongRowEvents(container);
}

// ─── Playlist Detail ──────────────────────────────────────────
async function openPlaylistDetail(id) {
  const pl = await API.getPlaylistById(id);
  if (!pl) return;

  const songList = await Promise.all((pl.songs || []).map(sid => API.getSongById(sid).catch(() => null)));
  const valid    = songList.filter(Boolean);

  $id('modal-pl-name').textContent   = pl.name;
  $id('modal-pl-desc').textContent   = pl.description || '';
  $id('modal-pl-cover').src          = pl.cover;
  $id('modal-pl-count').textContent  = `${valid.length} bài hát`;
  $id('modal-pl-plays').textContent  = Utils.formatPlays(pl.plays) + ' lượt';

  const songContainer = $id('modal-pl-songs');
  songContainer.innerHTML = valid.length
    ? valid.map(renderSongRow).join('')
    : `<div class="empty-state"><div class="empty-icon">🎵</div><p>Playlist chưa có bài hát.</p></div>`;
  if (valid.length) bindSongRowEvents(songContainer);

  $id('modal-play-all').onclick = () => {
    State.queue = valid;
    Player.load(valid[0]);
    Utils.closeModal('playlist-modal');
  };

  Utils.openModal('playlist-modal');
}

// ─── Bind: Song Row Events ────────────────────────────────────
function bindSongRowEvents(container) {
  // Dùng jQuery event delegation
  $(container)
    // Double click → phát
    .on('dblclick', '.song-row', function() {
      const id   = $(this).data('id');
      const song = State.songs.find(s => s.id === id) || State.queue.find(s => s.id === id);
      if (!song) return;
      State.queue = State.songs.length ? State.songs : State.queue;
      Player.load(song);
    })
    // Yêu thích
    .on('click', '.fav-btn', function(e) {
      e.stopPropagation();
      const sid   = $(this).data('song');
      const added = API.toggleFavorite(sid);
      $(this).toggleClass('fav-active', added);
      $(this).find('path').attr('fill', added ? 'currentColor' : 'none');
      Utils.toast(added ? '❤️ Đã thêm yêu thích' : '💔 Đã bỏ yêu thích', added ? 'success' : 'info');
    })
    // Thêm vào playlist
    .on('click', '.add-pl-btn', function(e) {
      e.stopPropagation();
      openAddToPlaylistModal($(this).data('song'));
    });

  // Drag & drop (native)
  container.querySelectorAll('.song-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      e.dataTransfer.setData('songId', row.dataset.id);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
  });
}

// ─── Bind: Playlist Card Events ───────────────────────────────
function bindPlaylistCardEvents(container) {
  $(container)
    .on('click', '.playlist-card', function() {
      openPlaylistDetail($(this).data('id'));
    })
    .on('click', '.playlist-play-overlay', async function(e) {
      e.stopPropagation();
      const pl   = await API.getPlaylistById($(this).data('id'));
      const songs = await Promise.all((pl.songs || []).map(s => API.getSongById(s).catch(() => null)));
      const valid = songs.filter(Boolean);
      if (!valid.length) { Utils.toast('Playlist chưa có bài hát', 'info'); return; }
      State.queue = valid;
      Player.load(valid[0]);
    });

  // Drag & Drop vào playlist card
  container.querySelectorAll('.playlist-card').forEach(card => {
    card.addEventListener('dragover',  e => { e.preventDefault(); card.classList.add('drop-target'); });
    card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
    card.addEventListener('drop', async e => {
      e.preventDefault();
      card.classList.remove('drop-target');
      const songId = e.dataTransfer.getData('songId');
      if (!songId) return;
      await API.addSongToPlaylist(card.dataset.id, songId);
      Utils.toast('🎵 Đã thêm vào playlist!', 'success');
      loadPlaylists();
    });
  });
}

// ─── Add to Playlist Modal ────────────────────────────────────
async function openAddToPlaylistModal(songId) {
  const $list = $('#add-pl-list');
  $list.html(State.playlists.map(p => `
    <button class="add-pl-option" data-pl="${p.id}" data-song="${songId}">
      <img src="${p.cover}" onerror="this.src='${Utils.albumPlaceholder(0)}'">
      <span>${Utils.escapeHtml(p.name)}</span>
    </button>`).join(''));

  $list.find('.add-pl-option').on('click', async function() {
    await API.addSongToPlaylist($(this).data('pl'), $(this).data('song'));
    Utils.toast('🎵 Đã thêm vào playlist!', 'success');
    Utils.closeModal('add-to-playlist-modal');
  });

  Utils.openModal('add-to-playlist-modal');
}

// ─── Player Bar ───────────────────────────────────────────────
function initPlayerBar() {
  $id('play-pause-btn')?.addEventListener('click', () => Player.toggle());
  $id('next-btn')?.addEventListener('click',       () => Player.next());
  $id('prev-btn')?.addEventListener('click',       () => Player.prev());

  // Progress scrubbing
  const bar = $id('progress-bar');
  if (bar) {
    bar.addEventListener('mousedown', e => {
      State.isDragging = true;
      const move = ev => {
        const ratio = Math.min(1, Math.max(0, ev.offsetX / bar.offsetWidth));
        bar.style.setProperty('--prog', ratio * 100 + '%');
      };
      bar.addEventListener('mousemove', move);
      window.addEventListener('mouseup', ev => {
        const ratio = Math.min(1, Math.max(0, ev.offsetX / bar.offsetWidth));
        Player.seek(ratio);
        State.isDragging = false;
        bar.removeEventListener('mousemove', move);
      }, { once: true });
    });
  }

  // Volume — jQuery
  $('#volume-slider').on('input', function() {
    Player.setVolume($(this).val() / 100);
  });
}

// ─── Create Playlist Form ─────────────────────────────────────
function initCreatePlaylist() {
  $('#create-pl-form').on('submit', async function(e) {
    e.preventDefault();
    const name = $('#pl-name-input').val().trim();
    const desc = $('#pl-desc-input').val().trim();
    if (!name) return Utils.toast('Nhập tên playlist', 'error');
    await API.createPlaylist({ name, description: desc });
    Utils.toast('✨ Đã tạo playlist!', 'success');
    Utils.closeModal('create-playlist-modal');
    this.reset();
    loadPlaylists();
  });
}

// ─── Search ───────────────────────────────────────────────────
function initSearch() {
  $('#search-input').on('input', Utils.debounce(async function() {
    State.searchQuery = $(this).val().trim();
    await loadTrendingSongs();
    document.getElementById('trending-section')?.scrollIntoView({ behavior: 'smooth' });
  }, 400));
}

// ─── Sidebar ──────────────────────────────────────────────────
function initSidebar() {
  $('#sidebar-toggle').on('click', () => {
    $('#sidebar').toggleClass('sidebar-open');
  });

  $('[data-section]').on('click', function() {
    const target = document.querySelector($(this).data('section'));
    target?.scrollIntoView({ behavior: 'smooth' });
    $('[data-section]').removeClass('active');
    $(this).addClass('active');
    $('#sidebar').removeClass('sidebar-open');
  });
}

// ─── Init ─────────────────────────────────────────────────────
async function init() {
  API.seed();
  initSidebar();
  initPlayerBar();
  initSearch();
  initCreatePlaylist();

  // Ripple effect trên tất cả btn-ripple
  $all('.btn-ripple').forEach(Utils.addRipple);

  // Load dữ liệu song song
  await Promise.all([
    loadTrendingSongs(),
    loadPlaylists(),
  ]);

  // Recently played không cần chờ
  loadRecentlyPlayed();
}

// Khởi động sau khi DOM sẵn sàng (jQuery)
$(document).ready(init);