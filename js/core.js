/* LabAttend — inti frontend: API (dedupe + batch + epoch tulis), jam server, modal, toast, router. Vanilla JS. */
(function () {
  'use strict';
<<<<<<< HEAD
  const V = '1.2.3', CFG = window.APP_CONFIG || {};
=======
  const V = '1.0.0', CFG = window.APP_CONFIG || {};
>>>>>>> 17006b8086ee2b3c16ee9882f00bbf1cf21f9c7c
  const LA = window.LA = { V: V, ACT: {}, IN: {}, token: '', me: null, app: null };

  /* ---------- util ---------- */
  const LS = LA.LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  LA.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  LA.$ = (s, r) => (r || document).querySelector(s);
  LA.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  LA.ic = (n, c) => '<span class="ms ' + (c || '') + '">' + n + '</span>';
  LA.initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  LA.debounce = (f, ms) => { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => f.apply(c, a), ms); }; };
  LA.HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  LA.nf = n => new Intl.NumberFormat('id-ID').format(n);
  const TZ = 'Asia/Jakarta';
  const fT = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const fD = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fI = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  LA.fmtTime = d => fT.format(d).replace(/\./g, ':');
  LA.fmtDate = d => fD.format(d);
  LA.iso = d => fI.format(d || LA.Clock.now());
  LA.dmy = s => { const p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; };

  /* ---------- jam server ---------- */
  LA.Clock = {
    off: 0, ok: false,
    sync(serverNow, t0) { const rtt = t0 ? performance.now() - t0 : 0; this.off = serverNow + rtt / 2 - Date.now(); this.ok = true; },
    now() { return new Date(Date.now() + this.off); }
  };

  /* ---------- API ---------- */
<<<<<<< HEAD
  const READ = /^(kiosk\.(boot|publik|cekIzin)|auth\.config|admin\.boot|dash\.get|presensi\.list|murid\.list|komputer\.list|jadwal\.list|persetujuan\.list|laporan\.rekap|log\.list|pengguna\.list|keamanan\.status|db\.ringkas|backup\.list|backup\.periksa|murid\.infoHapus|tata\.list|tata\.admin|batch)$/;
=======
  const READ = /^(kiosk\.(boot|publik|cekIzin)|auth\.config|admin\.boot|dash\.get|presensi\.list|murid\.list|komputer\.list|jadwal\.list|persetujuan\.list|laporan\.rekap|log\.list|pengguna\.list|keamanan\.status|batch)$/;
