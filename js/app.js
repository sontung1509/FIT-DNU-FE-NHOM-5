// ============================================================
// app.js — Trang chủ mới (index.html) · nối MockAPI qua api.js
// Vanilla JS · dùng chung API (api.js) + Utils (utils.js)
// ============================================================
(function () {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from((r || document).querySelectorAll(s));

  // ── State ───────────────────────────────────────────────
  const audio = new Audio();
  audio.volume = 0.8;
  let allSongs = [];
  let allPlaylists = [];
  let queue = [];
  let currentIndex = -1;
  let heroPlaylistId = null;
  let queueDragIdx = -1;
  let currentSuggestItems = [];
  let suggestActive = -1;

  const esc      = (Utils && Utils.escapeHtml)     ? Utils.escapeHtml     : (s => s ?? '');
  const fmtDur   = (Utils && Utils.formatDuration) ? Utils.formatDuration : (s => s);
  const fmtPlays = (Utils && Utils.formatPlays)    ? Utils.formatPlays    : (n => n);
  const ph       = (Utils && Utils.albumPlaceholder) ? Utils.albumPlaceholder : (() => '');
  const toast    = (Utils && Utils.toast) ? Utils.toast : (m => console.log(m));

  const cover = s => s && s.cover ? s.cover : ph(0);

  // ── Render ──────────────────────────────────────────────
  function trackCard(s) {
    return `<article class="card" draggable="true" data-id="${s.id}">
      <div class="card-art">
        <img src="${cover(s)}" onerror="this.src='${ph(0)}'" alt="">
        <button class="card-play" aria-label="Phát"><i class="fa-solid fa-play"></i></button>
      </div>
      <h3 class="card-title">${esc(s.title)}</h3>
      <p class="card-sub">${esc(s.artist || 'Không rõ')}</p>
      <span class="card-plays"><i class="fa-solid fa-play"></i> ${fmtPlays(s.plays)}</span>
    </article>`;
  }
  function albumCard(p) {
    const art = p.displayCover || p.cover || ph(0);
    return `<article class="card" data-playlist="${p.id}">
      <div class="card-art">
        <img src="${art}" onerror="this.src='${ph(0)}'" alt="">
        <button class="card-play" aria-label="Phát"><i class="fa-solid fa-play"></i></button>
      </div>
      <h3 class="card-title">${esc(p.name)}</h3>
      <p class="card-sub">${Array.isArray(p.songs) ? p.songs.length : 0} bài hát</p>
    </article>`;
  }

  // Ảnh bìa playlist = ảnh của bài hát đầu tiên (fallback: cover playlist)
  function playlistCover(p, songMap) {
    const first = Array.isArray(p.songs) && p.songs.length ? songMap.get(String(p.songs[0])) : null;
    return (first && first.cover) ? first.cover : (p.cover || ph(0));
  }
  function artistCard(a) {
    return `<article class="artist-card" data-artist="${esc(a.name)}">
      <div class="artist-art"><img src="${a.cover || ph(0)}" onerror="this.src='${ph(0)}'" alt=""></div>
      <h3 class="artist-name">${esc(a.name)}</h3>
      <p class="artist-sub">Nghệ sĩ</p>
    </article>`;
  }
  const emptyHint = () => '<p class="empty-hint">Chưa có dữ liệu</p>';

  function uniqueArtists(songs) {
    const map = new Map();
    songs.forEach(s => {
      const name = (s.artist || '').trim();
      if (!name) return;
      if (!map.has(name)) map.set(name, { name, cover: s.artistAvatar || cover(s), hasAvatar: !!s.artistAvatar, plays: s.plays || 0 });
      else {
        const a = map.get(name);
        a.plays += s.plays || 0;
        if (!a.hasAvatar && s.artistAvatar) { a.cover = s.artistAvatar; a.hasAvatar = true; }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.plays - a.plays);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ── Player ──────────────────────────────────────────────
  function playSong(song) {
    if (!song) return;
    currentIndex = queue.findIndex(s => String(s.id) === String(song.id));
    audio.src = song.url || '';
    $('#nowTitle').textContent  = song.title  || '—';
    $('#nowArtist').textContent = song.artist || '—';
    $('#nowCover').src = cover(song);
    updateLikeBtn(song);
    highlightPlaying(song.id);
    const qp = $('#queuePanel'); if (qp && qp.classList.contains('show')) renderQueue();
    if (song.url) {
      audio.play().catch(() => {});
      if (API.incrementPlay) API.incrementPlay(song.id);
    } else {
      toast('⚠️ Bài hát này chưa có file nhạc', 'warning');
    }
  }
  function togglePlay() {
    if (!audio.src) { if (queue.length) playSong(queue[0]); return; }
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }
  function next() { if (queue.length) playSong(queue[(currentIndex + 1) % queue.length]); }
  function prev() { if (queue.length) playSong(queue[(currentIndex - 1 + queue.length) % queue.length]); }

  function highlightPlaying(id) {
    $$('.card[data-id]').forEach(c => c.classList.toggle('playing', c.dataset.id === String(id)));
  }
  function updateLikeBtn(song) {
    const favs = API.getFavorites ? API.getFavorites() : [];
    const liked = favs.includes(song.id);
    const btn = $('#likeBtn');
    btn.classList.toggle('liked', liked);
    btn.querySelector('i').className = liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
  }

  audio.addEventListener('play',  () => { $('#playIcon').className = 'fa-solid fa-pause'; $('#playerBar').classList.add('playing'); });
  audio.addEventListener('pause', () => { $('#playIcon').className = 'fa-solid fa-play';  $('#playerBar').classList.remove('playing'); });
  audio.addEventListener('ended', next);
  audio.addEventListener('loadedmetadata', () => { $('#durTime').textContent = fmtDur(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration * 100) : 0;
    $('#progressFill').style.width  = pct + '%';
    $('#progressHandle').style.left = pct + '%';
    $('#curTime').textContent = fmtDur(audio.currentTime);
  });

  // ── Load & render home ──────────────────────────────────
  async function loadHome() {
    let songs = [], playlists = [];
    try { [songs, playlists] = await Promise.all([API.getSongs(), API.getPlaylists()]); }
    catch (e) { console.error(e); toast('Không tải được dữ liệu', 'error'); return; }

    allSongs = songs;
    queue = songs;

    // Gắn ảnh bìa = bài hát đầu tiên cho từng playlist (không cần request thêm)
    const songMap = new Map(songs.map(s => [String(s.id), s]));
    playlists = playlists.map(p => ({ ...p, displayCover: playlistCover(p, songMap) }));
    allPlaylists = playlists;

    const byPlays = [...songs].sort((a, b) => (b.plays || 0) - (a.plays || 0));
    const byNew   = [...songs].sort((a, b) => Number(b.id) - Number(a.id));

    $('#trendingGrid').innerHTML = byPlays.slice(0, 10).map(trackCard).join('') || emptyHint();

    let recent = [];
    try { recent = await API.getRecentlyPlayed(10); } catch (e) {}
    if (!recent.length) recent = byNew.slice(0, 10);
    $('#recentRow').innerHTML = recent.map(trackCard).join('') || emptyHint();

    $('#recommendRow').innerHTML = shuffle([...songs]).slice(0, 10).map(trackCard).join('') || emptyHint();
    $('#albumsRow').innerHTML    = playlists.map(albumCard).join('') || emptyHint();
    $('#artistsRow').innerHTML   = uniqueArtists(songs).slice(0, 12).map(artistCard).join('') || emptyHint();
    $('#newRow').innerHTML       = byNew.slice(0, 10).map(trackCard).join('') || emptyHint();

    renderSidebarPlaylists(playlists);
    setupHero(playlists);
    bindCards();
    renderDock();
  }

  const dotColors = ['#ff5500', '#38BDF8', '#EF4444', '#F59E0B', '#A855F7', '#1DB954'];
  function renderSidebarPlaylists(playlists) {
    const ul = $('#sidebarPlaylists');
    if (!ul) return;
    ul.innerHTML = playlists.length
      ? playlists.map((p, i) => `<li data-playlist="${p.id}"><span class="dot" style="background:${dotColors[i % dotColors.length]}"></span>${esc(p.name)}</li>`).join('')
      : '<li class="empty-hint">Chưa có playlist</li>';
    $$('li[data-playlist]', ul).forEach(li => li.addEventListener('click', () => playPlaylist(li.dataset.playlist)));
  }

  function setupHero(playlists) {
    const top = playlists.slice().sort((a, b) => (b.plays || 0) - (a.plays || 0))[0];
    if (!top) return;
    heroPlaylistId = top.id;
    $('#heroTitle').textContent = top.name;
    $('#heroDesc').textContent  = top.description || `${Array.isArray(top.songs) ? top.songs.length : 0} bài hát tuyển chọn dành cho bạn.`;
    const art = top.displayCover || top.cover;
    if (art) $('#heroArt').src = art;
  }

  async function playPlaylist(id) {
    try {
      const pl = await API.getPlaylistById(id);
      const songs = (await Promise.all((pl.songs || []).map(sid => API.getSongById(sid).catch(() => null)))).filter(Boolean);
      if (!songs.length) { toast('Playlist chưa có bài hát', 'info'); return; }
      queue = songs;
      playSong(songs[0]);
    } catch (e) { toast('Không mở được playlist', 'error'); }
  }
  function playArtist(name) {
    const songs = allSongs.filter(s => (s.artist || '') === name);
    if (songs.length) { queue = songs; playSong(songs[0]); }
  }

  function bindCards(root = document) {
    $$('.card[data-id]', root).forEach(card => {
      card.addEventListener('click', () => {
        queue = queueFromContainer(card.parentElement);
        const s = allSongs.find(x => String(x.id) === String(card.dataset.id));
        if (s) playSong(s);
      });
      // Kéo bài hát để thả vào playlist
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
        showDock();
      });
      card.addEventListener('dragend', () => { card.classList.remove('dragging'); hideDock(); });
    });
    $$('.card[data-playlist]', root).forEach(card => {
      card.addEventListener('click', () => playPlaylist(card.dataset.playlist));
      makeDropTarget(card, card.dataset.playlist);
    });
    $$('.artist-card[data-artist]', root).forEach(card =>
      card.addEventListener('click', () => playArtist(card.dataset.artist)));
  }

  // Biến 1 phần tử thành nơi thả bài hát vào playlist
  function makeDropTarget(el, playlistId) {
    el.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', async e => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const songId = e.dataTransfer.getData('text/plain');
      hideDock();
      if (songId) await addSongToPlaylistUI(playlistId, songId);
    });
  }

  // ── Playlist dock (hiện khi kéo bài hát) ────────────────
  function createDock() {
    if ($('#plDock')) return;
    const dock = document.createElement('div');
    dock.className = 'pl-dock';
    dock.id = 'plDock';
    dock.innerHTML = `<div class="pl-dock-title"><i class="fa-solid fa-plus"></i> Thả bài hát vào playlist</div>
      <div class="pl-dock-list" id="plDockList"></div>`;
    document.body.appendChild(dock);
  }
  function renderDock() {
    const list = $('#plDockList');
    if (!list) return;
    list.innerHTML = allPlaylists.length
      ? allPlaylists.map(p => `<button class="pl-chip" data-playlist="${p.id}">
          <img src="${p.displayCover || p.cover || ph(0)}" onerror="this.src='${ph(0)}'" alt="">
          <span>${esc(p.name)}</span>
        </button>`).join('')
      : '<p class="empty-hint" style="padding:.4rem">Chưa có playlist</p>';
    $$('#plDockList .pl-chip').forEach(chip => makeDropTarget(chip, chip.dataset.playlist));
  }
  function showDock() { const d = $('#plDock'); if (d) d.classList.add('show'); }
  function hideDock() { const d = $('#plDock'); if (d) d.classList.remove('show'); }

  async function addSongToPlaylistUI(playlistId, songId) {
    const song = allSongs.find(s => String(s.id) === String(songId));
    try {
      const pl = await API.getPlaylistById(playlistId);
      if ((pl.songs || []).map(String).includes(String(songId))) {
        toast(`"${song ? song.title : 'Bài hát'}" đã có trong ${pl.name}`, 'info');
        return;
      }
      await API.addSongToPlaylist(playlistId, songId);
      toast(`✅ Đã thêm "${song ? song.title : ''}" vào ${pl.name}`, 'success');
      refreshPlaylists();
    } catch (e) {
      toast('Không thêm được vào playlist', 'error');
    }
  }

  async function refreshPlaylists() {
    try {
      const playlists = await API.getPlaylists();
      const songMap = new Map(allSongs.map(s => [String(s.id), s]));
      allPlaylists = playlists.map(p => ({ ...p, displayCover: playlistCover(p, songMap) }));
      const row = $('#albumsRow');
      if (row) { row.innerHTML = allPlaylists.map(albumCard).join('') || emptyHint(); bindCards(row); }
      renderDock();
    } catch (e) {}
  }
  function queueFromContainer(container) {
    return $$('.card[data-id]', container)
      .map(c => allSongs.find(s => String(s.id) === String(c.dataset.id)))
      .filter(Boolean);
  }

  // ── Static UI events ────────────────────────────────────
  function bindUI() {
    $('#playToggle').addEventListener('click', togglePlay);
    $('#nextBtn').addEventListener('click', next);
    $('#prevBtn').addEventListener('click', prev);

    $('#heroPlay').addEventListener('click', () => {
      if (heroPlaylistId) playPlaylist(heroPlaylistId);
      else if (queue.length) playSong(queue[0]);
    });
    $('#heroSave').addEventListener('click', function () {
      this.classList.toggle('saved');
      toast('Đã lưu playlist', 'success');
    });
    $('#likeBtn').addEventListener('click', () => {
      const song = queue[currentIndex];
      if (!song) return;
      const nowLiked = API.toggleFavorite(song.id);
      updateLikeBtn(song);
      toast(nowLiked ? '❤️ Đã thích' : 'Đã bỏ thích', nowLiked ? 'success' : 'info');
    });

    $('#progressTrack').addEventListener('click', e => {
      if (!audio.duration) return;
      const r = e.currentTarget.getBoundingClientRect();
      audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });
    $('#volumeTrack').addEventListener('click', e => {
      const r = e.currentTarget.getBoundingClientRect();
      const v = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      audio.volume = v;
      $('#volumeFill').style.width = (v * 100) + '%';
    });

    const closeNav = () => { const tb = $('.topbar'); if (tb) tb.classList.remove('nav-open'); };
    const mt = $('#menuToggle');
    if (mt) mt.addEventListener('click', () => { const tb = $('.topbar'); if (tb) tb.classList.toggle('nav-open'); });

    $$('.nav-link').forEach(link => link.addEventListener('click', e => {
      e.preventDefault();
      $$('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const sel = link.dataset.scroll;
      if (sel) { const el = $(sel); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else $('.content').scrollTo({ top: 0, behavior: 'smooth' });
      closeNav();
    }));

    const searchInput = $('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', renderSuggest);
      searchInput.addEventListener('focus', renderSuggest);
      searchInput.addEventListener('blur', () => setTimeout(hideSuggest, 130));
      searchInput.addEventListener('keydown', onSearchKeydown);
    }

    const qb = $('#queueBtn'); if (qb) qb.addEventListener('click', toggleQueue);
    $('#premiumBtn').addEventListener('click', () => toast('Tính năng đang phát triển 🚧', 'info'));
    const goAuth = () => {
      const s = API.getSession();
      window.location.href = s ? (s.role === 'admin' ? 'admin.html' : 'index.html') : 'login.html';
    };
    const av = $('#topbarAvatar'); if (av) av.addEventListener('click', goAuth);
    const su = $('#sidebarUser');  if (su) su.addEventListener('click', goAuth);
    const sc = $('#sidebarCreatePl'); if (sc) sc.addEventListener('click', () => toast('Tạo playlist ở trang Quản trị', 'info'));
  }

  // ── Danh sách chờ (queue) ───────────────────────────────
  function createQueuePanel() {
    if ($('#queuePanel')) return;
    const p = document.createElement('div');
    p.className = 'queue-panel';
    p.id = 'queuePanel';
    p.innerHTML = `<div class="queue-head">
        <span><i class="fa-solid fa-list-ul"></i> Danh sách chờ</span>
        <button class="icon-btn small" id="queueClose" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="queue-list" id="queueList"></div>`;
    document.body.appendChild(p);
    const close = $('#queueClose');
    if (close) close.addEventListener('click', () => p.classList.remove('show'));
  }
  function renderQueue() {
    const list = $('#queueList');
    if (!list) return;
    if (!queue.length) { list.innerHTML = '<p class="empty-hint" style="padding:.6rem">Chưa có bài nào trong hàng đợi</p>'; return; }
    list.innerHTML = queue.map((s, i) => `
      <div class="queue-item ${i === currentIndex ? 'active' : ''}" data-idx="${i}" draggable="true">
        <i class="fa-solid fa-grip-lines q-handle" aria-hidden="true"></i>
        <img src="${cover(s)}" onerror="this.src='${ph(0)}'" alt="">
        <div class="queue-meta">
          <span class="queue-title">${esc(s.title)}</span>
          <span class="queue-sub">${esc(s.artist || '')}</span>
        </div>
        ${i === currentIndex ? '<i class="fa-solid fa-volume-high q-playing"></i>' : ''}
        <button class="queue-remove" data-idx="${i}" aria-label="Xoá khỏi hàng đợi"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('');

    $$('#queueList .queue-item').forEach(it => {
      const idx = Number(it.dataset.idx);
      it.addEventListener('click', e => {
        if (e.target.closest('.queue-remove')) return;
        if (queue[idx]) playSong(queue[idx]);
      });
      // Kéo sắp xếp lại thứ tự
      it.addEventListener('dragstart', e => {
        queueDragIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/queue', String(idx));
        it.classList.add('q-dragging');
      });
      it.addEventListener('dragend', () => {
        queueDragIdx = -1;
        $$('#queueList .queue-item').forEach(x => x.classList.remove('q-dragging', 'q-over'));
      });
      it.addEventListener('dragover', e => {
        if (queueDragIdx < 0) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        it.classList.add('q-over');
      });
      it.addEventListener('dragleave', () => it.classList.remove('q-over'));
      it.addEventListener('drop', e => {
        if (queueDragIdx < 0) return;
        e.preventDefault(); e.stopPropagation();
        it.classList.remove('q-over');
        moveQueue(queueDragIdx, idx);
      });
    });

    $$('#queueList .queue-remove').forEach(btn =>
      btn.addEventListener('click', e => { e.stopPropagation(); removeFromQueue(Number(btn.dataset.idx)); }));
  }

  function moveQueue(from, to) {
    if (from < 0 || to < 0 || from === to || from >= queue.length || to >= queue.length) return;
    const currentId = queue[currentIndex] ? queue[currentIndex].id : null;
    const [moved] = queue.splice(from, 1);
    queue.splice(to, 0, moved);
    if (currentId != null) currentIndex = queue.findIndex(s => String(s.id) === String(currentId));
    renderQueue();
  }

  function removeFromQueue(idx) {
    if (idx < 0 || idx >= queue.length) return;
    const currentId = queue[currentIndex] ? queue[currentIndex].id : null;
    queue.splice(idx, 1);
    if (!queue.length) { currentIndex = -1; }
    else {
      const found = currentId != null ? queue.findIndex(s => String(s.id) === String(currentId)) : -1;
      currentIndex = found >= 0 ? found : Math.min(idx, queue.length - 1);
    }
    renderQueue();
  }
  function toggleQueue() {
    const p = $('#queuePanel');
    if (!p) return;
    const willShow = !p.classList.contains('show');
    p.classList.toggle('show');
    if (willShow) renderQueue();
  }

  // ── Gợi ý tìm kiếm (autocomplete dropdown) ──────────────
  function createSearchSuggest() {
    const box = $('.search-box');
    if (!box || $('#searchSuggest')) return;
    const d = document.createElement('div');
    d.className = 'search-suggest';
    d.id = 'searchSuggest';
    box.appendChild(d);
  }
  function highlightMatch(text, q) {
    const idx = (text || '').toLowerCase().indexOf(q);
    if (idx < 0) return esc(text);
    return esc(text.slice(0, idx)) + '<span class="q">' + esc(text.slice(idx, idx + q.length)) + '</span>' + esc(text.slice(idx + q.length));
  }
  function buildSuggestions(q) {
    const out = [], seen = new Set();
    allSongs.forEach(s => {
      if ((s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q)) {
        const k = 's' + s.id;
        if (!seen.has(k)) { seen.add(k); out.push({ type: 'song', id: s.id, text: s.title || '', sub: s.artist || '' }); }
      }
    });
    uniqueArtists(allSongs).forEach(a => {
      if (a.name.toLowerCase().includes(q)) {
        const k = 'a' + a.name;
        if (!seen.has(k)) { seen.add(k); out.push({ type: 'artist', name: a.name, text: a.name }); }
      }
    });
    return out.slice(0, 8);
  }
  function renderSuggest() {
    const box = $('#searchSuggest'), input = $('#searchInput');
    if (!box || !input) return;
    const q = input.value.trim().toLowerCase();
    suggestActive = -1;
    if (!q) { hideSuggest(); return; }
    const items = buildSuggestions(q);
    currentSuggestItems = items;
    if (!items.length) { hideSuggest(); return; }
    box.innerHTML = items.map((it, i) => `
      <div class="suggest-item" data-i="${i}">
        <div class="suggest-ic"><i class="fa-solid fa-magnifying-glass"></i></div>
        <span class="suggest-text">${highlightMatch(it.text, q)}</span>
        <span class="suggest-tag">${it.type === 'artist' ? 'Nghệ sĩ' : esc(it.sub)}</span>
      </div>`).join('');
    box.classList.add('show');
    $$('#searchSuggest .suggest-item').forEach(el =>
      el.addEventListener('mousedown', e => { e.preventDefault(); selectSuggest(Number(el.dataset.i)); }));
  }
  function paintActive() {
    const els = $$('#searchSuggest .suggest-item');
    els.forEach((el, i) => el.classList.toggle('active', i === suggestActive));
    if (suggestActive >= 0 && els[suggestActive]) els[suggestActive].scrollIntoView({ block: 'nearest' });
  }
  function selectSuggest(i) {
    const it = currentSuggestItems[i];
    if (!it) return;
    if (it.type === 'song') {
      const s = allSongs.find(x => String(x.id) === String(it.id));
      if (s) { queue = [...allSongs]; playSong(s); }
    } else {
      playArtist(it.name);
    }
    const input = $('#searchInput'); if (input) input.value = it.text;
    hideSuggest();
  }
  function hideSuggest() { const b = $('#searchSuggest'); if (b) b.classList.remove('show'); }
  function runGridSearch() {
    const input = $('#searchInput'); if (!input) return;
    const raw = input.value.trim(), q = raw.toLowerCase();
    const list = q
      ? allSongs.filter(s => (s.title || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q))
      : [...allSongs].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 10);
    const grid = $('#trendingGrid');
    if (grid) { grid.innerHTML = list.slice(0, 20).map(trackCard).join('') || '<p class="empty-hint">Không tìm thấy bài hát nào 🔍</p>'; bindCards(grid); }
    const title = $('#trending-title');
    if (title) { title.textContent = q ? `Kết quả cho "${raw}"` : 'Thịnh hành hôm nay'; if (q) title.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    hideSuggest();
  }
  function onSearchKeydown(e) {
    const box = $('#searchSuggest');
    const open = box && box.classList.contains('show');
    const els = $$('#searchSuggest .suggest-item');
    if (e.key === 'ArrowDown' && open) { e.preventDefault(); suggestActive = Math.min(suggestActive + 1, els.length - 1); paintActive(); }
    else if (e.key === 'ArrowUp' && open) { e.preventDefault(); suggestActive = Math.max(suggestActive - 1, 0); paintActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && suggestActive >= 0) selectSuggest(suggestActive); else runGridSearch(); }
    else if (e.key === 'Escape') { hideSuggest(); }
  }

  function bindCreatePlaylist() {
    const overlay = $('#createPlOverlay');
    const form = $('#createPlForm');
    if (!overlay || !form) return;

    const open  = () => { form.reset(); overlay.classList.add('show'); const n = $('#createPlName'); if (n) n.focus(); };
    const close = () => overlay.classList.remove('show');

    const btn = $('#createPlBtn'); if (btn) btn.addEventListener('click', open);
    const x   = $('#createPlClose'); if (x) x.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#createPlName').value.trim();
      const desc = $('#createPlDesc').value.trim();
      if (!name) { toast('Vui lòng nhập tên playlist', 'error'); return; }
      const submit = form.querySelector('.modal-submit');
      submit.disabled = true; submit.textContent = 'Đang tạo…';
      try {
        await API.createPlaylist({ name, description: desc });
        toast(`✅ Đã tạo playlist "${name}"`, 'success');
        close();
        refreshPlaylists();
      } catch (err) {
        toast('Không tạo được playlist', 'error');
      } finally {
        submit.disabled = false; submit.textContent = 'Tạo playlist';
      }
    });
  }

  function applySession() {
    const s = API.getSession && API.getSession();
    if (!s) return;
    const nameEl = $('#sidebarUserName'); if (nameEl) nameEl.textContent = s.name || s.email || 'Người dùng';
    const subEl  = $('#sidebarUserSub');  if (subEl)  subEl.textContent  = s.role === 'admin' ? 'Quản trị viên' : 'Xem hồ sơ';
    const av = $('#topbarAvatar'); if (av) av.title = s.name || s.email || 'Hồ sơ';
  }

  // ── Init ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof API === 'undefined') { console.error('api.js chưa được nạp'); return; }
    if (API.seed) API.seed();
    createDock();
    createQueuePanel();
    createSearchSuggest();
    bindUI();
    bindCreatePlaylist();
    applySession();
    loadHome();
  });
})();
