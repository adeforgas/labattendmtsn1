/* LabAttend — Admin Console (bagian 1): login, shell, dashboard, persetujuan, monitoring, koreksi, log.
   Strategi tanpa delay: admin.boot memuat SEMUA data master 1× → pindah menu = render dari memori (instan);
   penyegaran latar (SWR) + polling adaptif; aksi persetujuan/kunci memakai pembaruan optimistis. */
(function () {
  'use strict';
  const { esc, ic, $, $$, LS } = LA;
  const A = LA.admin = { d: LS.get('la_adm', null), page: 'dashboard', S: { pres: {}, kor: {}, lap: {}, mur: {}, kom: {}, log: {}, per: {} }, pages: {}, loading: false };
  LA.token = LS.get('la_tok', '') || ''; LA.me = LS.get('la_me', null);
  const NAV = [['dashboard', 'Dashboard', 'dashboard'], ['presensi', 'Monitoring Presensi', 'sensors'], ['persetujuan', 'Persetujuan', 'verified_user'], ['murid', 'Murid & Kelas', 'groups'], ['komputer', 'Komputer', 'computer'], ['jadwal', 'Jadwal', 'calendar_month'], ['koreksi', 'Koreksi Presensi', 'edit_note'], ['laporan', 'Laporan Rekap', 'assessment'], ['log', 'Log Aktivitas', 'receipt_long'], ['tata', 'Tata Tertib Lab', 'gavel'], ['database', 'Pengelolaan Database', 'database'], ['pengaturan', 'Pengaturan Aplikasi', 'settings']];
  const MOBILE = ['dashboard', 'persetujuan', 'murid', 'komputer', 'laporan'];
  const isK = () => LA.me && LA.me.role === 'kepala';
  const allowed = p => !isK() || p === 'laporan';

  /* ---------- helper UI (dipakai juga admin2.js) ---------- */
  A.h = {
    stat: (label, val, sub, icon, cls) => '<div class="card stat"><div class="ic ' + (cls || '') + '">' + ic(icon) + '</div><div class="up">' + label + '</div><div class="v">' + val + '</div><div class="sm mut">' + (sub || '&nbsp;') + '</div></div>',
    head: (eb, title, desc, act) => '<div class="ph"><div>' + (eb ? '<div class="eb">' + eb + '</div>' : '') + '<h1>' + title + '</h1>' + (desc ? '<p class="mut" style="margin-top:2px">' + desc + '</p>' : '') + '</div><div class="row wrap">' + (act || '') + '</div></div>',
    badge: (t, c) => '<span class="badge ' + (c || '') + '">' + t + '</span>',
    sbadge: s => ({ Hadir: '<span class="badge"><i class="dot"></i>Hadir</span>', Terlambat: '<span class="badge warn"><i class="dot"></i>Terlambat</span>', Izin: '<span class="badge sq mut">Izin</span>', Sakit: '<span class="badge sq mut">Sakit</span>', Alpa: '<span class="badge err">Alpa</span>', Belum: '<span class="badge mut">Belum</span>' }[s] || esc(s)),
    pager: (total, page, per, act) => { const n = Math.max(1, Math.ceil(total / per)); if (n <= 1) return ''; const b = []; for (let i = 1; i <= n; i++) if (i === 1 || i === n || Math.abs(i - page) <= 1) b.push(i); else if (b[b.length - 1] !== '…') b.push('…'); return '<div class="pg">' + b.map(i => i === '…' ? '<span class="mut">…</span>' : '<button class="' + (i === page ? 'on' : '') + '" data-act="' + act + '" data-p="' + i + '">' + i + '</button>').join('') + '</div>'; },
    sk: (n) => '<div class="col">' + Array(n || 4).fill('<div class="sk" style="height:56px"></div>').join('') + '</div>',
    kelasOpt: (sel, all) => (all ? '<option value="">' + all + '</option>' : '') + ((A.d && A.d.kelas) || []).map(k => '<option value="' + esc(k.id) + '"' + (k.id === sel ? ' selected' : '') + '>' + esc(k.nama) + '</option>').join(''),
    fld: (l, inner, hint) => '<div class="fld"><label>' + l + '</label>' + inner + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>'
  };
  const H = A.h;
  A.W = async function (btn, action, data, okMsg) {
    LA.busy(btn, true); const r = await LA.api(action, data); LA.busy(btn, false);
    if (!r.success) { LA.toast(r.message, 'err'); return null; }
    if (okMsg !== false) LA.toast(r.message || okMsg || 'Tersimpan', 'ok'); return r;
  };
  const RELOAD = { murid: ['murid.list', 'murid'], komputer: ['komputer.list', 'komputer'], jadwal: ['jadwal.list', 'jadwal'], persetujuan: ['persetujuan.list', 'persetujuan'], dash: ['dash.get', 'dash'] };
  A.reload = async function (keys, silent) {
    const list = [].concat(keys);
    if (list.indexOf('kelas') >= 0 || list.indexOf('boot') >= 0) { await boot(true); return; }
    await Promise.all(list.map(k => LA.apiQ(RELOAD[k][0]).then(r => { if (r.success) A.d[RELOAD[k][1]] = r.data; })));
    save(); if (!silent) A.draw();
  };
  const save = LA.debounce(() => LS.set('la_adm', A.d), 800);
  const pend = () => { const p = A.d && A.d.persetujuan; return p ? p.pindah.filter(x => x.status === 'Menunggu').length + p.izin.filter(x => x.status === 'Menunggu').length : 0; };

  /* ---------- sesi / login ---------- */
  LA.onAuthLost = function () { LA.token = ''; LS.del('la_tok'); LS.del('la_me'); LS.del('la_adm'); A.d = null; LA.toast('Sesi berakhir. Silakan masuk kembali.', 'err'); LA.go('#/login'); };
  function setSession(d) { LA.token = d.token; LA.me = d.me; LS.set('la_tok', d.token); LS.set('la_me', d.me); A.d = null; LS.del('la_adm'); LA.go('#/admin/' + (d.me.role === 'kepala' ? 'laporan' : 'dashboard')); }
  const brandHead = t => '<div class="ctr" style="margin-bottom:18px">' + LA.logoImg('k-logo" style="width:56px;height:56px;margin-bottom:8px') + '<h1>' + t + '</h1><div class="mut" data-brand="sekolah">' + esc(LA.app.namaSekolah) + '</div></div>';
  async function loginView() {
    clearInterval(A.poll); document.body.classList.remove('adm-on');
    $('#app').innerHTML = '<div class="login"><div class="k-card">' + brandHead('Login Pengelola Lab') + '<div id="lerr"></div><div class="ctr" id="gbtn" style="min-height:44px"><span class="spin"></span></div><p class="sm mut ctr" style="margin-top:14px">Masuk dengan akun Google yang terdaftar sebagai Admin atau Kepala Laboratorium. Email di luar daftar ditolak server.</p><div class="ctr" style="margin-top:16px"><a class="btn g sm" href="#/">' + ic('arrow_back', 's18') + 'Kembali ke terminal presensi</a></div></div></div>';
    const r = await LA.api('auth.config', {}), cid = r.success && r.data.googleClientId;
    if (!cid) { $('#gbtn').innerHTML = '<div class="alert">' + ic('info') + '<div>Google Client ID belum diisi di server. Pengelola utama: masuk lewat halaman akses darurat (lihat panduan instalasi) lalu isi di <b>Pengaturan → Keamanan</b>.</div></div>'; return; }
    try { await LA.load('https://accounts.google.com/gsi/client'); } catch (e) { $('#gbtn').innerHTML = '<div class="alert e">' + ic('cloud_off') + '<div>Gagal memuat layanan Google. Periksa koneksi.</div></div>'; return; }
    google.accounts.id.initialize({ client_id: cid, callback: async resp => {
      $('#lerr').innerHTML = ''; $('#gbtn').style.opacity = '.5';
      const x = await LA.api('auth.google', { idToken: resp.credential }); $('#gbtn').style.opacity = '';
      if (!x.success) $('#lerr').innerHTML = '<div class="alert e" style="margin-bottom:14px">' + ic('error', 'fill') + '<div><b>Login ditolak</b><br>' + esc(x.message) + '</div></div>'; else setSession(x.data);
    } });
    $('#gbtn').innerHTML = ''; google.accounts.id.renderButton($('#gbtn'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 300, locale: 'id' });
  }
  function daruratView() {
    $('#app').innerHTML = '<div class="login"><div class="k-card">' + brandHead('Akses Darurat') + '<div class="alert" style="margin-bottom:14px">' + ic('warning') + '<div>Hanya untuk pengelola utama bila login Google belum bisa dipakai. Setiap percobaan dicatat; 5 kali salah mengunci 15 menit.</div></div><div id="lerr"></div><div class="col"><input class="inp kiosk" id="du" placeholder="Nama pengguna" autocomplete="username"><input class="inp kiosk" id="dp" type="password" placeholder="Kata sandi" autocomplete="off"><button class="btn p lg blk" data-act="a.darurat">Masuk</button></div></div></div>';
    $('#dp').addEventListener('keydown', e => { if (e.key === 'Enter') LA.ACT['a.darurat'](e.target.closest('.col').querySelector('button')); });
  }
  LA.ACT['a.darurat'] = async btn => {
    LA.busy(btn, true); const r = await LA.api('auth.darurat', { username: $('#du').value.trim(), password: $('#dp').value }); LA.busy(btn, false); $('#dp').value = '';
    if (!r.success) $('#lerr').innerHTML = '<div class="alert e" style="margin-bottom:14px">' + ic('error', 'fill') + '<div>' + esc(r.message) + '</div></div>'; else setSession(r.data);
  };
  LA.ACT['a.keluar'] = async () => { LA.api('auth.keluar', {}); LA.token = ''; LS.del('la_tok'); LS.del('la_me'); LS.del('la_adm'); A.d = null; LA.go('#/login'); };

  /* ---------- router admin ---------- */
  A.show = async function (h) {
    clearInterval(A.poll);
    if (h === '/login') return loginView(); if (h === '/darurat') return daruratView();
    if (!LA.token) return LA.go('#/login');
    await LA.load('js/admin2.js'); await LA.load('js/admin3.js'); await LA.load('js/admin4.js');
    let p = (h.split('/')[2] || '').trim(); if (!A.pages[p]) p = isK() ? 'laporan' : 'dashboard';
    if (!allowed(p)) p = 'laporan';
    A.page = p; shell();
    $$('[data-p]').forEach(a => a.classList.toggle('on', a.dataset.p === p));
    if (A.d) { A.draw(); boot(true); } else { $('#apg').innerHTML = H.sk(5); boot(); }
    A.poll = setInterval(poll, 5000);
  };
  async function boot(quiet) {
    const r = await LA.api('admin.boot', {});
    if (!r.success) { if (r.code !== 'AUTH') { if (!quiet || !A.d) $('#apg').innerHTML = '<div class="alert e">' + ic('cloud_off') + '<div><b>' + esc(r.message) + '</b></div></div><button class="btn p" data-act="a.retry">Coba lagi</button>'; } return; }
    A.d = r.data; LA.me = r.data.me; LS.set('la_me', LA.me); try { LS.set('la_adm', A.d); } catch (e) {} LA.setApp(r.data.app); chrome(); A.draw();
  }
  LA.ACT['a.retry'] = () => boot();
  A.draw = function () {
    const el = $('#apg'); if (!el || !A.d) return;
    el.innerHTML = (isK() ? '<div class="alert i"><span class="ms pri">visibility</span><div><b>Mode Kepala Laboratorium — hanya lihat (read-only).</b> Rekap, statistik, dan laporan tersedia; perubahan data dinonaktifkan.</div></div>' : '') + A.pages[A.page].render();
    if (A.pages[A.page].after) A.pages[A.page].after(); chrome();
  };
  async function poll() {
    if (!A.d || isK() || document.hidden) return;
    const p = A.page;
    if (p === 'dashboard' || p === 'persetujuan') {
      if (!LA.Activity.due('adm', 15000, 60000)) return;
      const [a, b] = await Promise.all([LA.apiQ('dash.get'), LA.apiQ('persetujuan.list')]);
      let ch = false; if (a.success && JSON.stringify(a.data) !== JSON.stringify(A.d.dash)) { A.d.dash = a.data; ch = true; } if (b.success && JSON.stringify(b.data) !== JSON.stringify(A.d.persetujuan)) { A.d.persetujuan = b.data; ch = true; }
      if (ch && !$('.ov')) A.draw();
    } else if (p === 'komputer' && LA.Activity.due('kom', 30000, 90000)) { await A.reload('komputer', true); if (!$('.ov')) A.draw(); }
    else if (p === 'presensi' && LA.Activity.due('pr', 15000, 60000) && !$('.ov')) A.pages.presensi.load(true);
  }

  /* ---------- shell ---------- */
  function shell() {
    if ($('#ash')) return;
    const nav = NAV.filter(n => allowed(n[0]));
    $('#app').innerHTML = '<div class="adm" id="ash"><aside class="side"><div class="lg0">' + LA.logoImg('') + '<div><b style="font-size:17px;color:#fff" data-brand="nama">' + esc(LA.app.namaApp) + '</b><div class="sm" style="opacity:.8" data-brand="sekolah">' + esc(LA.app.namaSekolah) + '</div></div></div><nav>' +
      nav.map(n => '<a class="ni" href="#/admin/' + n[0] + '" data-p="' + n[0] + '">' + ic(n[2]) + '<span>' + n[1] + '</span>' + (n[0] === 'persetujuan' ? '<span class="cnt hide" id="cnt1"></span>' : '') + '</a>').join('') + '</nav><div style="padding:12px 0;border-top:1px solid rgba(255,255,255,.1)"><a class="ni" href="#/" target="_blank">' + ic('tv') + '<span>Buka Terminal Kiosk</span></a><a class="ni" href="#" data-act="a.keluar">' + ic('logout') + '<span>Keluar Sistem</span></a></div></aside>' +
      '<div class="amain"><header class="atop"><span class="mut hid-m">Admin Console</span><span class="mut">›</span><b class="trunc" data-brand="sekolah">' + esc(LA.app.namaSekolah) + '</b><span class="grow"></span><span class="pill">' + ic('schedule', 's16 pri') + '<span data-clock>--:--:--</span> WIB<span class="mut hid-m">• Server GAS Aktif</span></span>' +
      '<a class="btn g ico" href="#/admin/persetujuan" aria-label="Persetujuan" style="position:relative">' + ic('notifications') + '<i class="dot hide" id="bell" style="position:absolute;top:4px;right:4px;background:var(--warn)"></i></a><div class="row"><span class="av" style="background:var(--pri);color:#fff">' + esc(LA.initials(LA.me.nama)) + '</span><div class="hid-m" style="line-height:16px"><b class="sm">' + esc(LA.me.nama) + '</b><div class="sm mut">' + (isK() ? 'Kepala Laboratorium' : 'Administrator') + '</div></div></div><button class="btn g ico hid-d" data-act="a.keluar" aria-label="Keluar">' + ic('logout') + '</button></header><main class="apg" id="apg"></main></div></div>' +
      '<nav class="bnav">' + nav.filter(n => MOBILE.includes(n[0]) || isK()).map(n => '<a href="#/admin/' + n[0] + '" data-p="' + n[0] + '">' + ic(n[2]) + n[1].split(' ')[0] + (n[0] === 'persetujuan' ? '<span class="cnt hide" id="cnt2"></span>' : '') + '</a>').join('') + (isK() ? '' : '<button data-act="a.menu">' + ic('menu') + 'Menu</button>') + '</nav>';
    const st = document.createElement('style'); st.textContent = '.hid-m{display:inline}.hid-d{display:none}@media(max-width:900px){.hid-m{display:none}.hid-d{display:inline-flex}}'; document.head.appendChild(st);
    clearInterval(A.tk); A.tk = setInterval(() => { const t = LA.fmtTime(LA.Clock.now()); $$('[data-clock]').forEach(e => { e.textContent = t; }); }, 1000);
  }
  function chrome() {
    const n = pend(); ['cnt1', 'cnt2'].forEach(id => { const e = $('#' + id); if (e) { e.textContent = n; e.classList.toggle('hide', !n); } }); const b = $('#bell'); if (b) b.classList.toggle('hide', !n);
    LA.setApp(A.d && A.d.app);
  }
  LA.ACT['a.menu'] = () => LA.modal({ title: 'Menu', body: '<div class="col">' + NAV.map(n => '<a class="btn blk" style="justify-content:flex-start" href="#/admin/' + n[0] + '" data-act="modal.close">' + ic(n[2]) + n[1] + '</a>').join('') + '<a class="btn blk" style="justify-content:flex-start" href="#/" target="_blank">' + ic('tv') + 'Buka Terminal Kiosk</a><button class="btn blk" style="justify-content:flex-start" data-act="a.keluar">' + ic('logout') + 'Keluar Sistem</button></div>' });

  /* ================= DASHBOARD ================= */
  const PCLBL = { terpakai: 'Tepat', terlambat: 'Terlambat', kosong: 'Standby', terkunci: 'Terkunci', maintenance: 'Perbaikan', nonaktif: 'Nonaktif' };
  A.pages.dashboard = { render() {
    const d = A.d.dash, s = d.stat, tot = s.hadir + s.terlambat, sesi = d.sesi[0];
    const pct = tot ? Math.round(s.hadir / tot * 1000) / 10 : 0, latep = tot ? Math.round(s.terlambat / tot * 1000) / 10 : 0, upct = s.unit ? Math.round(s.terpakai / s.unit * 100) : 0;
    const pm = A.d.persetujuan, pending = pm.pindah.filter(x => x.status === 'Menunggu').map(x => Object.assign({ t: 'pindah' }, x)).concat(pm.izin.filter(x => x.status === 'Menunggu').map(x => Object.assign({ t: 'izin' }, x))).slice(0, 4);
    const brk = [s.hadir, s.terlambat, s.belum], bt = brk[0] + brk[1] + brk[2], c1 = bt ? brk[0] / bt * 100 : 0, c2 = bt ? c1 + brk[1] / bt * 100 : 0;
    const mx = Math.max(1, ...d.perKelas.map(k => k.tepat + k.terlambat));
    return H.head(esc(d.tanggal) + ' • ' + esc(A.d.app.namaLab).toUpperCase(), 'Monitoring Workstation &amp; Presensi Realtime', '', '<span class="badge sq mut"><i class="dot pulse"></i>Pembaruan otomatis</span><button class="btn p sm" data-act="d.sync">' + ic('sync', 's18') + 'Sinkron Manual</button>') +
      '<div class="g4">' + H.stat('Hadir hari ini', s.hadir + ' <span class="mut" style="font-size:14px;font-weight:400">/ ' + s.murid + ' Murid</span>', '<b class="pri">' + pct + '% tepat waktu</b>', 'check') +
      H.stat('Terlambat', s.terlambat + ' <span class="mut" style="font-size:14px;font-weight:400">Murid</span>', '<b style="color:var(--warn-tx)">' + latep + '% dari total hadir</b>', 'schedule', 'w') +
      '<div class="card stat"><div class="ic i">' + ic('laptop') + '</div><div class="up">Komputer terpakai</div><div class="v">' + s.terpakai + ' <span class="mut" style="font-size:14px;font-weight:400">/ ' + s.unit + ' Unit</span></div><div class="bar" style="margin-top:4px"><i style="width:' + upct + '%"></i></div><div class="sm pri b">' + upct + '% kapasitas aktif</div></div>' +
      '<a class="card stat click" href="#/admin/persetujuan"><div class="ic w">' + ic('hourglass_top') + '</div><div class="up">Permintaan menunggu</div><div class="v">' + s.menunggu + ' <span class="mut" style="font-size:14px;font-weight:400">Aksi admin</span></div><div class="sm mut">' + s.pindahMenunggu + ' pindah PC • ' + s.izinMenunggu + ' izin</div></a></div>' +
      '<div class="dsp"><div class="card"><div class="row sp wrap" style="margin-bottom:12px"><h3>' + ic('grid_view', 'pri') + ' Peta Workstation (' + d.peta.length + ' PC)</h3></div><div class="lg" style="margin-bottom:12px"><span><i class="a"></i>Terpakai</span><span><i class="b"></i>Tersedia</span><span><i class="c"></i>Terkunci / PIN</span><span><i class="d"></i>Perbaikan / nonaktif</span></div>' +
      (d.peta.length ? '<div class="pcg">' + d.peta.map(p => '<div class="pc ' + p.s + (p.pindah ? ' pindah' : '') + '" title="' + esc(p.nama || p.catatan || PCLBL[p.s]) + '"><b>' + esc(p.id.replace(/^LAB-/, '')) + '<i class="dot dt" style="' + (p.s === 'terpakai' || p.s === 'terlambat' ? '' : 'visibility:hidden') + '"></i></b><span class="n">' + (p.nama ? esc(p.nama) : '<i class="mut">' + PCLBL[p.s] + '</i>') + '</span><span class="m">' + (p.jam ? p.jam + ' WIB' : p.s === 'terkunci' ? 'Reset admin' : '&nbsp;') + '</span></div>').join('') + '</div>' : '<div class="empty">Belum ada komputer. <a class="pri b" href="#/admin/komputer">Daftarkan komputer</a></div>') + '</div>' +
      '<div class="card"><div class="row sp" style="margin-bottom:10px"><h3>' + ic('history', 'pri') + ' Feed Presensi</h3><span class="badge"><i class="dot pulse"></i>Live</span></div><div class="feed">' + (d.feed.length ? d.feed.map(f => '<div class="' + (f.alert ? 'al' : '') + '"><span class="av ' + (f.alert ? 'r' : '') + '">' + esc(LA.initials(f.nama)) + '</span><div class="grow"><b class="trunc" style="display:block">' + (f.alert ? 'PIN gagal 3×' : esc(f.nama)) + '</b><span class="sm mut">' + (f.alert ? esc(f.nama) + ' • ' : esc(f.kelas) + ' • ') + esc(f.deviceId) + '</span></div><div class="tr">' + H.sbadge(f.status === 'Terkunci' ? '' : f.status).replace(/^$/, '<span class="badge err">Terkunci</span>') + '<div class="sm mut num">' + f.jam + '</div></div></div>').join('') : '<div class="empty">Belum ada presensi hari ini.</div>') + '</div></div></div>' +
      '<div class="dsp3"><div class="card"><h3>Tingkat Kehadiran per Kelas</h3><p class="sm mut" style="margin-bottom:10px">Hadir tepat waktu &amp; terlambat hari ini</p><div class="bars">' + d.perKelas.map(k => '<div class="bc"><div class="bp"><i style="height:' + k.tepat / mx * 100 + '%"></i><i class="l" style="height:' + k.terlambat / mx * 100 + '%"></i></div></div>').join('') + '</div><div class="xl">' + d.perKelas.map(k => '<div>' + esc(k.kelas) + '</div>').join('') + '</div><div class="lg" style="margin-top:8px"><span><i class="a"></i>Tepat</span><span><i style="background:var(--warn);border-color:var(--warn)"></i>Terlambat</span></div></div>' +
      '<div class="card"><h3>Breakdown Status</h3><p class="sm mut" style="margin-bottom:12px">Sesi berjalan hari ini</p><div class="row" style="gap:18px"><div class="donut" style="background:' + (bt ? 'conic-gradient(var(--pri) 0 ' + c1 + '%,var(--warn) ' + c1 + '% ' + c2 + '%,var(--err) ' + c2 + '% 100%)' : 'var(--hover)') + '"><b>' + bt + '<small>MURID</small></b></div><div class="col grow sm"><span><i class="dot"></i> Hadir tepat <b style="float:right">' + s.hadir + '</b></span><span><i class="dot" style="background:var(--warn)"></i> Terlambat <b style="float:right">' + s.terlambat + '</b></span><span><i class="dot" style="background:var(--err)"></i> Belum presensi <b style="float:right">' + s.belum + '</b></span></div></div></div>' +
      '<div class="card"><div class="row sp"><h3>Sesi Berlangsung</h3>' + (sesi ? '<span class="badge">' + (sesi.fase === 'buka' ? 'Presensi dibuka' : 'Sedang berlangsung') + '</span>' : '') + '</div>' + (sesi ? d.sesi.map(x => '<div style="margin-top:12px"><b style="font-size:17px">' + esc(x.mapel) + '</b><div class="mut">Kelas ' + esc(x.kelas) + ' • ' + esc(x.guru || 'Guru') + '</div><div class="box" style="margin-top:8px;padding:10px 12px"><b class="pri num">' + x.mulai + ' – ' + x.selesai + ' WIB</b></div></div>').join('') : '<div class="empty">Tidak ada sesi aktif saat ini.</div>') + '</div></div>' +
      '<div class="card"><div class="row sp"><div><h3>Tindakan Menunggu Persetujuan</h3><p class="sm mut">Permintaan pindah perangkat dan izin presensi murid</p></div><span class="sm mut">' + s.menunggu + ' permintaan aktif</span></div><div class="g2" style="margin-top:12px">' + (pending.length ? pending.map(pendCard).join('') : '<div class="empty" style="grid-column:1/-1">Tidak ada permintaan yang menunggu. 🎉</div>') + '</div></div>';
  } };
  function pendCard(p) {
    const pi = p.t === 'pindah';
    return '<div class="box"><div class="row sp"><span class="badge ' + (pi ? 'warn' : 'sq') + '">' + (pi ? 'Pindah PC' : p.jenis === 'komputer' ? 'Izin Komputer' : 'Izin Luar Jadwal') + '</span><span class="sm mut num">' + p.waktu.slice(11, 16) + ' WIB</span>' + (pi ? '<b class="pri">' + esc(p.asal) + (p.tujuan ? ' → ' + esc(p.tujuan) : '') + '</b>' : '') + '</div><div style="margin:8px 0"><b>' + esc(p.nama) + ' (' + esc(p.kelas) + ')</b><div class="sm mut">“' + esc(p.alasan) + '”</div></div><div class="row" style="justify-content:flex-end"><button class="btn sm" data-act="p.proses" data-t="' + p.t + '" data-id="' + p.id + '" data-k="tolak">Tolak</button><button class="btn p sm" data-act="p.proses" data-t="' + p.t + '" data-id="' + p.id + '" data-k="setuju">' + ic('check', 's16') + (pi ? 'Setujui Pemindahan' : 'Setujui') + '</button></div></div>';
  }
  LA.ACT['d.sync'] = async b => { LA.busy(b, true); const [a, c] = await Promise.all([LA.api('dash.get'), LA.api('persetujuan.list')]); LA.busy(b, false); if (a.success) A.d.dash = a.data; if (c.success) A.d.persetujuan = c.data; A.draw(); LA.toast('Data disinkronkan', 'ok'); };

  /* ================= PERSETUJUAN ================= */
  LA.ACT['p.proses'] = async el => {
    const t = el.dataset.t, id = el.dataset.id, k = el.dataset.k, P = A.d.persetujuan, it = (t === 'pindah' ? P.pindah : P.izin).find(x => x.id === id); if (!it || it.status !== 'Menunggu') return;
    let tujuan = ''; if (t === 'pindah' && k === 'setuju') { const s = $('#tj-' + id); tujuan = s ? s.value : it.tujuan; if (!tujuan) { LA.toast('Pilih komputer tujuan terlebih dahulu', 'err'); return; } }
    const prev = it.status, prevT = it.tujuan; it.status = k === 'setuju' ? 'Disetujui' : 'Ditolak'; if (tujuan) it.tujuan = tujuan; A.draw(); chrome();   // optimistis: UI langsung berubah
    const r = await LA.api('persetujuan.proses', { jenis: t, id: id, keputusan: k, tujuan: tujuan });
    if (!r.success) { it.status = prev; it.tujuan = prevT; A.draw(); chrome(); LA.toast(r.message, 'err'); } else { LA.toast(r.message, 'ok'); A.reload(['dash', 'komputer', 'persetujuan'], true).then(() => A.draw()); }
  };
  A.pages.persetujuan = { render() {
    const P = A.d.persetujuan, tab = A.S.per.tab || 'pindah', list = P[tab], np = P.pindah.filter(x => x.status === 'Menunggu').length, ni = P.izin.filter(x => x.status === 'Menunggu').length;
    const units = (A.d.komputer || []).filter(k => k.aktif && k.status !== 'maintenance');
    const card = x => { const mp = x.status === 'Menunggu', pi = tab === 'pindah'; return '<div class="card" style="' + (mp ? '' : 'opacity:.7') + '"><div class="row sp wrap"><div class="row"><span class="av">' + esc(LA.initials(x.nama)) + '</span><div><b>' + esc(x.nama) + '</b><div class="sm mut num">' + esc(x.kelas) + ' • NISN ' + esc(x.nisn) + '</div></div></div><div class="row">' + (mp ? '<span class="badge warn">Menunggu</span>' : H.badge(esc(x.status), x.status === 'Disetujui' ? '' : 'err')) + '<span class="sm mut num">' + esc(x.waktu.slice(5, 16)) + '</span></div></div>' +
      '<div style="margin:12px 0"><span class="up">' + (pi ? 'Pindah komputer' : x.jenis === 'komputer' ? 'Izin memakai komputer terpakai' : 'Izin presensi di luar jadwal') + '</span><p style="margin-top:4px">“' + esc(x.alasan) + '”</p>' + (pi ? '<div class="row wrap" style="margin-top:8px"><span class="pcid">' + esc(x.asal) + '</span>' + ic('arrow_forward', 's18 mut') + (mp ? '<select class="inp" style="width:auto;height:34px" id="tj-' + x.id + '"><option value="">Pilih tujuan…</option>' + units.filter(u => u.deviceId !== x.asal).map(u => '<option' + (u.deviceId === x.tujuan ? ' selected' : '') + '>' + esc(u.deviceId) + '</option>').join('') + '</select>' : '<span class="pcid">' + esc(x.tujuan || '-') + '</span>') + '</div>' : x.jenis === 'komputer' ? '<div class="sm mut" style="margin-top:6px">Komputer: <b>' + esc(x.deviceId) + '</b></div>' : '') + '</div>' +
      (mp ? '<div class="row" style="justify-content:flex-end"><button class="btn" data-act="p.proses" data-t="' + tab + '" data-id="' + x.id + '" data-k="tolak">Tolak</button><button class="btn p" data-act="p.proses" data-t="' + tab + '" data-id="' + x.id + '" data-k="setuju">' + ic('check', 's18') + 'Setujui</button></div>' : '<div class="sm mut">Diproses oleh ' + esc(x.admin) + ' • ' + esc((x.waktuProses || '').slice(5, 16)) + '</div>') + '</div>'; };
    return H.head('Persetujuan', 'Antrean Persetujuan &amp; Pengecualian', 'Perpindahan komputer dan izin presensi di luar jadwal.', '') +
      '<div class="tabs" style="align-self:flex-start"><button class="' + (tab === 'pindah' ? 'on' : '') + '" data-act="p.tab" data-t="pindah">' + ic('swap_horiz', 's18') + 'Pindah Komputer' + (np ? ' <span class="badge warn">' + np + '</span>' : '') + '</button><button class="' + (tab === 'izin' ? 'on' : '') + '" data-act="p.tab" data-t="izin">' + ic('assignment_turned_in', 's18') + 'Izin Presensi' + (ni ? ' <span class="badge warn">' + ni + '</span>' : '') + '</button></div>' +
      (list.length ? '<div class="g2">' + list.map(card).join('') + '</div>' : '<div class="card empty">Belum ada permintaan.</div>');
  } };
  LA.ACT['p.tab'] = el => { A.S.per.tab = el.dataset.t; A.draw(); };

  /* ================= MONITORING PRESENSI ================= */
  A.pages.presensi = {
    async load(quiet) {
      const S = A.S.pres; S.tgl = S.tgl || LA.iso(); if (!quiet) { S.rows = null; A.draw(); }
      const r = await LA.apiQ('presensi.list', { tanggal: S.tgl, kelasId: S.kelas || '' }); if (r.success && A.page === 'presensi') { S.rows = r.data.rows; if (!quiet || !$('.ov')) A.draw(); }
    },
    render() {
      const S = A.S.pres; S.tgl = S.tgl || LA.iso(); if (!S.rows && !S.fetching) { S.fetching = 1; setTimeout(() => { S.fetching = 0; A.pages.presensi.load(true); }, 0); }
      const q = (S.q || '').toLowerCase(), rows = (S.rows || []).filter(r => !q || (r.nama + r.nisn + r.deviceId).toLowerCase().includes(q));
      const c = s => (S.rows || []).filter(r => r.status === s).length;
      return H.head('Monitoring Presensi', 'Presensi Murid', 'Pantau presensi secara langsung berdasarkan waktu server.', '<span class="badge"><i class="dot pulse"></i>' + c('Hadir') + ' hadir</span><span class="badge warn">' + c('Terlambat') + ' terlambat</span>') +
        '<div class="card"><div class="row wrap"><input type="date" class="inp" style="width:auto" value="' + S.tgl + '" data-ch="pr.tgl"><select class="inp" style="width:auto" data-ch="pr.kelas">' + H.kelasOpt(S.kelas, 'Semua kelas') + '</select><div class="sch grow" style="min-width:180px"><span class="ms">search</span><input class="inp" placeholder="Cari nama / NISN / PC…" value="' + esc(S.q || '') + '" data-in="pr.q"></div></div></div>' +
        '<div class="card pad0"><div class="tw"><table class="t"><thead><tr><th>Waktu</th><th>NISN</th><th>Nama Murid</th><th>Kelas</th><th>Komputer</th><th>Status</th><th>Catatan</th></tr></thead><tbody>' +
        (S.rows ? (rows.length ? rows.map(r => '<tr><td class="num code">' + esc(r.waktu.slice(11, 19)) + '</td><td class="num code">' + esc(r.nisn) + '</td><td><div class="row"><span class="av">' + esc(LA.initials(r.nama)) + '</span><b>' + esc(r.nama) + '</b></div></td><td><span class="badge sq mut">' + esc(r.kelas) + '</span></td><td>' + (r.deviceId ? '<span class="pcid">' + esc(r.deviceId) + '</span>' : '<span class="mut">—</span>') + '</td><td>' + H.sbadge(r.status) + '</td><td class="sm mut">' + esc(r.catatan) + '</td></tr>').join('') : '<tr><td colspan="7" class="empty">Belum ada presensi pada tanggal ini.</td></tr>') : '<tr><td colspan="7"><div class="sk" style="height:120px"></div></td></tr>') + '</tbody></table></div></div>';
    }
  };
  LA.IN['pr.tgl'] = el => { A.S.pres.tgl = el.value; A.pages.presensi.load(); }; LA.IN['pr.kelas'] = el => { A.S.pres.kelas = el.value; A.pages.presensi.load(); };
  LA.IN['pr.q'] = LA.debounce(el => { A.S.pres.q = el.value; A.draw(); const i = $('[data-in="pr.q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200);

  /* ================= LOG ================= */
  A.pages.log = {
    async load() { const S = A.S.log; S.rows = null; A.draw(); const r = await LA.api('log.list', { q: S.q || '' }); if (r.success) { S.rows = r.data; if (A.page === 'log') A.draw(); } },
    render() {
      const S = A.S.log; if (!S.rows && !S.f) { S.f = 1; setTimeout(() => { S.f = 0; LA.api('log.list', { q: S.q || '' }).then(r => { if (r.success) { S.rows = r.data; if (A.page === 'log') A.draw(); } }); }, 0); }
      return H.head('Log Aktivitas', 'Riwayat Aktivitas Sistem', 'Setiap aksi penting tercatat. Rahasia (PIN, token, sandi) tidak pernah dicatat.', '') +
        '<div class="card"><div class="row"><div class="sch grow"><span class="ms">search</span><input class="inp" id="lq" placeholder="Cari aksi, pelaku, entitas…" value="' + esc(S.q || '') + '"></div><button class="btn p" data-act="lg.cari">Cari</button></div></div><div class="card pad0"><div class="tw"><table class="t"><thead><tr><th>Waktu</th><th>Pelaku</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead><tbody>' +
        (S.rows ? (S.rows.length ? S.rows.map(l => '<tr><td class="num code" style="white-space:nowrap">' + esc(l.waktu) + '</td><td class="sm">' + esc(l.aktor) + '</td><td><span class="badge sq ' + (/TOLAK|GAGAL|KUNCI|HAPUS/.test(l.aksi) ? 'err' : 'mut') + '">' + esc(l.aksi) + '</span></td><td class="sm">' + esc(l.entitas) + '</td><td class="sm mut">' + esc(l.detail) + '</td></tr>').join('') : '<tr><td colspan="5" class="empty">Tidak ada log.</td></tr>') : '<tr><td colspan="5"><div class="sk" style="height:140px"></div></td></tr>') + '</tbody></table></div></div>';
    }
  };
  LA.ACT['lg.cari'] = () => { A.S.log.q = $('#lq').value; A.pages.log.load(); };

  /* ================= KOREKSI PRESENSI ================= */
  A.pages.koreksi = {
    async load(quiet) { const S = A.S.kor; S.tgl = S.tgl || LA.iso(); if (!quiet) { S.rows = null; A.draw(); } const r = await LA.api('laporan.rekap', { mode: 'harian', tanggal: S.tgl, kelasId: S.kelas || '' }); if (r.success) { S.rows = r.data.sesiRows || []; S.edit = {}; if (A.page === 'koreksi') A.draw(); } else LA.toast(r.message, 'err'); },
    render() {
      const S = A.S.kor; S.tgl = S.tgl || LA.iso(); S.edit = S.edit || {}; if (!S.rows && !S.f) { S.f = 1; setTimeout(() => { S.f = 0; A.pages.koreksi.load(true); }, 0); }
      const q = (S.q || '').toLowerCase(), rows = (S.rows || []).filter(r => !q || (r.nama + r.nisn).toLowerCase().includes(q)).slice(0, 120);
      const opt = (cur, v) => ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Alpa'].map(s => '<option' + (s === v ? ' selected' : '') + '>' + s + '</option>').join('') + (cur === 'Belum' && !v ? '' : '');
      return H.head('Koreksi Presensi', 'Koreksi Data Presensi', 'Ubah status atau tambahkan presensi murid. Setiap koreksi tercatat di log beserta pelakunya.', '') +
        '<div class="card"><div class="row wrap"><input type="date" class="inp" style="width:auto" value="' + S.tgl + '" data-ch="ko.tgl"><select class="inp" style="width:auto" data-ch="ko.kelas">' + H.kelasOpt(S.kelas, 'Semua kelas') + '</select><div class="sch grow" style="min-width:180px"><span class="ms">search</span><input class="inp" placeholder="Cari nama / NISN…" value="' + esc(S.q || '') + '" data-in="ko.q"></div></div></div>' +
        '<div class="card pad0"><div class="tw"><table class="t"><thead><tr><th>Murid</th><th>Kelas</th><th>Sesi</th><th>Status saat ini</th><th>Ubah menjadi</th><th></th></tr></thead><tbody>' +
        (S.rows ? (rows.length ? rows.map((r, i) => { const k = r.muridId + '|' + r.jadwalId, ev = S.edit[k]; return '<tr><td><div class="row"><span class="av">' + esc(LA.initials(r.nama)) + '</span><div><b>' + esc(r.nama) + '</b><div class="sm mut num">' + esc(r.nisn) + '</div></div></div></td><td><span class="badge sq mut">' + esc(r.kelas) + '</span></td><td class="sm">' + esc(r.mapel) + '<div class="mut num">' + esc(r.jam) + '</div></td><td>' + H.sbadge(r.status) + (r.waktu ? ' <span class="sm mut num">' + r.waktu + '</span>' : '') + '</td><td><select class="inp" style="width:130px;height:34px" data-ch="ko.pilih" data-k="' + esc(k) + '"><option value="">Pilih…</option>' + opt(r.status, ev) + '</select></td><td class="tr" style="white-space:nowrap"><button class="btn p xs" data-act="ko.simpan" data-i="' + S.rows.indexOf(r) + '"' + (ev ? '' : ' disabled') + '>Simpan</button>' + (r.id ? ' <button class="btn xs" data-act="ko.hapus" data-i="' + S.rows.indexOf(r) + '" aria-label="Hapus">' + ic('delete', 's16') + '</button>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="empty">Tidak ada sesi terjadwal pada tanggal/kelas ini.</td></tr>') : '<tr><td colspan="6"><div class="sk" style="height:140px"></div></td></tr>') + '</tbody></table></div></div>';
    }
  };
  LA.IN['ko.tgl'] = el => { A.S.kor.tgl = el.value; A.pages.koreksi.load(); }; LA.IN['ko.kelas'] = el => { A.S.kor.kelas = el.value; A.pages.koreksi.load(); };
  LA.IN['ko.q'] = LA.debounce(el => { A.S.kor.q = el.value; A.draw(); const i = $('[data-in="ko.q"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200);
  LA.IN['ko.pilih'] = el => { A.S.kor.edit[el.dataset.k] = el.value; const b = el.closest('tr').querySelector('[data-act="ko.simpan"]'); if (b) b.disabled = !el.value; };
  LA.ACT['ko.simpan'] = async b => {
    const S = A.S.kor, r = S.rows[+b.dataset.i], st = S.edit[r.muridId + '|' + r.jadwalId]; if (!st) return;
    const x = await A.W(b, 'presensi.koreksi', r.id ? { id: r.id, tanggal: S.tgl, status: st, catatan: 'Koreksi admin' } : { muridId: r.muridId, tanggal: S.tgl, jadwalId: r.jadwalId, status: st, catatan: 'Input manual admin' });
    if (x) { A.pages.koreksi.load(true); A.reload('dash', true); }
  };
  LA.ACT['ko.hapus'] = async b => { const S = A.S.kor, r = S.rows[+b.dataset.i]; if (!await LA.confirm('Hapus presensi?', 'Presensi ' + r.nama + ' pada ' + LA.dmy(S.tgl) + ' akan dihapus permanen (tercatat di log).', 'Hapus', true)) return; const x = await A.W(null, 'presensi.koreksi', { id: r.id, tanggal: S.tgl, hapus: true }); if (x) { A.pages.koreksi.load(true); A.reload('dash', true); } };
})();