>>>>>>> 17006b8086ee2b3c16ee9882f00bbf1cf21f9c7c
  let epoch = 0; const inflight = {}, perf = [];
  LA.perf = { table() { console.table(perf.slice(-30)); }, summary() { const o = {}; perf.forEach(p => { const x = o[p.action] || (o[p.action] = { n: 0, total: 0, server: 0 }); x.n++; x.total += p.total; x.server += p.server || 0; }); console.table(Object.keys(o).map(k => ({ aksi: k, n: o[k].n, rataTotalMs: Math.round(o[k].total / o[k].n), rataServerMs: Math.round(o[k].server / o[k].n) }))); } };
  async function post(action, data, tries) {
    if (!CFG.GAS_URL || /GANTI|XXXX/.test(CFG.GAS_URL)) return { success: false, message: 'Konfigurasi belum lengkap: isi GAS_URL di js/config.js.', code: 'CONFIG' };
    const t0 = performance.now(), pub = /^(kiosk|auth)\./.test(action);
    try {
      const res = await fetch(CFG.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, token: pub ? '' : LA.token, data: data || {} }), redirect: 'follow' });
      const j = await res.json();
      if (j.now) LA.Clock.sync(j.now, t0);
      perf.push({ action: action, total: Math.round(performance.now() - t0), server: j.ms, cache: !!j.cached });
      if (j.code === 'AUTH' && LA.token && !pub) LA.onAuthLost && LA.onAuthLost();
      return j;
    } catch (e) {
      if (tries > 0) return post(action, data, tries - 1);
      return { success: false, message: 'Tidak dapat terhubung ke server. Periksa koneksi internet.', code: 'NET' };
    }
  }
  LA.api = function (action, data) {
    if (!READ.test(action)) { epoch++; return post(action, data, 0); }
    const k = epoch + '|' + action + '|' + LA.token + '|' + JSON.stringify(data || {});
    if (inflight[k]) return inflight[k];
    const p = post(action, data, 1); inflight[k] = p;
    p.then(() => delete inflight[k], () => delete inflight[k]);
    return p;
  };
  // Penggabung batch otomatis (hanya aksi BACA admin): beberapa panggilan di tik yang sama → 1 eksekusi server
  const Batch = { q: null,
    add(action, data) { return new Promise(res => { if (!this.q) { this.q = []; setTimeout(() => this.flush(), 0); } this.q.push({ action: action, data: data || {}, res: res }); }); },
    flush() {
      const q = this.q; this.q = null; if (!q) return;
      if (q.length === 1) { LA.api(q[0].action, q[0].data).then(q[0].res); return; }
      for (let i = 0; i < q.length; i += 10) {
        const part = q.slice(i, i + 10);
        LA.api('batch', { calls: part.map(c => ({ action: c.action, data: c.data })) }).then(r => {
          part.forEach((c, j) => c.res(r.success ? r.data[j] : { success: false, message: r.message, code: r.code }));
        });
      }
    } };
  LA.apiQ = (a, d) => Batch.add(a, d);

  /* ---------- aktivitas & polling adaptif ---------- */
  LA.Activity = { at: Date.now(), last: {},
    init() { ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { this.at = Date.now(); }, { passive: true })); },
    idle() { return Date.now() - this.at > 120000; },
    due(key, activeMs, idleMs) {
      if (document.visibilityState !== 'visible') return false;
      if (Date.now() - (this.last[key] || 0) < (this.idle() ? idleMs : activeMs) - 500) return false;
      this.last[key] = Date.now(); return true;
    } };
  LA.Activity.init();

  /* ---------- UI: toast & modal ---------- */
  LA.toast = function (msg, type) {
    let box = document.getElementById('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.setAttribute('role', 'status');
    t.innerHTML = LA.ic(type === 'err' ? 'error' : type === 'ok' ? 'check_circle' : 'info', 's18') + '<span>' + LA.esc(msg) + '</span>';
    box.appendChild(t); setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; setTimeout(() => t.remove(), 260); }, type === 'err' ? 5000 : 2600);
  };
  let modalEl = null;
