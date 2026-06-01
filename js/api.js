// ============================================================
// api.js — MockAPI.io · Fixed version
// Base: https://69fa248fc509a40d3aa3f70a.mockapi.io/api/v1
// ============================================================

const API = (() => {

  const BASE = 'https://69fa248fc509a40d3aa3f70a.mockapi.io/api/v1';

  const LOCAL = {
    favorites: 'pm_favorites',
    history:   'pm_history',
    session:   'pm_session',
    seeded:    'pm_seeded',
  };

  // ─── Helper: fetch wrapper ────────────────────────────────
  async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`API [${res.status}] ${path}: ${msg}`);
    }
    return res.json();
  }

  const readLocal  = k => JSON.parse(localStorage.getItem(k) || '[]');
  const writeLocal = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ─── Cover: dùng index 0-5, render SVG client-side ────────
  // Không lưu base64 lên MockAPI (quá dài → lỗi)
  function coverIndex(n) {
    return String(Number(n) % 6 || 0); // lưu "0".."5"
  }

  // Lấy cover từ song — luôn trả về ảnh hợp lệ, không bao giờ crash
  function resolveCover(song) {
    const c = String(song?.cover ?? song?.coverIndex ?? '0').trim();

    // Số 0-5 → SVG placeholder
    if (/^[0-5]$/.test(c)) return Utils.albumPlaceholder(Number(c));

    // URL hợp lệ (http/https)
    if (c.startsWith('http://') || c.startsWith('https://')) return c;

    // base64 data URL
    if (c.startsWith('data:')) return c;

    // Mọi giá trị rác khác (cover 207, cover%20X, ...) → fallback SVG
    // Dùng hash của chuỗi để chọn màu khác nhau cho mỗi bài
    const hash = c.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    return Utils.albumPlaceholder(hash % 6);
  }

  // ─── Seed dữ liệu mẫu ─────────────────────────────────────
  async function seed() {
    if (localStorage.getItem(LOCAL.seeded)) {
      // Kiểm tra nếu data cũ không có url → reset và seed lại
      try {
        const songs = await getSongs();
        const hasUrl = songs.some(s => s.url);
        if (songs.length > 0 && !hasUrl) {
          console.log('🔄 Data cũ không có URL nhạc, đang reset...');
          // Xóa toàn bộ bài hát cũ
          await Promise.all(songs.map(s => request('/songs/' + s.id, { method: 'DELETE' }).catch(() => {})));
          const playlists = await getPlaylists();
          await Promise.all(playlists.map(p => request('/playlists/' + p.id, { method: 'DELETE' }).catch(() => {})));
          localStorage.removeItem(LOCAL.seeded);
          localStorage.removeItem(LOCAL.history);
        } else {
          return;
        }
      } catch(e) { return; }
    }

    try {
      const songs = await getSongs();
      if (songs.length > 0) {
        localStorage.setItem(LOCAL.seeded, '1');
        return;
      }

      console.log('🌱 Đang seed dữ liệu mẫu lên MockAPI...');

      const DEMO_SONGS = [
        { title:'Neon Pulse',         artist:'Synthwave Rex',   album:'Midnight Drive',   duration:214, plays:1200000, genre:'Electronic', cover:'0', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'  },
        { title:'Blinding Lights',    artist:'Echo Chamber',    album:'After Hours',       duration:200, plays:3400000, genre:'Pop',         cover:'1', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'  },
        { title:'Velvet Underground', artist:'Lo-fi Beats',     album:'Study Vibes',       duration:185, plays:890000,  genre:'Lo-fi',       cover:'2', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'  },
        { title:'Purple Rain Dance',  artist:'Violet Dusk',     album:'Spectrum',          duration:238, plays:670000,  genre:'R&B',         cover:'3', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'  },
        { title:'Cosmic Drift',       artist:'Astral Project',  album:'Outer Space',       duration:312, plays:2100000, genre:'Ambient',     cover:'4', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3'  },
        { title:'Tokyo Nights',       artist:'City Pop Stars',  album:'Urban Legends',     duration:196, plays:1560000, genre:'City Pop',    cover:'5', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'  },
        { title:'Glass Heart',        artist:'Indie Rose',      album:'Fragile Things',    duration:224, plays:430000,  genre:'Indie',       cover:'0', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3'  },
        { title:'Midnight Groove',    artist:'Funk Factory',    album:'Groove Station',    duration:260, plays:780000,  genre:'Funk',        cover:'1', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3'  },
        { title:'Ethereal Sky',       artist:'Dream Weaver',    album:'Cloud Nine',        duration:198, plays:340000,  genre:'Dream Pop',   cover:'2', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'  },
        { title:'Bass Drop 9000',     artist:'EDM Crew',        album:'Festival Hits',     duration:175, plays:5600000, genre:'EDM',         cover:'3', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3' },
        { title:'Acoustic Morning',   artist:'Calm Strings',    album:'Sunrise Sessions',  duration:203, plays:920000,  genre:'Acoustic',    cover:'4', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3' },
        { title:'Retrowave Highway',  artist:'Outrun Boy',      album:'Neon Roads',        duration:287, plays:1830000, genre:'Retrowave',   cover:'5', url:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3' },
      ];

      // Tạo tuần tự để tránh rate limit
      const createdSongs = [];
      for (const s of DEMO_SONGS) {
        const created = await createSong(s);
        createdSongs.push(created);
        await new Promise(r => setTimeout(r, 100));
      }

      const ids = createdSongs.map(s => s.id);

      const DEMO_PLAYLISTS = [
        { name:'Chill Evening',     description:'Nhac thu gian buoi toi',    cover:'2', plays:45000,  songs: JSON.stringify([ids[2],ids[8],ids[10],ids[6]]) },
        { name:'Workout Fire',      description:'Bom mau tap gym',           cover:'3', plays:89000,  songs: JSON.stringify([ids[9],ids[1],ids[7],ids[11]]) },
        { name:'Late Night Drive',  description:'Nhac road trip dem khuya',  cover:'0', plays:62000,  songs: JSON.stringify([ids[0],ids[5],ids[11],ids[4]]) },
        { name:'Focus Mode',        description:'Nhac tap trung lam viec',   cover:'4', plays:31000,  songs: JSON.stringify([ids[2],ids[4],ids[8]]) },
      ];

      for (const p of DEMO_PLAYLISTS) {
        await createPlaylist(p);
        await new Promise(r => setTimeout(r, 100));
      }

      localStorage.setItem(LOCAL.seeded, '1');
      console.log('✅ Seed MockAPI thanh cong!');

    } catch (err) {
      console.warn('⚠️ Seed that bai:', err.message);
      console.warn('👉 Kiem tra ten resource tren MockAPI co phai "songs" va "playlists" khong?');
    }
  }

  // ─── Parse songs field (MockAPI có thể trả về string) ─────
  function parseSongs(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch(e) { return []; }
    }
    return [];
  }

  // ════════════════════════════════════════════════════════
  // SONGS
  // ════════════════════════════════════════════════════════
  async function getSongs(query = '') {
    const qs = query ? '?search=' + encodeURIComponent(query) : '';
    const songs = await request('/songs' + qs);
    // Gắn cover đã resolve vào mỗi song
    return songs.map(s => ({ ...s, cover: resolveCover(s) }));
  }

  async function getSongById(id) {
    const s = await request('/songs/' + id);
    return { ...s, cover: resolveCover(s) };
  }

  // Chỉ strip base64 (quá dài), giữ lại URL https:// bình thường
  function sanitizeCover(cover) {
    if (!cover) return coverIndex(0);
    if (cover.startsWith('data:')) return coverIndex(0); // base64 → index
    return cover; // https:// URL hoặc index 0-5 → giữ nguyên
  }

  async function createSong(data) {
    const payload = { plays: 0, ...data };
    payload.cover = sanitizeCover(payload.cover);
    return request('/songs', { method:'POST', body: JSON.stringify(payload) });
  }

  async function updateSong(id, data) {
    const payload = { ...data };
    if (payload.cover) payload.cover = sanitizeCover(payload.cover);
    return request('/songs/' + id, { method:'PUT', body: JSON.stringify(payload) });
  }

  async function deleteSong(id) {
    // Xoá khỏi tất cả playlist trước
    try {
      const playlists = await getPlaylists();
      await Promise.all(
        playlists
          .filter(p => parseSongs(p.songs).includes(id))
          .map(p => updatePlaylist(p.id, {
            songs: JSON.stringify(parseSongs(p.songs).filter(s => s !== id))
          }))
      );
    } catch(e) {}
    return request('/songs/' + id, { method:'DELETE' });
  }

  async function incrementPlay(id) {
    try {
      const song = await request('/songs/' + id); // raw, no resolve
      await request('/songs/' + id, {
        method: 'PUT',
        body: JSON.stringify({ plays: (Number(song.plays)||0) + 1 }),
      });
    } catch(e) {}
    const h = readLocal(LOCAL.history);
    h.unshift({ songId: id, at: Date.now() });
    writeLocal(LOCAL.history, h.slice(0, 50));
  }

  // ════════════════════════════════════════════════════════
  // PLAYLISTS
  // ════════════════════════════════════════════════════════

  // Chuẩn hoá playlist từ MockAPI
  function normalizePlaylist(p) {
    return {
      ...p,
      cover: resolveCover(p),
      songs: parseSongs(p.songs), // đảm bảo luôn là array
    };
  }

  async function getPlaylists() {
    const list = await request('/playlists');
    return list.map(normalizePlaylist);
  }

  async function getPlaylistById(id) {
    const p = await request('/playlists/' + id);
    return normalizePlaylist(p);
  }

  async function createPlaylist(data) {
    const payload = {
      songs: '[]',
      plays: 0,
      cover: coverIndex(Math.random() * 6 | 0),
      ...data,
    };
    if (Array.isArray(payload.songs)) {
      payload.songs = JSON.stringify(payload.songs);
    }
    if (payload.cover) payload.cover = sanitizeCover(payload.cover);
    return request('/playlists', { method:'POST', body: JSON.stringify(payload) });
  }

  async function updatePlaylist(id, data) {
    const payload = { ...data };
    if (Array.isArray(payload.songs)) {
      payload.songs = JSON.stringify(payload.songs);
    }
    if (payload.cover) payload.cover = sanitizeCover(payload.cover);
    return request('/playlists/' + id, { method:'PUT', body: JSON.stringify(payload) });
  }

  async function deletePlaylist(id) {
    return request('/playlists/' + id, { method:'DELETE' });
  }

  async function addSongToPlaylist(playlistId, songId) {
    const pl    = await getPlaylistById(playlistId);
    const songs = pl.songs; // đã là array nhờ normalizePlaylist
    if (songs.includes(songId)) return pl;
    return updatePlaylist(playlistId, { songs: JSON.stringify([...songs, songId]) });
  }

  async function removeSongFromPlaylist(playlistId, songId) {
    const pl = await getPlaylistById(playlistId);
    return updatePlaylist(playlistId, {
      songs: JSON.stringify(pl.songs.filter(id => id !== songId)),
    });
  }

  // ════════════════════════════════════════════════════════
  // FAVORITES & HISTORY — localStorage
  // ════════════════════════════════════════════════════════
  function getFavorites() { return readLocal(LOCAL.favorites); }

  function toggleFavorite(songId) {
    let favs = getFavorites();
    const exists = favs.includes(songId);
    favs = exists ? favs.filter(id => id !== songId) : [...favs, songId];
    writeLocal(LOCAL.favorites, favs);
    return !exists;
  }

  async function getRecentlyPlayed(limit = 6) {
    const history = readLocal(LOCAL.history);
    const seen = new Set();
    const ids  = [];
    for (const h of history) {
      if (!seen.has(h.songId)) { seen.add(h.songId); ids.push(h.songId); }
      if (ids.length >= limit) break;
    }
    const results = await Promise.all(
      ids.map(id => getSongById(id).catch(() => null))
    );
    const valid = results.filter(Boolean);
    // Dọn history: xóa các ID đã 404
    const validIds = new Set(valid.map(s => s.id));
    const cleanHistory = history.filter(h => validIds.has(h.songId));
    if (cleanHistory.length !== history.length) writeLocal(LOCAL.history, cleanHistory);
    return valid;
  }

  // ════════════════════════════════════════════════════════
  // STATS
  // ════════════════════════════════════════════════════════
  async function getStats() {
    const [songs, playlists] = await Promise.all([getSongs(), getPlaylists()]);
    const totalPlays  = songs.reduce((a, s) => a + (Number(s.plays)||0), 0);
    const topPlaylist = [...playlists].sort((a,b) => (b.plays||0) - (a.plays||0))[0];
    return {
      totalSongs:     songs.length,
      totalPlaylists: playlists.length,
      totalPlays,
      songs,
      playlists,
      topPlaylist: topPlaylist?.name || '—',
    };
  }

  // ════════════════════════════════════════════════════════
  // AUTH — MockAPI users + localStorage session
  // ════════════════════════════════════════════════════════
  function getSession()   { return JSON.parse(localStorage.getItem(LOCAL.session)||'null'); }
  function setSession(u)  { localStorage.setItem(LOCAL.session, JSON.stringify(u)); }
  function clearSession() { localStorage.removeItem(LOCAL.session); }

  function hashPassword(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  async function register(name, email, password) {
    const existing = await request('/users?email=' + encodeURIComponent(email)).catch(() => []);
    if (existing.length > 0) throw new Error('Email này đã được đăng ký');
    const user = await request('/users', {
      method: 'POST',
      body: JSON.stringify({
        name, email,
        password: hashPassword(password),
        role: 'user',
        avatar: '',
        createdAt: new Date().toISOString(),
      }),
    });
    const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    setSession(sessionUser);
    return sessionUser;
  }

  async function login(email, password) {
    if (email === 'admin@playlistmaker.app' && password === 'admin123') {
      const user = { id:'u0', name:'Admin', email, role:'admin' };
      setSession(user);
      return user;
    }
    const users = await request('/users?email=' + encodeURIComponent(email)).catch(() => []);
    if (!users.length) throw new Error('Email không tồn tại');
    const user = users[0];
    if (user.password !== hashPassword(password)) throw new Error('Mật khẩu không đúng');
    const sessionUser = { id: user.id, name: user.name, email: user.email, role: user.role || 'user' };
    setSession(sessionUser);
    return sessionUser;
  }

  async function logout() { clearSession(); }

  async function updateProfile(id, data) {
    const payload = { ...data };
    if (payload.password) payload.password = hashPassword(payload.password);
    const updated = await request('/users/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    const session = getSession();
    if (session?.id === id) setSession({ ...session, name: updated.name, avatar: updated.avatar });
    return updated;
  }

  // ─── Reset seed (dùng khi muốn seed lại từ đầu) ──────────
  function resetSeed() {
    localStorage.removeItem(LOCAL.seeded);
    console.log('🔄 Đã reset seed flag. Reload trang để seed lại.');
  }

  // ─── Public interface ─────────────────────────────────────
  return {
    seed, resetSeed,
    getSongs, getSongById, createSong, updateSong, deleteSong, incrementPlay,
    getPlaylists, getPlaylistById, createPlaylist, updatePlaylist, deletePlaylist,
    addSongToPlaylist, removeSongFromPlaylist,
    getFavorites, toggleFavorite,
    getRecentlyPlayed,
    getStats,
    getSession, login, logout, register, updateProfile,
  };
})();
// PATCH: replace auth