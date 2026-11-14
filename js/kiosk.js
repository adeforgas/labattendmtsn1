/* LabAttend — Terminal Kiosk Murid. Alur: Beranda → Nama → PIN → Konfirmasi → Bukti. Data murid dimuat sekali (boot) → antar langkah instan. */
(function () {
  'use strict';
  const { esc, ic, $, $$, LS } = LA;
  const K = LA.kiosk = { dev: LS.get('la_dev', null), b: LS.get('la_kboot', null), step: 'home', sel: null, pin: '', ticket: '', res: null, pre: null, tolak: null, izin: null, kelas: '', q: '', route: '/', busy: false, err: '', rt: null, tm: null, pub: null };
  const STEPS = [['home', '0. Beranda'], ['kelas', '1. Nama'], ['pin', '2. PIN'], ['konfirm', '3. Konfirmasi'], ['sukses', 'Sukses']];
  const devOk = () => !!(K.b && K.b.device && K.b.device.ok);
  const body = () => ({ deviceId: K.dev ? K.dev.id : '', token: K.dev ? K.dev.token : '' });

  /* ---------- shell ---------- */
  function shell() {
    if ($('#kshell')) return;
    $('#app').innerHTML = '<div id="kshell"><header class="k-hd"><div class="in">' + LA.logoImg() + '<b style="font-size:16px" data-brand="nama">' + esc(LA.app.namaApp) + '</b><span class="pill mint hid" data-brand="lab">' + esc(LA.app.namaSekolah + ' - ' + LA.app.namaLab) + '</span>' +
      '<nav class="k-nav"><a href="#/tata" data-r="/tata">Tata Tertib</a><a href="#/presensi" data-r="/">Presensi Murid</a><a href="#/jadwal" data-r="/jadwal">Jadwal Praktikum</a><a href="#/unit" data-r="/unit">Status Unit PC</a></nav><span class="grow"></span>' +
      '<span class="pill hid">' + ic('schedule', 's16 pri') + '<span data-clock>--:--:--</span> WIB</span><span class="pill hid"><i class="dot pulse"></i><span id="kon">Lab</span></span>' +
      '<a class="btn g sm" href="#/login">' + ic('admin_panel_settings', 's18') + '<span class="hid2">Login Admin</span></a></div></header><main class="k-main" id="km"></main>' +
      '<footer class="k-ft"><span><b data-brand="sekolah">' + esc(LA.app.namaSekolah) + '</b> • Laboratorium Komputer &amp; Multimedia</span><span id="kfid"></span></footer>' +
      '<nav class="k-bn"><a href="#/tata" data-r="/tata">' + ic('gavel') + 'Tata Tertib</a><a href="#/presensi" data-r="/">' + ic('how_to_reg') + 'Presensi</a><a href="#/jadwal" data-r="/jadwal">' + ic('calendar_month') + 'Jadwal</a><a href="#/unit" data-r="/unit">' + ic('desktop_windows') + 'Unit PC</a><a href="#/login">' + ic('admin_panel_settings') + 'Admin</a></nav></div>';
    if (!K.tm) K.tm = setInterval(tick, 1000);
  }
  function tick() {
    const n = LA.Clock.now(), t = LA.fmtTime(n);
    $$('[data-clock]').forEach(e => { e.textContent = t; }); const d = $('#kdate'); if (d) d.textContent = LA.fmtDate(n);
    if (K.route === '/' && K.step === 'home' && !(+t.slice(6) % 30)) boot(true);       // cek jadwal tiap 30 dtk
  }
  function chips() {
    const u = K.b && K.b.unit; const o = $('#kon'); if (o) o.textContent = u ? 'Lab: Online (' + u.aktif + '/' + u.total + ')' : 'Lab';
    const f = $('#kfid'); if (f) f.textContent = (K.dev ? 'Terminal ID: ' + K.dev.id : 'Terminal belum diaktivasi') + '  ©  ' + new Date().getFullYear() + ' ' + LA.app.namaApp + ' System';
    LA.setApp(K.b && K.b.app);
  }

  /* ---------- data ---------- */
  async function boot(quiet) {
    const r = await LA.api('kiosk.boot', body());
    if (!r.success) { if (!quiet && !K.b) $('#km') && ($('#km').innerHTML = '<div class="k-wrap"><div class="alert e">' + ic('cloud_off') + '<div><b>' + esc(r.message) + '</b></div></div><p style="margin-top:12px"><button class="btn p" data-act="k.retry">Coba lagi</button></p></div>'); return; }
    K.b = r.data; LS.set('la_kboot', r.data); chips();
    if (K.route === '/' && (K.step === 'home' || !devOk())) draw();
  }
  LA.ACT['k.retry'] = () => boot();
  const killTimers = () => { clearTimeout(K.rt); clearInterval(K.poll); };
  function reset() { killTimers(); Object.assign(K, { step: 'home', sel: null, pin: '', ticket: '', res: null, pre: null, tolak: null, izin: null, q: '', err: '', busy: false, tataOk: false }); LA.go('#/tata'); }

  /* ---------- router kiosk ---------- */
  K.show = function (h) {
    shell(); killTimers();
    const m = /^\/aktivasi\/([^~\/]+)~(.+)$/.exec(h);
    if (m) { K.dev = { id: decodeURIComponent(m[1]).toUpperCase(), token: m[2] }; LS.set('la_dev', K.dev); LA.toast('Komputer ' + K.dev.id + ' diaktivasi', 'ok'); history.replaceState(null, '', location.pathname + '#/tata'); h = '/tata'; K.b = null; K.tataOk = false; }
    // Rute: '/tata' = tata tertib (halaman awal), '/' = presensi, '/jadwal', '/unit'.
    // Presensi hanya boleh dibuka setelah murid menekan LANJUT (K.tataOk). Membuka alamat presensi langsung dialihkan ke tata tertib.
    // Menekan tautan Tata Tertib dari navigasi mencabut persetujuan: harus membaca lalu LANJUT lagi
    if (h === '/tata' && K.route === '/' && K.step === 'home') K.tataOk = false;
    const bukaPresensi = (h === '/presensi' || h === '/');
    if (h === '/jadwal' || h === '/unit') K.route = h;
    else K.route = (bukaPresensi && K.tataOk) ? '/' : '/tata';           // tanpa LANJUT, presensi tidak bisa dibuka
    $$('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === K.route));
    chips(); tick();
    if (K.route === '/tata') return tataView();
    if (K.route === '/') { if (!K.b) skeleton(); else draw(); boot(); }
    else if (K.route === '/jadwal') jadwal(); else unit();
  };
  /* ---------- Tata tertib: halaman awal murid (v1.2) ---------- */
  async function tataView() {
    const km = $('#km'), kd = $('#kdate'); if (!km) return;
    $$('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === '/tata'));
    km.innerHTML = '<div class="k-wrap"><div class="k-card"><div class="sk" style="height:34px;width:60%;margin-bottom:18px"></div><div class="sk" style="height:200px;margin-bottom:14px"></div><div class="sk" style="height:52px"></div></div></div>';
    const r = await LA.api('tata.list', {});
    if (K.route !== '/tata') return;
    if (!r.success) { km.innerHTML = '<div class="k-wrap"><div class="k-card"><div class="alert e">' + ic('cloud_off') + '<div><b>' + esc(r.message) + '</b></div></div><p style="margin-top:14px"><button class="btn p" data-act="k.tataRetry">Coba lagi</button></div></div>'; return; }
    const d = r.data, lanjut = '<button class="btn p lg blk" data-act="k.lanjutPresensi" style="margin-top:22px">' + ic('how_to_reg') + 'LANJUT KE MENU PRESENSI</button>';
    km.innerHTML = '<div class="k-wrap"><div class="k-card tata">' +
      '<div class="row" style="margin-bottom:14px">' + LA.logoImg('k-logo') + '<div><b style="font-size:16px" data-brand="nama">' + esc(LA.app.namaApp) + '</b><div class="sm pri b" data-brand="sekolah">' + esc(LA.app.namaSekolah) + '</div></div></div>' +
      '<h1 class="ctr" style="font-size:22px;line-height:30px;letter-spacing:.02em;margin:6px 0 4px">TATA TERTIB LABORATORIUM KOMPUTER</h1>' +
      '<div class="ctr sm mut" style="margin-bottom:18px">' + esc(LA.app.namaLab || '') + '</div>' +
      (d.tersedia ? '<ol class="tata-list" style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px">' + d.daftar.map(x => '<li style="list-style:none;display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;font-size:15px;line-height:23px">' + '<span class="tata-no" style="flex:none;width:30px;height:30px;border-radius:50%;background:#DCFCE7;color:#14532D;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">' + x.no + '</span>' + '<span style="flex:1;min-width:0">' + esc(x.isi) + '</span></li>').join('') + '</ol>' + lanjut
        : '<div class="alert i" style="margin:6px 0">' + ic('info') + '<div><b>Tata tertib belum tersedia.</b><br>Silakan hubungi admin lab. Anda tetap dapat melanjutkan ke presensi.</div></div>' + lanjut) +
      '</div></div>';
  }
  LA.ACT['k.tataRetry'] = () => tataView();
  LA.ACT['k.lanjutPresensi'] = () => { K.tataOk = true; LA.go('#/presensi'); };
  LA.ACT['k.kembaliTata'] = () => { K.tataOk = false; K.step = 'home'; LA.go('#/tata'); };
  const skeleton = () => { $('#km').innerHTML = '<div class="k-wrap"><div class="k-card"><div class="sk" style="height:34px;width:50%;margin-bottom:18px"></div><div class="sk" style="height:90px;margin-bottom:14px"></div><div class="sk" style="height:110px;margin-bottom:14px"></div><div class="sk" style="height:52px"></div></div></div>'; };

  /* ---------- gambar langkah ---------- */
  function draw() {
    const km = $('#km'); if (!km || K.route !== '/') return;
    const f = { home: vHome, kelas: vKelas, pin: vPin, konfirm: vKonfirm, sukses: vSukses, tolak: vTolak, izin: vIzin, tunggu: vTunggu, pindah: vPindah, sudah: vSukses }[K.step] || vHome;
    const idx = STEPS.findIndex(s => s[0] === (K.step === 'sudah' ? 'sukses' : K.step));
    km.innerHTML = '<div class="k-wrap">' + (idx >= 0 && devOk() ? '<div class="steps">' + STEPS.map((s, i) => '<span class="' + (i === idx ? 'on' : i < idx ? 'done' : '') + '">' + s[1] + '</span>').join('') + '</div>' : '') + '<div class="k-card">' + f() + '</div></div>';
    if (K.step === 'kelas') { roster(); const s = $('#kq'); if (s && !('ontouchstart' in window)) s.focus(); }
    tick();
  }
  const head = () => '<div class="row sp" style="margin-bottom:18px"><div class="row">' + LA.logoImg('k-logo') + '<div><b style="font-size:18px">' + esc(LA.app.namaApp) + '</b><div class="sm pri b">' + esc(LA.app.namaSekolah) + '</div></div></div><a class="btn sm" href="#/login">' + ic('admin_panel_settings', 's18') + 'Login Admin</a></div>';

  function vHome() {
    const b = K.b, ok = devOk(), dev = b.device || {}, reason = dev.reason;
    const msg = { BELUM_AKTIVASI: 'Komputer ini belum diaktivasi.', TIDAK_TERDAFTAR: 'Komputer tidak terdaftar di sistem.', TOKEN_TIDAK_VALID: 'Token komputer tidak valid / sudah diganti.', NONAKTIF: 'Komputer ini dinonaktifkan oleh admin.', MAINTENANCE: 'Komputer sedang dalam perbaikan.' }[reason] || '';
    const sesi = (b.sesi || []).filter(s => s.fase !== 'berlangsung' || true);
    let h = head() + '<div class="box"><div class="row sp"><span class="up">Identitas Komputer</span>' + (ok ? '<span class="badge"><i class="dot"></i>Terdaftar</span>' : '<span class="badge err"><i class="dot"></i>Tidak Terdaftar</span>') + '</div><div class="row sp" style="margin-top:6px"><b style="font-size:26px;letter-spacing:-.01em">' + esc(K.dev ? K.dev.id : '—') + '</b>' + (ok ? '<span class="sm mut">Token: valid</span>' : '') + '</div></div>';
    h += '<div class="ctr" style="padding:20px 0 14px"><div class="sm mut" id="kdate">&nbsp;</div><div class="clock" data-clock>--:--:--</div><div class="sm mut">' + ic('sync', 's16 pri') + ' Waktu Server GAS (Sinkron)</div></div>';
    if (!ok) {
      h += '<div class="alert e">' + ic('gpp_bad', 'fill') + '<div><b>' + esc(msg || 'Komputer tidak dapat dipakai.') + '</b><br>Hubungi admin lab untuk mendaftarkan/mengaktifkan komputer ini.</div></div>' +
        '<details style="margin-top:12px"><summary class="sm b" style="cursor:pointer">Aktivasi manual (khusus admin)</summary><div class="col" style="margin-top:10px"><input class="inp" id="ad-id" placeholder="Device ID, mis. LAB-PC-01"><input class="inp" id="ad-tk" placeholder="Token komputer" autocomplete="off"><button class="btn p" data-act="k.aktif">Aktivasi</button></div></details>';
      return h;
    }
    h += '<div class="box" style="margin-bottom:16px"><div class="row sp"><span class="up">Jadwal Sesi Aktif</span>' + (sesi.length ? '<span class="badge">Presensi Dibuka</span>' : '<span class="badge mut">Tidak ada sesi</span>') + '</div>';
    if (sesi.length) h += sesi.map(s => '<div style="margin-top:10px"><b style="font-size:17px">Kelas ' + esc(s.kelas) + '</b><div class="mut">' + esc(s.mapel) + '</div><div class="row sp" style="margin-top:6px"><span class="row mut">' + ic('schedule', 's18') + esc(s.mulai) + ' — ' + esc(s.selesai) + ' WIB</span>' + (s.fase === 'buka' ? '<span class="badge warn">Belum dimulai</span>' : '') + '</div></div>').join('');
    else h += '<p class="mut" style="margin-top:8px">Belum ada kelas yang jadwalnya terbuka sekarang.</p>';
    h += '<div class="row sp" style="margin-top:10px"><span class="sm mut">Status komputer</span><span class="badge ' + (b.pakai ? 'warn' : 'mut') + '">' + (b.pakai ? 'Sudah Digunakan' : 'Belum Digunakan') + '</span></div></div>';
    if (b.maint) return h + '<div class="alert" style="margin-bottom:12px">' + ic('construction', 'fill') + '<div><b>Sistem sedang dalam pemeliharaan database.</b><br>Presensi dibuka kembali otomatis setelah selesai (beberapa menit).</div></div><button class="btn lg blk" disabled>Presensi dinonaktifkan sementara</button>';
    return h + '<button class="btn p lg blk" data-act="k.mulai">Mulai Presensi ' + ic('arrow_forward') + '</button>';
  }
  LA.ACT['k.aktif'] = () => { const id = $('#ad-id').value.trim().toUpperCase(), tk = $('#ad-tk').value.trim(); if (!id || !tk) return LA.toast('Isi Device ID dan token', 'err'); K.dev = { id: id, token: tk }; LS.set('la_dev', K.dev); K.b = null; skeleton(); boot(); };
  LA.ACT['k.mulai'] = () => { K.step = 'kelas'; const s = (K.b.sesi || [])[0]; if (!K.kelas && s) K.kelas = s.kelasId; draw(); };

  function vKelas() {
    const kl = K.b.kelas || [];
    return '<div class="row sp" style="margin-bottom:14px"><h2>Pilih nama Anda</h2><button class="btn g sm" data-act="k.reset">' + ic('close', 's18') + 'Batal</button></div>' +
      '<div class="g2" style="gap:10px"><select class="inp kiosk" data-ch="k.kelas" aria-label="Kelas"><option value="">Pilih kelas…</option>' + kl.map(k => '<option value="' + esc(k.id) + '"' + (k.id === K.kelas ? ' selected' : '') + '>Kelas ' + esc(k.nama) + '</option>').join('') + '</select>' +
      '<div class="sch"><span class="ms">search</span><input class="inp kiosk" id="kq" data-in="k.q" placeholder="Cari nama…" value="' + esc(K.q) + '" autocomplete="off"></div></div><div class="ros" id="ros"></div>';
  }
  function roster() {
    const el = $('#ros'); if (!el) return;
    if (!K.kelas && !K.q) { el.innerHTML = '<div class="empty">Pilih kelas terlebih dahulu.</div>'; return; }
    const q = K.q.toLowerCase(), list = (K.b.murid || []).filter(m => (!K.kelas || m.k === K.kelas) && (!q || m.n.toLowerCase().includes(q))).sort((a, b) => a.n.localeCompare(b.n)).slice(0, 80);
    el.innerHTML = list.length ? list.map(m => '<button data-act="k.pilih" data-id="' + esc(m.id) + '"><span class="av">' + esc(LA.initials(m.n)) + '</span><span class="grow">' + esc(m.n) + '</span>' + (m.l ? '<span class="badge err">' + ic('lock', 's16') + 'Terkunci</span>' : ic('chevron_right', 'mut')) + '</button>').join('') : '<div class="empty">Nama tidak ditemukan.</div>';
  }
  LA.IN['k.kelas'] = el => { K.kelas = el.value; roster(); }; LA.IN['k.q'] = el => { K.q = el.value; roster(); };
  LA.ACT['k.reset'] = reset;
  LA.ACT['k.pilih'] = el => { const m = (K.b.murid || []).find(x => x.id === el.dataset.id); if (!m) return; if (m.l) return LA.toast('PIN murid ini terkunci. Hubungi admin lab.', 'err'); K.sel = m; K.pin = ''; K.err = ''; K.step = 'pin'; draw(); };

  function vPin() {
    const m = K.sel, kn = ((K.b.kelas || []).find(k => k.id === m.k) || {}).nama || m.k;
    return '<div class="row sp"><button class="btn g sm" data-act="k.back">' + ic('arrow_back', 's18') + 'Kembali</button></div><div class="ctr" style="margin-top:6px"><span class="av" style="width:56px;height:56px;font-size:18px;margin:0 auto">' + esc(LA.initials(m.n)) + '</span><h2 style="margin-top:8px">' + esc(m.n) + '</h2><div class="mut">Kelas ' + esc(kn) + '</div></div>' +
      '<p class="ctr mut" style="margin-top:14px">Masukkan PIN 4 digit <span class="sm">(4 digit terakhir NISN)</span></p><div class="dots' + (K.err ? ' bad' : '') + '" id="dots">' + [0, 1, 2, 3].map(i => '<i class="' + (i < K.pin.length ? 'f' : '') + '"></i>').join('') + '</div>' +
      '<div class="ctr" style="min-height:22px;color:var(--err);font-weight:500" id="perr">' + esc(K.err) + '</div><div class="pad" style="margin-top:8px">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => '<button data-act="k.key" data-k="' + n + '">' + n + '</button>').join('') + '<button class="fn" data-act="k.key" data-k="C">Hapus</button><button data-act="k.key" data-k="0">0</button><button class="fn" data-act="k.key" data-k="B" aria-label="Hapus satu">' + ic('backspace') + '</button></div>';
  }
  LA.ACT['k.back'] = () => { K.step = 'kelas'; K.err = ''; draw(); };
  function pinKey(k) {
    if (K.busy) return;
    if (k === 'C') K.pin = ''; else if (k === 'B') K.pin = K.pin.slice(0, -1); else if (K.pin.length < 4) K.pin += k;
    K.err = ''; const d = $('#dots'); if (d) { d.className = 'dots'; d.innerHTML = [0, 1, 2, 3].map(i => '<i class="' + (i < K.pin.length ? 'f' : '') + '"></i>').join(''); $('#perr').textContent = ''; }
    if (K.pin.length === 4) verify();
  }
  LA.ACT['k.key'] = el => pinKey(el.dataset.k);
  document.addEventListener('keydown', e => {
    if (K.route !== '/' || K.step !== 'pin' || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    if (/^\d$/.test(e.key)) pinKey(e.key); else if (e.key === 'Backspace') pinKey('B'); else if (e.key === 'Escape') pinKey('C');
  });
  async function verify() {
    K.busy = true; const d = $('#dots'); if (d) d.style.opacity = '.5';
    const r = await LA.api('kiosk.verifyPin', Object.assign({ muridId: K.sel.id, pin: K.pin }, body()));
    K.busy = false;
    if (!r.success) {
      if (r.code === 'MAINT') { LA.toast(r.message, 'err'); boot(true); reset(); return; }
      K.pin = ''; K.err = r.message;
      if (r.code === 'TERKUNCI') { const m = (K.b.murid || []).find(x => x.id === K.sel.id); if (m) m.l = 1; LS.set('la_kboot', K.b); K.step = 'kelas'; draw(); LA.toast(r.message, 'err'); return; }
      if (r.code && r.code.indexOf('DEVICE_') === 0) { K.b = null; boot(); }
      draw(); return;
    }
    const x = r.data; K.ticket = x.tiket; K.pre = x;
    if (x.sudah) { K.res = x.sudah; K.step = 'sudah'; } else if (x.tolak) { K.tolak = x.tolak; K.step = 'tolak'; } else K.step = 'konfirm';
    draw();
  }

  function vKonfirm() {
    const x = K.pre, j = x.jadwal || {}, late = x.status === 'Terlambat';
    return '<h2 style="margin-bottom:12px">Konfirmasi Presensi</h2><div class="alert ' + (late ? '' : 'ok') + '" style="margin-bottom:14px">' + ic(late ? 'schedule' : 'check_circle', 'fill') + '<div>Status Anda akan dicatat <b>' + (late ? 'TERLAMBAT' : 'HADIR (TEPAT WAKTU)') + '</b> berdasarkan waktu server.</div></div>' +
      '<div class="kv"><span>Nama</span><span>' + esc(x.nama) + '</span></div><div class="kv"><span>Kelas</span><span>' + esc(x.kelas) + '</span></div><div class="kv"><span>Komputer</span><span><span class="pcid">' + ic('desktop_windows', 's16') + esc(x.deviceId) + '</span></span></div><div class="kv"><span>Mata Pelajaran</span><span>' + esc(j.mapel || '-') + '</span></div>' +
      '<div class="col" style="margin-top:18px"><button class="btn p lg blk" id="kgo" data-act="k.submit">' + ic('how_to_reg') + 'Presensi</button><button class="btn g blk" data-act="k.reset">Batal</button></div>';
  }
  LA.ACT['k.submit'] = async el => {
    LA.busy(el, true, 'Mencatat…');
    const r = await LA.api('kiosk.submit', Object.assign({ tiket: K.ticket }, body()));
    if (!r.success) { LA.busy(el, false); if (r.code === 'MAINT') { LA.toast(r.message, 'err'); boot(true); reset(); return; } if (r.code === 'KOMPUTER_TERPAKAI' || r.code === 'LUAR_JADWAL') { K.tolak = { code: r.code, msg: r.message, bisaIzin: r.code === 'LUAR_JADWAL' ? 'luar_jadwal' : 'komputer' }; K.step = 'tolak'; draw(); } else LA.toast(r.message, 'err'); return; }
    K.res = r.data; K.step = 'sukses'; const m = (K.b.murid || []); K.b.pakai = true; draw();
    K.rt = setTimeout(reset, 60000);
  };

  function vSukses() {
    const r = K.res, late = r.status === 'Terlambat', dup = K.step === 'sudah', j = r.jadwal || {};
    const w = String(r.waktu || '').split(' '), tgl = w[0] ? LA.dmy(w[0]) : '', col = late ? 'var(--warn)' : 'var(--pri)';
    return '<div class="rcpt-top" style="background:' + col + '"></div><div class="ctr"><div class="okc ' + (late ? 'w' : '') + '">' + ic(late ? 'warning' : 'check_circle', 's40 fill') + '</div><h1 style="font-size:28px;line-height:36px">' + (dup ? 'Anda Sudah Presensi' : late ? 'Presensi Tercatat (Terlambat)' : 'Presensi Berhasil Dicatat') + '</h1>' +
      '<div class="row mut" style="justify-content:center;margin-top:4px">' + ic('schedule', 's16 pri') + 'Waktu Server: ' + esc(tgl) + ', ' + esc(w[1] || '') + ' WIB</div><div style="margin-top:12px"><span class="badge ' + (late ? 'warn' : '') + '"><i class="dot"></i>' + (late ? 'TERLAMBAT' : 'HADIR (TEPAT WAKTU)') + '</span></div></div><div class="tear"><i></i></div>' +
      '<div class="kv"><span>Nama Murid</span><span>' + esc(r.nama) + '</span></div><div class="kv"><span>NISN</span><span class="num">' + esc(r.nisn) + '</span></div><div class="kv"><span>Kelas</span><span>' + esc(r.kelas) + '</span></div><div class="kv"><span>Nomor Komputer</span><span><span class="pcid">' + ic('desktop_windows', 's16') + esc(r.deviceId) + '</span></span></div><div class="kv"><span>Mata Pelajaran</span><span>' + esc(j.mapel || '-') + '</span></div><div class="kv"><span>ID Sesi</span><span class="mut num" style="font-size:12px">' + esc(r.sesiId) + '</span></div>' +
      (j.selesai ? '<div class="alert i" style="margin-top:14px">' + ic('lock', 'pri') + '<div>Komputer <b class="pri">' + esc(r.deviceId) + '</b> telah terkunci untuk profil Anda hingga sesi praktikum selesai pukul <b>' + esc(j.selesai) + ' WIB</b>.</div></div>' : '') +
      '<div class="col" style="margin-top:20px"><button class="btn p lg blk" data-act="k.reset">' + ic('check') + 'Selesai &amp; Mulai Praktikum</button><button class="btn g blk" data-act="k.pindah">' + ic('swap_horiz', 's18') + 'Minta Izin Pindah Komputer</button></div>';
  }

  function vTolak() {
    const t = K.tolak, pc = t.code === 'KOMPUTER_TERPAKAI';
    return '<div class="ctr"><div class="okc e">' + ic(pc ? 'lock' : 'event_busy', 's40 fill') + '</div><h2>' + (pc ? 'Komputer Sudah Terpakai' : 'Di Luar Jadwal Presensi') + '</h2><p class="mut" style="margin-top:8px">' + esc(t.msg) + '</p></div>' +
      '<div class="alert" style="margin-top:16px">' + ic('info') + '<div>' + (pc ? 'Pindah ke komputer lain, atau ajukan izin khusus kepada admin untuk memakai komputer ini.' : 'Presensi di luar jadwal hanya bisa dilakukan dengan persetujuan admin.') + '</div></div>' +
      '<div class="col" style="margin-top:18px">' + (t.bisaIzin ? '<button class="btn p lg blk" data-act="k.izinForm">' + ic('assignment_turned_in') + 'Ajukan Izin ke Admin</button>' : '') + '<button class="btn blk" data-act="k.reset">Kembali ke Beranda</button></div>';
  }
  const ALASAN = { luar_jadwal: ['Remedial / susulan praktik', 'Tugas dari guru', 'Terlambat karena kegiatan sekolah'], komputer: ['Komputer asal rusak', 'Teman salah memakai komputer', 'Diminta guru'] };
  function vIzin() {
    const jn = K.tolak.bisaIzin;
    return '<h2>Ajukan Izin ke Admin</h2><p class="mut" style="margin:4px 0 12px">Tulis alasan singkat. Admin akan memeriksa permintaan Anda.</p><div class="row wrap" style="margin-bottom:10px">' + ALASAN[jn].map(a => '<button class="chip" data-act="k.qr" data-v="' + esc(a) + '">' + esc(a) + '</button>').join('') + '</div><textarea class="inp" id="alasan" maxlength="200" placeholder="Alasan…"></textarea>' +
      '<div class="col" style="margin-top:14px"><button class="btn p lg blk" data-act="k.izinKirim">Kirim Permintaan</button><button class="btn g blk" data-act="k.toTolak">Batal</button></div>';
  }
  LA.ACT['k.izinForm'] = () => { K.step = 'izin'; draw(); }; LA.ACT['k.toTolak'] = () => { K.step = 'tolak'; draw(); };
  LA.ACT['k.qr'] = el => { $('#alasan').value = el.dataset.v; };
  LA.ACT['k.izinKirim'] = async el => {
    const a = $('#alasan').value.trim(); if (a.length < 3) return LA.toast('Tulis alasan terlebih dahulu', 'err');
    LA.busy(el, true); const r = await LA.api('kiosk.izin', Object.assign({ tiket: K.ticket, jenis: K.tolak.bisaIzin, alasan: a }, body())); LA.busy(el, false);
    if (!r.success) return LA.toast(r.message, 'err');
    K.izin = { token: r.data.izinToken, status: 'Menunggu' }; K.step = 'tunggu'; draw(); cek();
    K.poll = setInterval(cek, 5000);
  };
  async function cek() {
    if (K.step !== 'tunggu') return clearInterval(K.poll);
    const r = await LA.api('kiosk.cekIzin', { izinToken: K.izin.token }); if (!r.success) return;
    if (r.data.status !== K.izin.status) { K.izin.status = r.data.status; draw(); }
  }
  function vTunggu() {
    const s = K.izin.status;
    if (s === 'Disetujui') return '<div class="ctr"><div class="okc">' + ic('check_circle', 's40 fill') + '</div><h2>Izin Disetujui</h2><p class="mut" style="margin-top:6px">Silakan masukkan PIN kembali untuk melanjutkan presensi.</p></div><div class="col" style="margin-top:18px"><button class="btn p lg blk" data-act="k.lanjut">Lanjutkan Presensi</button></div>';
    if (s === 'Ditolak') return '<div class="ctr"><div class="okc e">' + ic('cancel', 's40 fill') + '</div><h2>Izin Ditolak</h2><p class="mut" style="margin-top:6px">Hubungi guru atau admin lab.</p></div><div class="col" style="margin-top:18px"><button class="btn blk" data-act="k.reset">Kembali ke Beranda</button></div>';
    return '<div class="ctr"><div class="okc w"><span class="spin" style="width:34px;height:34px"></span></div><h2>Menunggu Persetujuan Admin</h2><p class="mut" style="margin-top:6px">Halaman ini diperiksa otomatis setiap 5 detik. Tetap di komputer Anda.</p></div><div class="col" style="margin-top:18px"><button class="btn blk" data-act="k.reset">Batalkan &amp; Kembali</button></div>';
  }
  LA.ACT['k.lanjut'] = () => { K.pin = ''; K.err = ''; K.step = 'pin'; draw(); };

  /* ---------- pindah komputer ---------- */
  LA.ACT['k.pindah'] = async () => { clearTimeout(K.rt); K.step = 'pindah'; K.pub = null; draw(); const r = await LA.api('kiosk.publik', {}); if (r.success) { K.pub = r.data; const s = $('#tujuan'); if (s) s.innerHTML = '<option value="">Biar admin yang menentukan</option>' + r.data.unit.filter(u => u.s === 'kosong' && u.id !== K.res.deviceId).map(u => '<option>' + esc(u.id) + '</option>').join(''); } };
  function vPindah() {
    return '<h2>Minta Izin Pindah Komputer</h2><p class="mut" style="margin:4px 0 12px">Dari <span class="pcid">' + esc(K.res.deviceId) + '</span>. Admin akan menyetujui pemindahan.</p><div class="fld"><label>Komputer tujuan (opsional)</label><select class="inp kiosk" id="tujuan"><option value="">Memuat…</option></select></div><div class="row wrap" style="margin:12px 0 8px">' + ['Keyboard rusak', 'Mouse rusak', 'Komputer hang / lambat', 'Monitor bermasalah'].map(a => '<button class="chip" data-act="k.qr2" data-v="' + a + '">' + a + '</button>').join('') + '</div><textarea class="inp" id="alasan" maxlength="200" placeholder="Alasan pindah…"></textarea>' +
      '<div class="col" style="margin-top:14px"><button class="btn p lg blk" data-act="k.pindahKirim">Kirim Permintaan</button><button class="btn g blk" data-act="k.back2">Batal</button></div>';
  }
  LA.ACT['k.qr2'] = el => { $('#alasan').value = el.dataset.v; }; LA.ACT['k.back2'] = () => { K.step = 'sukses'; draw(); };
  LA.ACT['k.pindahKirim'] = async el => {
    const a = $('#alasan').value.trim(); if (a.length < 3) return LA.toast('Tulis alasan pindah', 'err');
    LA.busy(el, true); const r = await LA.api('kiosk.pindah', Object.assign({ reqToken: K.res.reqToken, alasan: a, tujuan: $('#tujuan').value }, body())); LA.busy(el, false);
    if (!r.success) return LA.toast(r.message, 'err'); LA.toast(r.message, 'ok'); K.step = 'sukses'; draw();
  };

  /* ---------- halaman publik: jadwal & unit ---------- */
  function jadwal() {
    const km = $('#km'), b = K.b, today = +(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(LA.Clock.now()) === 'Sun' ? 7 : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(LA.Clock.now())) + 1);
    const draw2 = () => {
      const J = (K.b && K.b.jadwal) || [];
      km.innerHTML = '<div class="k-wrap" style="max-width:820px"><div style="margin-bottom:16px"><div class="up">Terminal Kiosk Murid / <span class="pri">Jadwal Praktikum</span></div><h1>Jadwal Praktikum Lab</h1></div>' +
        ([1, 2, 3, 4, 5, 6, 7].map(d => { const L = J.filter(j => j.hari === d).sort((a, b) => a.mulai.localeCompare(b.mulai)); if (!L.length) return ''; return '<div class="jd-day"><div class="row" style="margin-bottom:8px"><h3>' + LA.HARI[d] + '</h3>' + (d === today ? '<span class="badge">Hari ini</span>' : '') + '</div><div class="col">' + L.map(j => '<div class="jd-it"><span class="tm num">' + esc(j.mulai) + ' — ' + esc(j.selesai) + '</span><div class="grow"><b>Kelas ' + esc(j.kelas) + '</b><div class="mut sm">' + esc(j.mapel) + (j.guru ? ' • ' + esc(j.guru) : '') + '</div></div></div>').join('') + '</div></div>'; }).join('') || '<div class="card empty">Belum ada jadwal.</div>') + '</div>';
    };
    if (b) draw2(); else km.innerHTML = '<div class="k-wrap"><div class="sk" style="height:200px"></div></div>';
    boot(true).then(draw2);
  }
  async function unit() {
    const km = $('#km'); let first = true;
    const go = async () => {
      if (K.route !== '/unit') return;
      const r = await LA.api('kiosk.publik', {}); if (!r.success || K.route !== '/unit') return;
      const U = r.data.unit, c = s => U.filter(u => u.s === s).length, lbl = { terpakai: 'Terpakai', kosong: 'Kosong', maintenance: 'Perbaikan', nonaktif: 'Nonaktif' };
      km.innerHTML = '<div class="k-wrap" style="max-width:820px"><div class="row sp wrap" style="margin-bottom:16px"><div><div class="up">Terminal Kiosk Murid / <span class="pri">Status Unit</span></div><h1>Status Unit PC</h1></div><div class="row"><span class="badge">' + c('terpakai') + ' terpakai</span><span class="badge mut">' + c('kosong') + ' kosong</span></div></div><div class="card"><div class="pcg">' +
        U.map(u => '<div class="pc ' + u.s + '"><b>' + esc(u.id.replace(/^LAB-/, '')) + '<i class="dot dt" style="' + (u.s === 'terpakai' ? '' : 'visibility:hidden') + '"></i></b><span class="m">' + lbl[u.s] + '</span></div>').join('') + '</div></div></div>';
    };
    km.innerHTML = '<div class="k-wrap"><div class="sk" style="height:240px"></div></div>'; await go();
    K.poll = setInterval(() => { if (LA.Activity.due('unit', 15000, 60000)) go(); }, 5000);
  }
})();
