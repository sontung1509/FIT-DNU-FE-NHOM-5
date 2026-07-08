// ============================================================
// admin.js — Logic trang quản trị (admin.html)
// Stack: Vanilla JS + jQuery + Bootstrap 5
// ============================================================

// ── Cloudinary config ─────────────────────────────────────────
// Điền thông tin tài khoản Cloudinary của bạn vào đây:
const CLOUDINARY = {
  cloudName:    'dupj3qqho', // ✅ đã cấu hình
  uploadPreset: 'playlistmaker', // ✅ đã cấu hình
};

// ── State ─────────────────────────────────────────────────────
const AdminState = {
  songs:        [],
  playlists:    [],
  artists:      [],
  editingSongId:     null,   // null = thêm mới, string = đang sửa
  editingPlaylistId: null,
  editingArtistName: null,
};

const $id  = id  => document.getElementById(id);
const $all = sel => document.querySelectorAll(sel);

// Ảnh bìa playlist = ảnh bài hát đầu tiên (fallback: cover playlist)
function playlistDisplayCover(p, songMap) {
  const first = Array.isArray(p.songs) && p.songs.length ? songMap.get(String(p.songs[0])) : null;
  return (first && first.cover) ? first.cover : p.cover;
}

// ════════════════════════════════════════════════════════════
// LOGIN GATE
// ════════════════════════════════════════════════════════════
function checkAuth() {
  const user = API.getSession();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  if (user.role !== 'admin') {
    Utils.toast('Bạn không có quyền truy cập!', 'error');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    return false;
  }
  const nameEl = $id('admin-name');
  if (nameEl) nameEl.textContent = user.name || user.email;
  return true;
}

function showLoginOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'login-overlay';
  overlay.id = 'login-overlay';
  overlay.innerHTML = `
    <div class="login-box glass-card">
      <div class="login-logo">🎵</div>
      <h4 style="font-weight:800;margin-bottom:.25rem">PlaylistMaker</h4>
      <p style="color:var(--text-secondary);font-size:.85rem;margin-bottom:1.5rem">Đăng nhập để tiếp tục</p>
      <div class="mb-3 text-start">
        <label class="form-label">Email</label>
        <input type="email" id="login-email" class="form-control"
               placeholder="admin@playlistmaker.app" value="admin@playlistmaker.app" />
      </div>
      <div class="mb-4 text-start">
        <label class="form-label">Mật khẩu</label>
        <input type="password" id="login-password" class="form-control"
               placeholder="••••••••" value="admin123" />
      </div>
      <button id="login-submit" class="btn btn-accent btn-ripple w-100">Đăng nhập</button>
      <div id="login-error" class="mt-2 text-danger small" style="min-height:1.2em"></div>
    </div>`;
  document.body.appendChild(overlay);

  Utils.addRipple($id('login-submit'));

  $('#login-submit').on('click', async function () {
    const email    = $('#login-email').val().trim();
    const password = $('#login-password').val();
    $(this).prop('disabled', true).text('Đang xử lý…');
    $id('login-error').textContent = '';
    try {
      const user = await API.login(email, password);
      overlay.remove();
      $id('admin-name').textContent = user.name || user.email;
      initAdmin(); // Khởi động admin sau khi đăng nhập
    } catch (err) {
      $id('login-error').textContent = err.message || 'Đăng nhập thất bại';
      $(this).prop('disabled', false).text('Đăng nhập');
    }
  });

  // Enter để submit
  $('#login-email, #login-password').on('keydown', function (e) {
    if (e.key === 'Enter') $('#login-submit').trigger('click');
  });
}

// ════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ════════════════════════════════════════════════════════════
function initTabs() {
  $('[data-tab]').on('click', function () {
    const tab = $(this).data('tab');

    // Active tab button
    $('[data-tab]').removeClass('tab-active');
    $(this).addClass('tab-active');

    // Active page
    $('[data-page]').removeClass('page-active');
    $(`[data-page="${tab}"]`).addClass('page-active');

    // Lazy load khi chuyển tab
    if (tab === 'songs')     loadSongsTable();
    if (tab === 'playlists') loadPlaylistsTable();
    if (tab === 'artists')   loadArtistsTable();
    if (tab === 'dashboard') loadDashboard();
  });
}

