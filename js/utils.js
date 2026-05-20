// ============================================================
// utils.js — Hàm tiện ích dùng chung toàn dự án
// Stack: Vanilla JS + jQuery + Bootstrap 5
// ============================================================

const Utils = (() => {

  // ── Format thời gian (giây → mm:ss) ──────────────────────
  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Format số lượt nghe ───────────────────────────────────
  function formatPlays(n) {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
    return String(n);
  }

  // ── Debounce ──────────────────────────────────────────────
  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ── Sinh ID ngẫu nhiên ────────────────────────────────────
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Toast Notification ────────────────────────────────────
  function toast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast-msg toast-${type}`;
    const icon = { success:'✓', error:'✕', info:'ℹ', warning:'⚠' }[type] || 'ℹ';
    t.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => {
      t.classList.remove('toast-show');
      t.addEventListener('transitionend', () => t.remove());
    }, duration);
  }

  // ── Bootstrap 5 Modal helpers ─────────────────────────────
  function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    const m = bootstrap.Modal.getOrCreateInstance(el);
    m.show();
  }

  function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (!el) return;
    const m = bootstrap.Modal.getInstance(el);
    if (m) m.hide();
  }

  // ── Skeleton loading ──────────────────────────────────────
  function skeletonCards(count, isSongRow = false) {
    if (isSongRow) {
      return Array.from({ length: count }, () => `
        <div class="song-row">
          <div class="skeleton" style="width:20px;height:16px"></div>
          <div class="skeleton" style="width:44px;height:44px;border-radius:8px"></div>
          <div><div class="skeleton skeleton-title" style="width:140px"></div><div class="skeleton skeleton-sub" style="width:90px;margin-top:6px"></div></div>
          <div class="skeleton skeleton-title hide-sm" style="width:100px"></div>
          <div class="skeleton skeleton-sub hide-sm" style="width:60px"></div>
          <div class="skeleton skeleton-sub" style="width:40px"></div>
        </div>`).join('');
    }
    return Array.from({ length: count }, () => `
      <div style="padding:1rem">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-sub"></div>
      </div>`).join('');
  }

  // ── Escape HTML ───────────────────────────────────────────
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  // ── Album placeholder SVG ─────────────────────────────────
  function albumPlaceholder(seed = 0) {
    const colors = [
      ['#6366F1','#8B5CF6'], ['#EC4899','#F43F5E'],
      ['#06B6D4','#3B82F6'], ['#10B981','#059669'],
      ['#F59E0B','#EF4444'], ['#8B5CF6','#EC4899'],
    ];
    const [c1, c2] = colors[Math.abs(seed) % colors.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient></defs>
      <rect width="200" height="200" fill="url(#g)" rx="12"/>
      <circle cx="100" cy="100" r="30" fill="rgba(255,255,255,0.2)"/>
      <circle cx="100" cy="100" r="12" fill="rgba(255,255,255,0.5)"/>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }

  // ── Validate form fields ──────────────────────────────────
  function validateForm(fields) {
    let valid = true;
    fields.forEach(({ el, rules }) => {
      const val = el.value.trim();
      let err = '';
      for (const rule of rules) {
        if (rule === 'required' && !val)            { err = 'Không được để trống.'; break; }
        if (rule.startsWith('minLength:')) {
          const n = parseInt(rule.split(':')[1]);
          if (val.length < n)                       { err = `Tối thiểu ${n} ký tự.`; break; }
        }
        if (rule === 'number' && isNaN(Number(val))){ err = 'Phải là số.'; break; }
      }
      // Dùng Bootstrap validation classes
      if (err) {
        el.classList.add('is-invalid');
        let fb = el.nextElementSibling;
        if (!fb || !fb.classList.contains('invalid-feedback')) {
          fb = document.createElement('div');
          fb.className = 'invalid-feedback';
          el.after(fb);
        }
        fb.textContent = err;
        valid = false;
      } else {
        el.classList.remove('is-invalid');
        const fb = el.nextElementSibling;
        if (fb && fb.classList.contains('invalid-feedback')) fb.textContent = '';
      }
    });
    return valid;
  }

  // ── Ripple effect (jQuery) ────────────────────────────────
  function addRipple(btn) {
    $(btn).on('click', function(e) {
      const $btn = $(this);
      const offset = $btn.offset();
      const size = Math.max($btn.outerWidth(), $btn.outerHeight());
      const x = e.pageX - offset.left - size / 2;
      const y = e.pageY - offset.top  - size / 2;
      const $r = $('<span class="ripple"></span>').css({ width:size, height:size, left:x, top:y });
      $btn.append($r);
      setTimeout(() => $r.remove(), 700);
    });
  }

  // ── Public API ────────────────────────────────────────────
  return {
    formatDuration, formatPlays, debounce, generateId,
    toast, openModal, closeModal, skeletonCards, escapeHtml,
    albumPlaceholder, validateForm, addRipple,
  };
})();