<<<<<<< HEAD
  LA.closeModal = function () { LA._noEsc = false; if (modalEl) { modalEl.remove(); modalEl = null; document.removeEventListener('keydown', escK); } };
  function escK(e) { if (e.key === 'Escape' && !LA._noEsc) LA.closeModal(); }
  LA.modal = function (o) {
    LA.closeModal(); LA._noEsc = !!o.noClose;
    const el = document.createElement('div'); el.className = 'ov';
    el.innerHTML = '<div class="md ' + (o.wide ? 'w' : '') + '" role="dialog" aria-modal="true"><div class="hd"><h2>' + LA.esc(o.title || '') + '</h2>' + (o.noClose ? '' : '<button class="btn g ico" data-act="modal.close" aria-label="Tutup">' + LA.ic('close') + '</button>') + '</div><div class="bd">' + (o.body || '') + '</div>' + (o.foot ? '<div class="ft">' + o.foot + '</div>' : '') + '</div>';
=======
  LA.closeModal = function () { if (modalEl) { modalEl.remove(); modalEl = null; document.removeEventListener('keydown', escK); } };
  function escK(e) { if (e.key === 'Escape') LA.closeModal(); }
  LA.modal = function (o) {
    LA.closeModal();
    const el = document.createElement('div'); el.className = 'ov';
    el.innerHTML = '<div class="md ' + (o.wide ? 'w' : '') + '" role="dialog" aria-modal="true"><div class="hd"><h2>' + LA.esc(o.title || '') + '</h2><button class="btn g ico" data-act="modal.close" aria-label="Tutup">' + LA.ic('close') + '</button></div><div class="bd">' + (o.body || '') + '</div>' + (o.foot ? '<div class="ft">' + o.foot + '</div>' : '') + '</div>';
>>>>>>> 17006b8086ee2b3c16ee9882f00bbf1cf21f9c7c
    el.addEventListener('mousedown', e => { if (e.target === el && !o.lock) LA.closeModal(); });
    document.body.appendChild(el); modalEl = el; document.addEventListener('keydown', escK);
    const f = el.querySelector('input,select,textarea'); if (f && !o.noFocus) setTimeout(() => f.focus(), 30);
    return el;
  };
  LA.confirm = function (title, text, okLabel, danger) {
    return new Promise(res => {
      LA.modal({ title: title, lock: true, body: '<p class="mut">' + LA.esc(text) + '</p>', foot: '<button class="btn" data-act="cf.no">Batal</button><button class="btn ' + (danger ? 'd' : 'p') + '" data-act="cf.ok">' + LA.esc(okLabel || 'Ya, lanjutkan') + '</button>' });
      LA.ACT['cf.no'] = () => { LA.closeModal(); res(false); }; LA.ACT['cf.ok'] = () => { LA.closeModal(); res(true); };
    });
  };
  LA.ACT['modal.close'] = () => LA.closeModal();
  LA.busy = function (btn, on, label) {
    if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>' + (label ? ' ' + LA.esc(label) : ''); } else { btn.disabled = false; if (btn.dataset.l) btn.innerHTML = btn.dataset.l; }
  };
  LA.copy = async function (txt) {
    try { await navigator.clipboard.writeText(txt); } catch (e) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (x) {} t.remove(); }
    LA.toast('Disalin ke clipboard', 'ok');
  };
  LA.download = function (name, mime, content) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

  /* ---------- delegasi event global ---------- */
  document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const f = LA.ACT[el.dataset.act]; if (f) { if (el.tagName !== 'INPUT') e.preventDefault(); f(el, e); } });
  document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && LA.IN[el.dataset.in]) LA.IN[el.dataset.in](el, e); });
  document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && LA.IN[el.dataset.ch]) LA.IN[el.dataset.ch](el, e); });

  /* ---------- identitas aplikasi (nama & logo) ---------- */
  LA.setApp = function (app) {
    if (!app) return; LA.app = app; LS.set('la_app', app);
    document.title = (app.namaApp || 'LabAttend') + ' — ' + (app.namaSekolah || '');
    LA.$$('[data-brand=nama]').forEach(e => { e.textContent = app.namaApp; });
    LA.$$('[data-brand=sekolah]').forEach(e => { e.textContent = app.namaSekolah; });
    LA.$$('[data-brand=lab]').forEach(e => { e.textContent = app.namaSekolah + ' - ' + app.namaLab; });
    LA.$$('img[data-brand=logo]').forEach(e => { if (app.logo) { e.src = app.logo; e.style.display = ''; } });
  };
  LA.logoImg = (cls) => '<img data-brand="logo" class="' + (cls || 'k-logo') + '" alt="Logo" src="' + (LA.app && LA.app.logo ? LA.esc(LA.app.logo) : 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#15803D"/><path d="M11 13h18v11H11zM16 28h8" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="m15.5 18.5 3 3 6-6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>')) + '">';
  LA.app = LS.get('la_app', { namaApp: 'LabAttend', namaSekolah: 'MTs Negeri 1 Kota Bekasi', namaLab: 'Lab Komputer 1', logo: '' });

  /* ---------- muat modul malas ---------- */
  const loaded = {};
  LA.load = function (src) {
    if (loaded[src]) return loaded[src];
    return loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src.indexOf('http') === 0 ? src : src + '?v=' + V; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Gagal memuat ' + src)); }; document.head.appendChild(s); });
  };

  /* ---------- router (hash) ---------- */
  LA.go = h => { if (location.hash === h) LA.render(); else location.hash = h; };
  LA.render = async function () {
    const h = (location.hash || '#/').replace(/^#/, ''), root = document.getElementById('app');
    window.scrollTo(0, 0);
    try {
      if (/^\/(admin|login|darurat)/.test(h)) { await LA.load('js/admin.js'); LA.admin.show(h); }
      else { await LA.load('js/kiosk.js'); LA.kiosk.show(h); }
    } catch (e) { root.innerHTML = '<div class="login"><div class="k-card ctr"><h2>Gagal memuat halaman</h2><p class="mut" style="margin:8px 0 16px">' + LA.esc(e.message) + '</p><button class="btn p" onclick="location.reload()">Muat ulang</button></div></div>'; }
  };
  window.addEventListener('hashchange', () => LA.render());
  window.addEventListener('online', () => LA.toast('Koneksi tersambung kembali', 'ok'));
  window.addEventListener('offline', () => LA.toast('Koneksi terputus', 'err'));
  // ikon font siap → tampilkan; cadangan 2.5 dtk
  const fok = () => document.documentElement.classList.add('fonts-ok');
  try { document.fonts.load('20px "Material Symbols Outlined"', 'home').then(fok, fok); } catch (e) { fok(); } setTimeout(fok, 2500);
  document.addEventListener('DOMContentLoaded', () => { LA.render(); setTimeout(() => LA.load('js/admin.js').catch(() => {}), 4000); });   // prefetch admin saat idle
})();
