/* LabAttend — Pengelolaan Database: Backup, Restore, Reset Data Tahun Pelajaran.
   Seluruh proses dijalankan & divalidasi di backend (kunci proses + mode pemeliharaan); halaman ini hanya memicu & menampilkan hasil. */
(function () {
  'use strict';
  const { esc, ic, $ } = LA, A = LA.admin, H = A.h;
  const S = () => A.S.db || (A.S.db = { tab: 'backup' });
  const LBL = { Murid: 'Data siswa', Kelas: 'Kelas & rombongan belajar', Presensi: 'Riwayat presensi', Jadwal: 'Jadwal laboratorium', Perpindahan: 'Permintaan pindah komputer', Izin: 'Permintaan izin presensi', Komputer: 'Workstation, Device ID & token', Pengguna: 'Akun & hak akses admin', Pengaturan: 'Pengaturan, nama aplikasi & logo', Log: 'Log aktivitas admin' };
  const TIPE = { manual: ['Manual', ''], 'pra-restore': ['Pengaman restore', 'sq mut'], 'pra-reset': ['Pra-reset', 'sq warn'] };
  const nf = n => LA.nf(n || 0);

  function progress(msg) { return LA.modal({ title: msg, lock: true, noClose: true, noFocus: true, body: '<div class="ctr" style="padding:18px 0"><span class="spin" style="width:38px;height:38px;border-width:3px"></span><p class="mut" style="margin-top:14px">Diproses di server. <b>Jangan menutup atau memuat ulang halaman ini.</b></p></div>' }); }
  function hasil(ok, title, html) { LA.modal({ title: title, body: '<div class="alert ' + (ok ? 'ok' : 'e') + '">' + ic(ok ? 'check_circle' : 'error', 'fill') + '<div>' + html + '</div></div>', foot: '<button class="btn p" data-act="modal.close">Tutup</button>' }); }
  async function load() {
    const s = S(); s.f = 1;
    const [a, b] = await Promise.all([LA.apiQ('db.ringkas'), LA.apiQ('backup.list')]); s.f = 0;
    if (a.success) s.ring = a.data; else LA.toast(a.message, 'err'); if (b.success) s.list = b.data;
    if (A.page === 'database' && !$('.ov')) A.draw();
  }
  const refresh = () => { const s = S(); s.ring = null; s.list = null; s.info = null; load(); };
  const when = w => LA.dmy(String(w).slice(0, 10)) + ' ' + String(w).slice(11, 16);
  const size = b => (b.ukuran ? (b.ukuran / 1048576).toFixed(1) + ' MB • ' : '') + nf(b.totalBaris) + ' baris';

  A.pages.database = {
    render() {
      const s = S(); if (!s.ring && !s.f) load();
      const tabs = '<div class="tabs" style="align-self:flex-start">' + [['backup', 'cloud_upload', 'Backup Database'], ['restore', 'settings_backup_restore', 'Restore Database'], ['reset', 'restart_alt', 'Reset Data Tahun Pelajaran']].map(t => '<button class="' + (s.tab === t[0] ? 'on' : '') + '" data-act="db.tab" data-t="' + t[0] + '">' + ic(t[1], 's18') + t[2] + '</button>').join('') + '</div>';
      let body = H.sk(4);
      if (s.ring) body = ({ backup: vBackup, restore: vRestore, reset: vReset })[s.tab]();
      return H.head('Administrasi', 'Pengelolaan Database', 'Cadangkan, pulihkan, dan siapkan database untuk tahun pelajaran baru. Hanya Admin; semua proses berjalan di server.', '') +
        (s.ring && s.ring.maint ? '<div class="alert">' + ic('construction', 'fill') + '<div>Proses <b>' + esc(s.ring.maint) + '</b> sedang berjalan. Presensi murid dinonaktifkan sementara.</div></div>' : '') + tabs + body;
    }
  };
  LA.ACT['db.tab'] = el => { S().tab = el.dataset.t; A.draw(); };

  /* ================= BACKUP ================= */
  function vBackup() {
    const s = S(), r = s.ring, tot = Object.keys(r.baris).reduce((n, k) => n + r.baris[k], 0), L = s.list || [];
    return '<div class="g4">' + H.stat('Tahun pelajaran', esc(r.ta), 'Berdasarkan tanggal hari ini', 'event') + H.stat('Jumlah backup', r.jumlahBackup, 'Tidak pernah dihapus otomatis', 'folder_zip', 'i') + H.stat('Backup terakhir', r.backupTerakhir ? '<span style="font-size:20px">' + when(r.backupTerakhir) + '</span>' : '—', r.backupTerakhir ? 'WIB' : 'Belum pernah backup', 'history', r.backupTerakhir ? '' : 'w') + H.stat('Total baris data', nf(tot), 'Dalam database aktif', 'database') + '</div>' +
      '<div class="card"><div class="row sp wrap" style="gap:16px"><div class="grow" style="min-width:240px"><h3>' + ic('cloud_upload', 'pri') + ' Buat Backup Database</h3><p class="mut" style="margin:4px 0 8px">Menyalin seluruh database (data &amp; struktur) ke folder Google Drive khusus yang <b>privat</b>, terpisah dari database aktif, lalu memverifikasi bahwa salinan dapat dibaca dan jumlah barisnya sama.</p><div class="row wrap">' + Object.keys(LBL).map(k => '<span class="badge sq mut">' + LBL[k] + ' <b class="num">' + nf(r.baris[k]) + '</b></span>').join('') + '</div></div><button class="btn p lg" data-act="db.backup">' + ic('backup', 's18') + 'Buat Backup Database</button></div>' +
      '<div class="alert i" style="margin-top:14px">' + ic('info') + '<div>Backup <b>tidak memuat rahasia server</b> (Script Properties). PIN murid dan token komputer di backup hanya berlaku di server dengan rahasia yang sama. Backup berisi data pribadi siswa — jangan dibagikan.</div></div></div>' +
      '<div class="card pad0"><div class="row sp" style="padding:16px 20px"><h3>Riwayat Backup</h3><span class="badge sq mut">' + L.length + ' file</span></div><div class="tw"><table class="t"><thead><tr><th>Nama file backup</th><th>Tahun pel.</th><th>Dibuat</th><th>Ukuran</th><th>Oleh</th><th class="tr">Aksi</th></tr></thead><tbody>' +
      (L.length ? L.map(b => '<tr><td style="max-width:320px"><b class="trunc" style="display:block;font-size:13px">' + esc(b.nama) + '</b>' + H.badge(TIPE[b.tipe] ? TIPE[b.tipe][0] : esc(b.tipe), TIPE[b.tipe] ? TIPE[b.tipe][1] : 'sq mut') + (b.catatan ? ' <span class="sm mut">' + esc(b.catatan) + '</span>' : '') + '</td><td class="num">' + esc(b.ta) + '</td><td class="num sm">' + when(b.waktu) + '</td><td class="sm">' + size(b) + '</td><td class="sm">' + esc(b.oleh) + '</td><td class="tr" style="white-space:nowrap"><a class="btn xs" target="_blank" rel="noopener" href="' + esc(b.url) + '">' + ic('open_in_new', 's16') + 'Buka</a> <a class="btn xs" target="_blank" rel="noopener" href="' + esc(b.unduh) + '">' + ic('download', 's16') + 'Unduh</a> <button class="btn xs" data-act="db.pilih" data-id="' + esc(b.id) + '">' + ic('settings_backup_restore', 's16') + 'Restore</button></td></tr>').join('') : '<tr><td colspan="6" class="empty">Belum ada backup. Klik <b>Buat Backup Database</b>.</td></tr>') + '</tbody></table></div></div>';
  }
  LA.ACT['db.backup'] = async () => {
    const m = progress('Membuat & memverifikasi backup…'), r = await LA.api('backup.buat', { tipe: 'manual' }); LA.closeModal();
    if (!r.success) return hasil(false, 'Backup gagal', esc(r.message) + '<br>Tidak ada data yang diubah.');
    hasil(true, 'Backup berhasil', 'File <b>' + esc(r.data.nama) + '</b> dibuat di folder backup Drive dan <b>lolos verifikasi</b> (struktur &amp; jumlah baris sama dengan database aktif).'); refresh();
  };
  LA.ACT['db.pilih'] = el => { const s = S(); s.tab = 'restore'; s.sel = el.dataset.id; s.info = null; A.draw(); periksa(); };

  /* ================= RESTORE ================= */
  async function periksa() { const s = S(), id = s.sel; if (!id) return; const r = await LA.api('backup.periksa', { id: id }); if (S().sel !== id) return; if (r.success) s.info = r.data; else { s.info = { error: r.message }; } if (A.page === 'database' && !$('.ov')) A.draw(); }
  function vRestore() {
    const s = S(), L = s.list || [], i = s.info;
    let h = '<div class="alert">' + ic('warning', 'fill') + '<div><b>Restore mengganti isi database aktif</b> dengan data dari backup yang dipilih (data murid, kelas, presensi, jadwal, komputer &amp; token, pengguna, pengaturan). Log aktivitas tidak ditimpa. Sistem otomatis membuat <b>backup pengaman</b> sebelum restore dan mengembalikan kondisi semula bila restore gagal.</div></div>' +
      '<div class="g2" style="align-items:start"><div class="col"><h3>Pilih file backup</h3>' +
      (L.length ? L.map(b => '<button class="card click" style="text-align:left;' + (s.sel === b.id ? 'border-color:var(--pri);background:#F7FDF9' : '') + '" data-act="db.sel" data-id="' + esc(b.id) + '"><div class="row sp"><b style="font-size:13px;word-break:break-all">' + esc(b.nama) + '</b>' + (s.sel === b.id ? ic('check_circle', 'pri fill') : '') + '</div><div class="sm mut" style="margin-top:4px">TA ' + esc(b.ta) + ' • ' + when(b.waktu) + ' • ' + esc(b.oleh) + ' • ' + size(b) + '</div></button>').join('') : '<div class="card empty">Belum ada backup untuk dipulihkan.</div>') + '</div>';
    h += '<div class="card" style="position:sticky;top:76px"><h3>Informasi backup</h3>';
    if (!s.sel) h += '<div class="empty">Pilih salah satu file backup di kiri.</div>';
    else if (!i) h += '<div class="col" style="margin-top:12px"><div class="sk" style="height:24px"></div><div class="sk" style="height:90px"></div><p class="sm mut">Memeriksa backup (struktur, header, jumlah data)…</p></div>';
    else if (i.error) h += '<div class="alert e" style="margin-top:12px">' + ic('error', 'fill') + '<div>' + esc(i.error) + '</div></div>';
    else h += '<div class="kv"><span>Nama file</span><span style="font-size:12px;word-break:break-all">' + esc(i.nama) + '</span></div><div class="kv"><span>Tahun pelajaran</span><span>' + esc(i.meta.ta) + '</span></div><div class="kv"><span>Dibuat</span><span class="num">' + when(i.meta.waktu) + ' WIB</span></div><div class="kv"><span>Oleh</span><span>' + esc(i.meta.oleh) + '</span></div>' +
      '<div class="up" style="margin:12px 0 6px">Isi backup (baris)</div><div class="row wrap">' + Object.keys(LBL).filter(k => i.counts[k] !== undefined).map(k => '<span class="badge sq mut">' + LBL[k] + ' <b class="num">' + nf(i.counts[k]) + '</b></span>').join('') + '</div>' +
      (i.valid ? '<div class="alert ok" style="margin-top:12px">' + ic('verified', 'fill') + '<div>Struktur backup valid &amp; dapat dibaca.</div></div>' : '<div class="alert e" style="margin-top:12px">' + ic('error', 'fill') + '<div><b>Backup tidak valid — restore tidak dapat dilakukan.</b><br>' + i.masalah.map(esc).join('<br>') + '</div></div>') +
      i.peringatan.map(w => '<div class="alert" style="margin-top:10px">' + ic('warning') + '<div>' + esc(w) + '</div></div>').join('') + '<button class="btn d lg blk" style="margin-top:14px" data-act="db.restore"' + (i.valid ? '' : ' disabled') + '>' + ic('settings_backup_restore', 's18') + 'Restore Database Ini</button>';
    return h + '</div></div>';
  }
  LA.ACT['db.sel'] = el => { const s = S(); s.sel = el.dataset.id; s.info = null; A.draw(); periksa(); };
  function typed(word, title, bodyHtml, goAct, extra) {
    LA.modal({ title: title, lock: true, body: bodyHtml + (extra || '') + '<div class="fld" style="margin-top:14px"><label>Ketik <b>' + word + '</b> untuk melanjutkan</label><input class="inp" id="db-typed" autocomplete="off" data-in="db.typed" data-w="' + word + '"></div>', foot: '<button class="btn" data-act="modal.close">Batal</button><button class="btn d" id="db-go" data-act="' + goAct + '" disabled>' + word + '</button>' });
  }
  LA.IN['db.typed'] = el => { $('#db-go').disabled = el.value.trim() !== el.dataset.w; };
  LA.ACT['db.restore'] = () => {
    const i = S().info; typed('RESTORE', 'Konfirmasi Restore Database',
      '<div class="alert e">' + ic('warning', 'fill') + '<div>Database aktif akan <b>diganti</b> dengan backup <b>' + esc(i.nama) + '</b> (' + when(i.meta.waktu) + '). Data yang dibuat setelah backup tersebut akan hilang dari database aktif (tetap ada di backup pengaman). Presensi murid dinonaktifkan selama proses.</div></div>',
      'db.restoreGo', i.pepperCocok ? '' : '<label class="row" style="margin-top:10px;align-items:flex-start"><input type="checkbox" id="db-force" style="margin-top:3px"> <span class="sm">Saya paham PIN murid &amp; token komputer dari backup ini tidak akan valid, dan tetap ingin melanjutkan.</span></label>');
  };
  LA.ACT['db.restoreGo'] = async () => {
    const s = S(), force = !!($('#db-force') && $('#db-force').checked), id = s.sel; LA.closeModal(); progress('Restore sedang berjalan…');
    const r = await LA.api('restore.jalankan', { id: id, konfirmasi: 'RESTORE', force: force }); LA.closeModal();
    if (!r.success) { hasil(false, 'Restore gagal', esc(r.message)); refresh(); return; }
    hasil(true, 'Restore berhasil', 'Database dikembalikan ke kondisi backup <b>' + esc(r.data.dari) + '</b>.<br>Backup pengaman: <b>' + esc(r.data.pengaman) + '</b>.');
    A.S.lap.data = null; A.S.kor.rows = null; A.S.pres.rows = null; refresh(); A.reload('boot', true);
  };

  /* ================= RESET TAHUN PELAJARAN ================= */
  const HAPUS = ['Murid', 'Kelas', 'Presensi', 'Jadwal', 'Perpindahan', 'Izin'], TETAP = ['Komputer', 'Pengguna', 'Pengaturan', 'Log'];
  const rbOk = () => { const b = S().rb; return b && Date.now() - b.ts < 28 * 60000; };
  function vReset() {
    const s = S(), r = s.ring, ok = rbOk();
    return '<div class="alert">' + ic('info') + '<div>Gunakan saat memasuki tahun pelajaran baru. Alurnya: <b>1) buat backup</b> → sistem memverifikasi → <b>2) reset</b> dengan konfirmasi akhir. Bila backup gagal atau tidak valid, reset tidak bisa dijalankan.</div></div>' +
      '<div class="g2"><div class="card" style="border-color:#FECACA"><h3 style="color:var(--err-tx)">' + ic('delete_sweep') + ' Akan DIHAPUS</h3><div style="margin-top:8px">' + HAPUS.map(k => '<div class="kv"><span>' + LBL[k] + '</span><span class="num">' + nf(r.baris[k]) + ' baris</span></div>').join('') + '</div></div>' +
      '<div class="card" style="border-color:var(--mint2)"><h3 class="pri">' + ic('lock') + ' Akan DIPERTAHANKAN</h3><div style="margin-top:8px">' + TETAP.map(k => '<div class="kv"><span>' + LBL[k] + '</span><span class="num">' + nf(r.baris[k]) + ' baris</span></div>').join('') + '<div class="kv"><span>Seluruh file backup</span><span class="num">' + r.jumlahBackup + ' file</span></div></div></div></div>' +
      '<div class="card"><div class="row"><span class="av" style="' + (ok ? '' : 'background:var(--warn-bg);color:var(--warn-tx)') + '">1</span><h3>Buat backup pengaman</h3></div>' +
      (ok ? '<div class="alert ok" style="margin:12px 0">' + ic('verified', 'fill') + '<div>Backup <b>' + esc(s.rb.nama) + '</b> berhasil dibuat &amp; diverifikasi. Berlaku 30 menit; jangan mengubah data sebelum reset.</div></div>' : '<p class="mut" style="margin:6px 0 12px">Backup wajib dibuat dulu. Reset hanya dapat memakai backup yang baru dibuat di halaman ini dan datanya belum berubah.</p>') +
      '<button class="btn ' + (ok ? '' : 'p') + '" data-act="db.rbackup">' + ic('backup', 's18') + (ok ? 'Buat ulang backup' : 'Buat Backup Sekarang') + '</button></div>' +
      '<div class="card" style="' + (ok ? 'border-color:#FECACA' : 'opacity:.6') + '"><div class="row"><span class="av r">2</span><h3>Reset data tahun pelajaran</h3></div><p class="mut" style="margin:6px 0 12px">Setelah reset, Anda cukup memasukkan data siswa, kelas, dan jadwal tahun pelajaran baru. Komputer, token, akun admin, nama &amp; logo tidak perlu diatur ulang.</p><button class="btn d lg" data-act="db.reset"' + (ok ? '' : ' disabled') + '>' + ic('restart_alt', 's18') + 'Reset Data Tahun Pelajaran…</button></div>';
  }
  LA.ACT['db.rbackup'] = async () => {
    const s = S(); s.rb = null; progress('Membuat & memverifikasi backup…'); const r = await LA.api('backup.buat', { tipe: 'pra-reset' }); LA.closeModal();
    if (!r.success) { hasil(false, 'Backup gagal — reset dibatalkan', esc(r.message) + '<br>Reset tidak dapat dilanjutkan tanpa backup yang valid.'); A.draw(); return; }
    s.rb = { id: r.data.id, nama: r.data.nama, ts: Date.now() }; refresh(); LA.toast('Backup terverifikasi', 'ok');
  };
  LA.ACT['db.reset'] = () => {
    if (!rbOk()) return LA.toast('Buat backup terlebih dahulu', 'err');
    typed('RESET', 'Konfirmasi Terakhir: Reset Data', '<div class="alert e">' + ic('warning', 'fill') + '<div><b>Seluruh data siswa, kelas, jadwal lama, dan riwayat presensi akan dihapus dari database aktif.</b><br>Dipertahankan: komputer &amp; token, akun admin, nama &amp; logo, pengaturan, log aktivitas, dan semua file backup. Backup yang baru dibuat: <b>' + esc(S().rb.nama) + '</b>.</div></div>', 'db.resetGo');
  };
  LA.ACT['db.resetGo'] = async () => {
    const s = S(), id = s.rb.id; LA.closeModal(); progress('Reset sedang berjalan…');
    const r = await LA.api('reset.jalankan', { backupId: id, konfirmasi: 'RESET' }); LA.closeModal();
    if (!r.success) { hasil(false, 'Reset gagal / dibatalkan', esc(r.message)); s.rb = null; refresh(); return; }
    s.rb = null; hasil(true, 'Reset selesai', 'Database dibersihkan dan <b>siap untuk tahun pelajaran baru</b>. Backup arsip: <b>' + esc(r.data.backup) + '</b>.<br>Langkah berikut: tambah kelas, murid (atau import Excel), dan jadwal baru.');
    A.S.lap.data = null; A.S.kor.rows = null; A.S.pres.rows = null; A.S.mur = {}; refresh(); A.reload('boot', true);
  };
})();