// ════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════
async function loadDashboard() {
  try {
    const stats = await API.getStats();
    AdminState.songs     = stats.songs;
    AdminState.playlists = stats.playlists;

    // Stat cards
    $id('stat-songs').textContent     = stats.totalSongs;
    $id('stat-playlists').textContent = stats.totalPlaylists;
    $id('stat-plays').textContent     = Utils.formatPlays(stats.totalPlays);
    $id('stat-top').textContent       = stats.topPlaylist;

    // Genre chart
    renderGenreChart(stats.songs);

    // Top playlists table (ảnh bìa = bài hát đầu tiên)
    renderTopPlaylists(stats.playlists, stats.songs);

  } catch (err) {
    console.error('Dashboard error:', err);
    Utils.toast('Không tải được dữ liệu dashboard', 'error');
  }
}

function renderGenreChart(songs) {
  const container = $id('genre-chart');
  if (!container) return;

  // Đếm theo thể loại
  const counts = {};
  songs.forEach(s => {
    const g = s.genre || 'Khác';
    counts[g] = (counts[g] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max    = sorted[0]?.[1] || 1;

  container.innerHTML = sorted.map(([genre, count]) => `
    <div class="chart-row">
      <div class="chart-label">${Utils.escapeHtml(genre)}</div>
      <div class="chart-bar-wrap">
        <div class="chart-bar" style="width:${(count / max * 100).toFixed(1)}%"></div>
      </div>
      <div class="chart-val">${count}</div>
    </div>`).join('') || '<p style="color:var(--text-muted);font-size:.85rem">Không có dữ liệu</p>';
}

function renderTopPlaylists(playlists, songs = []) {
  const tbody = $id('top-playlists-table');
  if (!tbody) return;

  const songMap = new Map(songs.map(s => [String(s.id), s]));
  const sorted = [...playlists].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 5);

  tbody.innerHTML = sorted.length
    ? sorted.map((p, i) => `
        <tr>
          <td style="color:var(--text-muted)">${i + 1}</td>
          <td>
            <img class="tbl-cover" src="${playlistDisplayCover(p, songMap)}" onerror="this.src='${Utils.albumPlaceholder(i)}'" alt="">
            ${Utils.escapeHtml(p.name)}
          </td>
          <td>${Array.isArray(p.songs) ? p.songs.length : 0}</td>
          <td>${Utils.formatPlays(p.plays)}</td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="tbl-loading">Chưa có playlist</td></tr>`;
}

// ════════════════════════════════════════════════════════════
// SONGS TABLE
// ════════════════════════════════════════════════════════════
async function loadSongsTable(query = '') {
  const tbody = $id('songs-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" class="tbl-loading">${Utils.skeletonCards(1)}</td></tr>`;

  try {
    const songs = await API.getSongs(query);
    AdminState.songs = songs;
    renderSongsTable(songs);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="tbl-loading" style="color:#ef4444">Lỗi tải dữ liệu</td></tr>`;
  }
}

function renderSongsTable(songs) {
  const tbody = $id('songs-tbody');
  if (!tbody) return;

  if (!songs.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="tbl-loading">Không có bài hát nào</td></tr>`;
    return;
  }

  tbody.innerHTML = songs.map(s => `
    <tr>
      <td><img class="tbl-cover" src="${s.cover}" onerror="this.src='${Utils.albumPlaceholder(0)}'" alt=""></td>
      <td style="font-weight:600">${Utils.escapeHtml(s.title)}</td>
      <td>${Utils.escapeHtml(s.artist || '—')}</td>
      <td>${Utils.escapeHtml(s.album  || '—')}</td>
      <td><span style="background:rgba(255,255,255,0.1);color:var(--text-primary);padding:2px 8px;border-radius:999px;font-size:.75rem">${Utils.escapeHtml(s.genre || '—')}</span></td>
      <td>${Utils.formatDuration(s.duration)}</td>
      <td>${Utils.formatPlays(s.plays)}</td>
      <td>
        <button class="btn-tbl-edit"   data-id="${s.id}" title="Sửa">✏️</button>
        <button class="btn-tbl-delete" data-id="${s.id}" title="Xóa">🗑️</button>
      </td>
    </tr>`).join('');

  // Bind events
  tbody.querySelectorAll('.btn-tbl-edit').forEach(btn =>
    btn.addEventListener('click', () => openSongModal(btn.dataset.id)));
  tbody.querySelectorAll('.btn-tbl-delete').forEach(btn =>
    btn.addEventListener('click', () => deleteSong(btn.dataset.id)));
}

// ─── Song Modal (Add / Edit) ──────────────────────────────
function openSongModal(songId = null) {
  AdminState.editingSongId = songId;
  const isEdit = !!songId;

  $id('song-modal-title').textContent = isEdit ? 'Chỉnh sửa bài hát' : 'Thêm bài hát';
  $id('song-submit-btn').textContent  = isEdit ? 'Cập nhật' : 'Lưu bài hát';

  // Reset form
  $id('song-form').reset();
  $id('cover-preview').style.display = 'none';
  $id('audio-upload-status').textContent = '';

  if (isEdit) {
    const song = AdminState.songs.find(s => s.id === songId);
    if (song) {
      $id('song-title-input').value    = song.title    || '';
      $id('song-artist-input').value   = song.artist   || '';
      $id('song-album-input').value    = song.album    || '';
      $id('song-genre-input').value    = song.genre    || '';
      $id('song-duration-input').value = song.duration || '';
      $id('song-url-input').value      = song.url      || '';
      if (song.cover && song.cover.startsWith('http')) {
        $id('song-cover-url-input').value = song.cover;
        showCoverPreview(song.cover, 'cover-preview');
      }
    }
  }

  Utils.openModal('song-modal');
}

async function saveSong(e) {
  e.preventDefault();

  const valid = Utils.validateForm([
    { el: $id('song-title-input'),    rules: ['required'] },
    { el: $id('song-artist-input'),   rules: ['required'] },
    { el: $id('song-duration-input'), rules: ['required', 'number'] },
  ]);
  if (!valid) return;

  const btn = $id('song-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Đang lưu…';

  try {
    // Upload ảnh bìa nếu có file
    let coverUrl = $id('song-cover-url-input').value.trim() || null;
    const coverFile = $id('song-cover-file').files[0];
    if (coverFile) {
      coverUrl = await uploadToCloudinary(coverFile, 'image');
    }

    // Upload nhạc nếu có file
    let audioUrl = $id('song-url-input').value.trim() || null;
    const audioFile = $id('song-audio-file').files[0];
    if (audioFile) {
      $id('audio-upload-status').textContent = '⬆️ Đang upload nhạc…';
      audioUrl = await uploadToCloudinary(audioFile, 'auto');
      $id('audio-upload-status').textContent = '✅ Upload xong!';
    }

    const payload = {
      title:    $id('song-title-input').value.trim(),
      artist:   $id('song-artist-input').value.trim(),
      album:    $id('song-album-input').value.trim(),
      genre:    $id('song-genre-input').value.trim(),
      duration: Number($id('song-duration-input').value),
      ...(coverUrl && { cover: coverUrl }),
      ...(audioUrl && { url:   audioUrl }),
    };

    if (AdminState.editingSongId) {
      await API.updateSong(AdminState.editingSongId, payload);
      Utils.toast('✅ Đã cập nhật bài hát!', 'success');
    } else {
      await API.createSong(payload);
      Utils.toast('✅ Đã thêm bài hát!', 'success');
    }

    Utils.closeModal('song-modal');
    loadSongsTable();
    loadDashboard();

  } catch (err) {
    Utils.toast('Lỗi: ' + (err.message || 'Không lưu được'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = AdminState.editingSongId ? 'Cập nhật' : 'Lưu bài hát';
  }
}

async function deleteSong(id) {
  const song = AdminState.songs.find(s => s.id === id);
  if (!confirm(`Xóa bài hát "${song?.title || id}"?`)) return;
  try {
    await API.deleteSong(id);
    Utils.toast('🗑️ Đã xóa bài hát', 'info');
    loadSongsTable();
    loadDashboard();
  } catch (err) {
    Utils.toast('Lỗi xóa: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
// PLAYLISTS TABLE
// ════════════════════════════════════════════════════════════
async function loadPlaylistsTable() {
  const tbody = $id('playlists-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" class="tbl-loading">Đang tải…</td></tr>`;

  try {
    const [playlists, songs] = await Promise.all([API.getPlaylists(), API.getSongs()]);
    AdminState.playlists = playlists;
    AdminState.songs = songs;
    renderPlaylistsTable(playlists, songs);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="tbl-loading" style="color:#ef4444">Lỗi tải dữ liệu</td></tr>`;
  }
}

function renderPlaylistsTable(playlists, songs = []) {
  const tbody = $id('playlists-tbody');
  if (!tbody) return;

  if (!playlists.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="tbl-loading">Chưa có playlist nào</td></tr>`;
    return;
  }

  const songMap = new Map(songs.map(s => [String(s.id), s]));

  tbody.innerHTML = playlists.map(p => `
    <tr>
      <td><img class="tbl-cover" src="${playlistDisplayCover(p, songMap)}" onerror="this.src='${Utils.albumPlaceholder(0)}'" alt=""></td>
      <td style="font-weight:600">${Utils.escapeHtml(p.name)}</td>
      <td style="color:var(--text-secondary)">${Utils.escapeHtml(p.description || '—')}</td>
      <td>${Array.isArray(p.songs) ? p.songs.length : 0} bài</td>
      <td>${Utils.formatPlays(p.plays)}</td>
      <td>
        <button class="btn-tbl-edit"   data-id="${p.id}" title="Sửa">✏️</button>
        <button class="btn-tbl-delete" data-id="${p.id}" title="Xóa">🗑️</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.btn-tbl-edit').forEach(btn =>
    btn.addEventListener('click', () => openPlaylistModal(btn.dataset.id)));
  tbody.querySelectorAll('.btn-tbl-delete').forEach(btn =>
    btn.addEventListener('click', () => deletePlaylist(btn.dataset.id)));
}

// ─── Playlist Modal (Add / Edit) ─────────────────────────
function openPlaylistModal(playlistId = null) {
  AdminState.editingPlaylistId = playlistId;
  const isEdit = !!playlistId;

  $id('pl-modal-title').textContent  = isEdit ? 'Chỉnh sửa Playlist' : 'Tạo Playlist';
  $id('pl-submit-btn').textContent   = isEdit ? 'Cập nhật' : 'Lưu Playlist';

  $id('playlist-form-admin').reset();
  $id('pl-cover-preview').style.display = 'none';

  if (isEdit) {
    const pl = AdminState.playlists.find(p => p.id === playlistId);
    if (pl) {
      $id('pl-name-input-admin').value = pl.name        || '';
      $id('pl-desc-input-admin').value = pl.description || '';
      if (pl.cover && pl.cover.startsWith('http')) {
        $id('pl-cover-url-input').value = pl.cover;
        showCoverPreview(pl.cover, 'pl-cover-preview');
      }
    }
  }

  Utils.openModal('playlist-modal-admin');
}

async function savePlaylist(e) {
  e.preventDefault();

  const valid = Utils.validateForm([
    { el: $id('pl-name-input-admin'), rules: ['required'] },
  ]);
  if (!valid) return;

  const btn = $id('pl-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Đang lưu…';

  try {
    let coverUrl = $id('pl-cover-url-input').value.trim() || null;
    const coverFile = $id('pl-cover-file').files[0];
    if (coverFile) {
      coverUrl = await uploadToCloudinary(coverFile, 'image');
    }

    const payload = {
      name:        $id('pl-name-input-admin').value.trim(),
      description: $id('pl-desc-input-admin').value.trim(),
      ...(coverUrl && { cover: coverUrl }),
    };

    if (AdminState.editingPlaylistId) {
      await API.updatePlaylist(AdminState.editingPlaylistId, payload);
      Utils.toast('✅ Đã cập nhật playlist!', 'success');
    } else {
      await API.createPlaylist(payload);
      Utils.toast('✅ Đã tạo playlist!', 'success');
    }

    Utils.closeModal('playlist-modal-admin');
    loadPlaylistsTable();
    loadDashboard();

  } catch (err) {
    Utils.toast('Lỗi: ' + (err.message || 'Không lưu được'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = AdminState.editingPlaylistId ? 'Cập nhật' : 'Lưu Playlist';
  }
}

async function deletePlaylist(id) {
  const pl = AdminState.playlists.find(p => p.id === id);
  if (!confirm(`Xóa playlist "${pl?.name || id}"?`)) return;
  try {
    await API.deletePlaylist(id);
    Utils.toast('🗑️ Đã xóa playlist', 'info');
    loadPlaylistsTable();
    loadDashboard();
  } catch (err) {
    Utils.toast('Lỗi xóa: ' + err.message, 'error');
  }
}

// ════════════════════════════════════════════════════════════
// ARTISTS (suy ra từ trường artist của bài hát)
// ════════════════════════════════════════════════════════════
function groupArtists(songs) {
  const map = new Map();
  songs.forEach(s => {
    const name = (s.artist || '').trim();
    if (!name) return;
    if (!map.has(name)) {
      map.set(name, { name, avatar: s.artistAvatar || s.cover, hasAvatar: !!s.artistAvatar, count: 0, plays: 0 });
    }
    const a = map.get(name);
    a.count++;
    a.plays += Number(s.plays) || 0;
    if (!a.hasAvatar && s.artistAvatar) { a.avatar = s.artistAvatar; a.hasAvatar = true; }
  });
  return Array.from(map.values()).sort((a, b) => b.plays - a.plays);
}

async function loadArtistsTable(query = '') {
  const tbody = $id('artists-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="tbl-loading">Đang tải…</td></tr>`;
  try {
    const songs = await API.getSongs();
    AdminState.songs = songs;
    let artists = groupArtists(songs);
    if (query) {
      const q = query.toLowerCase();
      artists = artists.filter(a => a.name.toLowerCase().includes(q));
    }
    AdminState.artists = artists;
    renderArtistsTable(artists);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="tbl-loading" style="color:#ef4444">Lỗi tải dữ liệu</td></tr>`;
  }
}

function renderArtistsTable(artists) {
  const tbody = $id('artists-tbody');
  if (!tbody) return;

  if (!artists.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="tbl-loading">Không có nghệ sĩ nào</td></tr>`;
    return;
  }

  tbody.innerHTML = artists.map(a => `
    <tr>
      <td><img class="tbl-cover" style="border-radius:50%" src="${a.avatar}" onerror="this.src='${Utils.albumPlaceholder(0)}'" alt=""></td>
      <td style="font-weight:600">${Utils.escapeHtml(a.name)}</td>
      <td>${a.count} bài</td>
      <td>${Utils.formatPlays(a.plays)}</td>
      <td>
        <button class="btn-tbl-edit" data-name="${Utils.escapeHtml(a.name)}" title="Sửa">✏️</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('.btn-tbl-edit').forEach(btn =>
    btn.addEventListener('click', () => openArtistModal(btn.dataset.name)));
}

function openArtistModal(name) {
  AdminState.editingArtistName = name;
  const artist = (AdminState.artists || []).find(a => a.name === name);

  $id('artist-modal-title').textContent = 'Sửa nghệ sĩ: ' + name;
  $id('artist-form').reset();
  $id('artist-save-status').textContent = '';
  $id('artist-name-input').value = name;

  if (artist) {
    // chỉ đổ URL vào ô nếu là ảnh tuỳ chỉnh (http); ảnh placeholder thì bỏ trống
    if (artist.hasAvatar && artist.avatar && artist.avatar.startsWith('http')) {
      $id('artist-avatar-url-input').value = artist.avatar;
    }
    showCoverPreview(artist.avatar, 'artist-avatar-preview');
  } else {
    $id('artist-avatar-preview').style.display = 'none';
  }

  Utils.openModal('artist-modal');
}

async function saveArtist(e) {
  e.preventDefault();
  const oldName = AdminState.editingArtistName;
  const newName = $id('artist-name-input').value.trim();
  if (!newName) { Utils.toast('Tên nghệ sĩ không được để trống', 'error'); return; }

  const btn    = $id('artist-submit-btn');
  const status = $id('artist-save-status');
  btn.disabled = true; btn.textContent = 'Đang lưu…';

  try {
    // Ảnh: ưu tiên file upload, sau đó tới URL
    let avatarUrl = $id('artist-avatar-url-input').value.trim() || null;
    const file = $id('artist-avatar-file').files[0];
    if (file) {
      status.textContent = '⬆️ Đang upload ảnh…';
      avatarUrl = await uploadToCloudinary(file, 'image');
    }

    const patch = {};
    if (newName !== oldName) patch.artist = newName;
    if (avatarUrl)           patch.artistAvatar = avatarUrl;

    if (!Object.keys(patch).length) {
      Utils.toast('Chưa có thay đổi nào', 'info');
      Utils.closeModal('artist-modal');
      return;
    }

    const songs = (AdminState.songs || []).filter(s => (s.artist || '') === oldName);
    if (!songs.length) throw new Error('Không tìm thấy bài hát của nghệ sĩ này');

    status.textContent = `Đang cập nhật ${songs.length} bài hát…`;
    for (const s of songs) {
      await API.updateSong(s.id, patch);
    }

    Utils.toast('✅ Đã cập nhật nghệ sĩ!', 'success');
    Utils.closeModal('artist-modal');
    loadArtistsTable();
    loadDashboard();
  } catch (err) {
    Utils.toast('Lỗi: ' + (err.message || 'Không lưu được'), 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Lưu nghệ sĩ';
    status.textContent = '';
  }
}

function initArtistSearch() {
  $('#artists-search').on('input', Utils.debounce(function () {
    loadArtistsTable($(this).val().trim());
  }, 400));
}

// ════════════════════════════════════════════════════════════
// CLOUDINARY UPLOAD
// ════════════════════════════════════════════════════════════
async function uploadToCloudinary(file, resourceType = 'auto') {
  if (!CLOUDINARY.cloudName || !CLOUDINARY.uploadPreset) {
    throw new Error('Chưa cấu hình Cloudinary! Điền cloudName và uploadPreset vào admin.js');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY.uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Upload thất bại');
  }

  const data = await res.json();
  return data.secure_url;
}

// ════════════════════════════════════════════════════════════
// COVER PREVIEW
// ════════════════════════════════════════════════════════════
function showCoverPreview(src, previewId) {
  const img = $id(previewId);
  if (!img || !src) return;
  img.src = src;
  img.style.display = 'block';
  img.onerror = () => { img.style.display = 'none'; };
}

function initCoverPreviews() {
  // Song cover — file input
  $id('song-cover-file')?.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    showCoverPreview(url, 'cover-preview');
  });

  // Song cover — URL input
  $id('song-cover-url-input')?.addEventListener('input', Utils.debounce(function () {
    showCoverPreview(this.value.trim(), 'cover-preview');
  }, 600));

  // Playlist cover — file input
  $id('pl-cover-file')?.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    showCoverPreview(url, 'pl-cover-preview');
  });

  // Playlist cover — URL input
  $id('pl-cover-url-input')?.addEventListener('input', Utils.debounce(function () {
    showCoverPreview(this.value.trim(), 'pl-cover-preview');
  }, 600));

  // Artist avatar — file input
  $id('artist-avatar-file')?.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;
    showCoverPreview(URL.createObjectURL(file), 'artist-avatar-preview');
  });

  // Artist avatar — URL input
  $id('artist-avatar-url-input')?.addEventListener('input', Utils.debounce(function () {
    showCoverPreview(this.value.trim(), 'artist-avatar-preview');
  }, 600));
}

// ════════════════════════════════════════════════════════════
// CLOUDINARY BANNER (hiển thị nếu chưa cấu hình)
// ════════════════════════════════════════════════════════════
function checkCloudinaryConfig() {
  const banner = $id('cloudinary-banner');
  if (!banner) return;
  if (!CLOUDINARY.cloudName || !CLOUDINARY.uploadPreset) {
    banner.style.display = 'flex';
  }
}

// ════════════════════════════════════════════════════════════
// SEARCH (Songs tab)
// ════════════════════════════════════════════════════════════
function initSongSearch() {
  $('#songs-search').on('input', Utils.debounce(function () {
    loadSongsTable($(this).val().trim());
  }, 400));
}

// ════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════
function initLogout() {
  $id('logout-btn')?.addEventListener('click', async () => {
    await API.logout();
    Utils.toast('Đã đăng xuất', 'info');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  });
}

// ════════════════════════════════════════════════════════════
// INIT ADMIN (sau khi đã xác thực)
// ════════════════════════════════════════════════════════════
function initAdmin() {
  checkCloudinaryConfig();
  initTabs();
  initSongSearch();
  initArtistSearch();
  initLogout();
  initCoverPreviews();

  // Ripple buttons
  $all('.btn-ripple').forEach(Utils.addRipple);

  // Form submit handlers
  $id('song-form')?.addEventListener('submit', saveSong);
  $id('playlist-form-admin')?.addEventListener('submit', savePlaylist);
  $id('artist-form')?.addEventListener('submit', saveArtist);

  // Add buttons
  $id('add-song-btn')?.addEventListener('click',     () => openSongModal());
  $id('add-playlist-btn')?.addEventListener('click', () => openPlaylistModal());

  // Load dashboard ngay khi vào
  loadDashboard();
}

// ════════════════════════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════════════════════════
$(document).ready(function () {
  API.seed(); // seed demo data nếu chưa có

  if (checkAuth()) {
    initAdmin();
  }
  // Nếu chưa auth, showLoginOverlay() đã gọi initAdmin() sau khi login thành công
});