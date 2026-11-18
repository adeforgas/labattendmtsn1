/* LabAttend — Poin Pelanggaran (v1.3). Admin saja. Semua validasi dan perhitungan nama/poin dilakukan di backend;
   halaman ini hanya mengirim ID murid & ID jenis pelanggaran. Total poin dihitung dari catatan yang ada. */
(function () {
  'use strict';
  const { esc, ic, $ } = LA, A = LA.admin, H = A.h, P = A.pages;
  const S = () => A.S.pel || (A.S.pel = { tab: 'catat', master: null, rows: null, f: { sort: 'baru' }, form: {}, pg: 1 });
  const keep = sel => { const i = $(sel); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
  const today = () => LA.iso();

  async function load(quiet) {
    const s = S(); s.fetching = 1;
    const [m, r] = await Promise.all([LA.apiQ('pel.master'), LA.apiQ('pel.list')]); s.fetching = 0;
    let ch = false;
    if (m.success) { if (!A.same(s.master, m.data)) ch = true; s.master = m.data; } else if (!quiet) LA.toast(m.message, 'err');
    if (r.success) { if (!A.same(s.rows, r.data.rows)) ch = true; s.rows = r.data.rows; } else if (!quiet) LA.toast(r.message, 'err');
    if (A.page === 'pelanggaran' && (ch || !quiet)) A.softDraw();
  }
  const kelasNama = id => ((A.d.kelas || []).find(k => k.id === id) || {}).nama || id;
  function filtered() {
    const f = S().f, q = (f.q || '').toLowerCase();
    return (S().rows || []).filter(r => (!q || r.namaMurid.toLowerCase().includes(q)) && (!f.kelas || r.kelasId === f.kelas) && (!f.jenis || r.pelanggaranId === f.jenis) && (!f.dari || r.tanggal >= f.dari) && (!f.sampai || r.tanggal <= f.sampai));
  }
  function sorted(list) {
    const k = S().f.sort, a = list.slice();
    if (k === 'lama') a.sort((x, y) => x.tanggal < y.tanggal ? -1 : x.tanggal > y.tanggal ? 1 : (x.waktu < y.waktu ? -1 : 1));
    else if (k === 'nama') a.sort((x, y) => x.namaMurid.localeCompare(y.namaMurid) || (x.tanggal < y.tanggal ? 1 : -1));
    else if (k === 'poin') a.sort((x, y) => y.poin - x.poin || (x.tanggal < y.tanggal ? 1 : -1));
    else a.sort((x, y) => x.tanggal < y.tanggal ? 1 : x.tanggal > y.tanggal ? -1 : (x.waktu < y.waktu ? 1 : -1));
    return a;
  }
  function rekap(list) {
    const m = {}; list.forEach(r => { const o = m[r.muridId] || (m[r.muridId] = { muridId: r.muridId, nama: r.namaMurid, kelasId: r.kelasId, n: 0, total: 0 }); o.n++; o.total += r.poin; });
    return Object.keys(m).map(k => m[k]).sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama));
  }

  P.pelanggaran = {
    render() {
      const s = S(); if (!s.master && !s.fetching && !A.pfRunning) load(true);
      const tabs = '<div class="tabs" style="align-self:flex-start">' + [['catat', 'edit_note', 'Pencatatan & Riwayat'], ['rekap', 'leaderboard', 'Rekap per Murid'], ['jenis', 'rule', 'Jenis Pelanggaran']].map(t => '<button class="' + (s.tab === t[0] ? 'on' : '') + '" data-act="pl.tab" data-t="' + t[0] + '">' + ic(t[1], 's18') + t[2] + '</button>').join('') + '</div>';
      let body = H.sk(4);
      if (s.master && s.rows) body = ({ catat: vCatat, rekap: vRekap, jenis: vJenis })[s.tab]();
      return H.head('Kedisiplinan', 'Poin Pelanggaran', 'Catat pelanggaran tata tertib laboratorium. Nama &amp; poin tersimpan sebagai <b>snapshot</b>: mengubah poin jenis pelanggaran tidak mengubah catatan lama.', '') + tabs + body;
    }
  };
  LA.ACT['pl.tab'] = el => { S().tab = el.dataset.t; S().pg = 1; A.draw(); };

  /* ---------- filter bersama (riwayat & rekap) ---------- */
  function filterCard() {
    const f = S().f, M = S().master;
    return '<div class="card"><div class="row wrap"><div class="sch grow" style="min-width:180px"><span class="ms">search</span><input class="inp" id="pq" placeholder="Cari nama murid…" value="' + esc(f.q || '') + '" data-in="pl.q"></div>' +
      '<select class="inp" style="width:auto" data-ch="pl.kelas">' + H.kelasOpt(f.kelas, 'Semua kelas') + '</select>' +
      '<select class="inp" style="width:auto;max-width:230px" data-ch="pl.jenis"><option value="">Semua jenis</option>' + M.map(m => '<option value="' + esc(m.id) + '"' + (f.jenis === m.id ? ' selected' : '') + '>' + esc(m.nama) + (m.aktif ? '' : ' (nonaktif)') + '</option>').join('') + '</select>' +
      '<label class="row sm mut">Dari <input type="date" class="inp" style="width:auto" value="' + esc(f.dari || '') + '" data-ch="pl.dari"></label><label class="row sm mut">Sampai <input type="date" class="inp" style="width:auto" value="' + esc(f.sampai || '') + '" data-ch="pl.sampai"></label>' +
      (S().tab === 'catat' ? '<select class="inp" style="width:auto" data-ch="pl.sort">' + [['baru', 'Terbaru'], ['lama', 'Terlama'], ['nama', 'Nama A–Z'], ['poin', 'Poin tertinggi']].map(o => '<option value="' + o[0] + '"' + (f.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' : '') +
      ((f.q || f.kelas || f.jenis || f.dari || f.sampai) ? '<button class="btn g sm" data-act="pl.reset">' + ic('filter_alt_off', 's16') + 'Hapus filter</button>' : '') + '</div></div>';
  }
  LA.IN['pl.q'] = LA.debounce(el => { S().f.q = el.value; S().pg = 1; A.draw(); keep('#pq'); }, 200);
  ['kelas', 'jenis', 'dari', 'sampai', 'sort'].forEach(k => { LA.IN['pl.' + k] = el => { S().f[k] = el.value; S().pg = 1; A.draw(); }; });
  LA.ACT['pl.reset'] = () => { S().f = { sort: S().f.sort || 'baru' }; S().pg = 1; A.draw(); };
  LA.ACT['pl.pg'] = el => { S().pg = +el.dataset.p; A.draw(); };

  /* ---------- tab 1: form pencatatan + riwayat ---------- */
  function vCatat() {
    const s = S(), fm = s.form, M = s.master, aktif = M.filter(m => m.aktif);
    const murid = fm.kelas ? (A.d.murid || []).filter(m => m.kelasId === fm.kelas && m.aktif).sort((a, b) => a.nama.localeCompare(b.nama)) : [];
    const jn = M.find(m => m.id === fm.jenis);
    const list = sorted(filtered()), per = 25, pages = Math.max(1, Math.ceil(list.length / per)), pg = Math.min(s.pg, pages), vis = list.slice((pg - 1) * per, pg * per);
    const total = list.reduce((n, r) => n + r.poin, 0), nMurid = new Set(list.map(r => r.muridId)).size;
    return '<div class="g4">' + H.stat('Catatan pelanggaran', LA.nf(list.length), 'Sesuai filter', 'report', 'w') + H.stat('Total poin', LA.nf(total), 'Sesuai filter', 'calculate', 'e') + H.stat('Murid tercatat', nMurid, 'Pernah melanggar', 'person_alert', 'i') + H.stat('Jenis aktif', aktif.length + ' <span class="mut" style="font-size:14px;font-weight:400">/ ' + M.length + '</span>', 'Dapat dipilih', 'rule') + '</div>' +
      '<div class="card"><h3>' + ic('edit_note', 'pri') + ' Catat Pelanggaran Murid</h3>' + (aktif.length ? '' : '<div class="alert" style="margin:10px 0">' + ic('info') + '<div>Belum ada jenis pelanggaran aktif. Buat dulu di tab <b>Jenis Pelanggaran</b>.</div></div>') +
      '<div class="g3" style="margin-top:12px;gap:12px">' + H.fld('1. Kelas', '<select class="inp" id="pf-k" data-ch="pl.fk"><option value="">Pilih kelas…</option>' + (A.d.kelas || []).map(k => '<option value="' + esc(k.id) + '"' + (fm.kelas === k.id ? ' selected' : '') + '>' + esc(k.nama) + '</option>').join('') + '</select>') +
      H.fld('2. Nama murid', '<select class="inp" id="pf-m" data-ch="pl.fm"' + (fm.kelas ? '' : ' disabled') + '><option value="">' + (fm.kelas ? (murid.length ? 'Pilih murid…' : 'Tidak ada murid aktif') : 'Pilih kelas dulu') + '</option>' + murid.map(m => '<option value="' + esc(m.id) + '"' + (fm.murid === m.id ? ' selected' : '') + '>' + esc(m.nama) + '</option>').join('') + '</select>') +
      H.fld('3. Jenis pelanggaran', '<select class="inp" id="pf-j" data-ch="pl.fj"><option value="">Pilih jenis…</option>' + aktif.map(m => '<option value="' + esc(m.id) + '"' + (fm.jenis === m.id ? ' selected' : '') + '>' + esc(m.nama) + '</option>').join('') + '</select>') + '</div>' +
      '<div class="g3" style="margin-top:12px;gap:12px">' + H.fld('Poin (otomatis)', '<div class="inp" style="display:flex;align-items:center;background:var(--soft);font-weight:700;font-size:18px;color:' + (jn ? 'var(--err)' : 'var(--mut)') + '">' + (jn ? jn.poin + ' poin' : '—') + '</div>') + H.fld('Tanggal pelanggaran', '<input type="date" class="inp" id="pf-t" max="' + today() + '" value="' + esc(fm.tgl || today()) + '" data-ch="pl.ft">') + H.fld('Keterangan (opsional)', '<input class="inp" id="pf-c" maxlength="200" placeholder="Catatan tambahan…" value="' + esc(fm.ket || '') + '" data-in="pl.fc">') + '</div>' +
      '<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn p" id="pf-save" data-act="pl.simpan"' + (fm.murid && fm.jenis ? '' : ' disabled') + '>' + ic('save', 's18') + 'Simpan Pelanggaran</button></div></div>' +
      filterCard() +
      '<div class="card pad0"><div class="row sp wrap" style="padding:16px 20px"><h3>Riwayat Pelanggaran</h3><div class="row"><span class="badge sq mut">' + list.length + ' catatan</span><button class="btn sm d" data-act="pl.hapusSemua"' + (s.rows.length ? '' : ' disabled') + '>' + ic('delete_sweep', 's16') + 'Hapus Seluruh Catatan</button></div></div><div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Murid</th><th>Kelas</th><th>Jenis pelanggaran</th><th>Poin</th><th>Admin</th><th class="tr">Aksi</th></tr></thead><tbody>' +
      (vis.length ? vis.map(r => '<tr><td class="num code" style="white-space:nowrap">' + LA.dmy(r.tanggal) + '</td><td><a href="#" data-act="pl.detail" data-id="' + esc(r.muridId) + '" class="b pri">' + esc(r.namaMurid) + '</a>' + (r.keterangan ? '<div class="sm mut">' + esc(r.keterangan) + '</div>' : '') + '</td><td><span class="badge sq mut">' + esc(r.kelas) + '</span></td><td>' + esc(r.namaPelanggaran) + '</td><td><span class="badge err">' + r.poin + '</span></td><td class="sm mut">' + esc(r.admin) + '</td><td class="tr"><button class="btn g ico" style="color:var(--err)" title="Hapus catatan" data-act="pl.hapus" data-id="' + esc(r.id) + '">' + ic('delete', 's18') + '</button></td></tr>').join('') : '<tr><td colspan="7" class="empty">' + (s.rows.length ? 'Tidak ada catatan yang cocok dengan filter.' : 'Belum ada catatan pelanggaran.') + '</td></tr>') +
      '</tbody></table></div><div class="row sp wrap" style="padding:12px 16px"><span class="sm mut">Menampilkan ' + vis.length + ' dari ' + list.length + ' catatan</span>' + H.pager(list.length, pg, per, 'pl.pg') + '</div></div>';
  }
  LA.IN['pl.fk'] = el => { const fm = S().form; fm.kelas = el.value; fm.murid = ''; A.draw(); };
  LA.IN['pl.fm'] = el => { S().form.murid = el.value; A.draw(); };
  LA.IN['pl.fj'] = el => { S().form.jenis = el.value; A.draw(); };
  LA.IN['pl.ft'] = el => { S().form.tgl = el.value; };
  LA.IN['pl.fc'] = el => { S().form.ket = el.value; };
  LA.ACT['pl.simpan'] = async b => {
    const fm = S().form; if (!fm.murid || !fm.jenis) return;
    if (/^tmp_/.test(fm.jenis)) return LA.toast('Jenis pelanggaran masih disimpan, tunggu sebentar…');
    const m = (A.d.murid || []).find(x => x.id === fm.murid), j = S().master.find(x => x.id === fm.jenis), snap = Object.assign({}, fm), now = today() + ' ' + LA.fmtTime(LA.Clock.now());
    const tmp = { id: 'tmp_' + Date.now(), waktu: now, tanggal: fm.tgl || today(), muridId: fm.murid, namaMurid: m ? m.nama : '', kelasId: fm.kelas, kelas: kelasNama(fm.kelas), pelanggaranId: fm.jenis, namaPelanggaran: j ? j.nama : '', poin: j ? j.poin : 0, keterangan: fm.ket || '', admin: (LA.me && LA.me.email) || '' };
    S().rows.unshift(tmp); S().form = { kelas: fm.kelas, jenis: fm.jenis, tgl: fm.tgl }; S().pg = 1; A.draw();          // optimistis: langsung tampil di riwayat
    const r = await LA.api('pel.catat', { muridId: snap.murid, pelanggaranId: snap.jenis, keterangan: snap.ket || '', tanggal: snap.tgl || today() });   // hanya ID: nama/poin/kelas ditetapkan server
    if (!r.success) { S().rows = S().rows.filter(x => x !== tmp); S().form = snap; A.draw(); return LA.toast(r.message, 'err'); }
    const i = S().rows.indexOf(tmp); if (i >= 0) S().rows[i] = r.data;                                                  // ganti dengan data resmi dari server
    LA.toast(r.message, 'ok'); A.draw(); load(true);
  };

  /* ---------- detail murid ---------- */
  LA.ACT['pl.detail'] = el => {
    const id = el.dataset.id, L = sorted(S().rows.filter(r => r.muridId === id)).slice().sort((a, b) => a.tanggal < b.tanggal ? -1 : 1); if (!L.length) return;
    const total = L.reduce((n, r) => n + r.poin, 0);
    LA.modal({ title: 'Riwayat Pelanggaran', wide: true, body: '<div class="row sp wrap" style="margin-bottom:12px"><div class="row"><span class="av r">' + esc(LA.initials(L[0].namaMurid)) + '</span><div><b style="font-size:16px">' + esc(L[0].namaMurid) + '</b><div class="sm mut">Kelas ' + esc(L[0].kelas) + ' • ' + L.length + ' catatan</div></div></div><div class="tr"><div class="up">Total poin</div><b style="font-size:28px;color:var(--err)">' + total + '</b></div></div>' +
      '<div class="tw"><table class="t"><thead><tr><th>Tanggal</th><th>Jenis pelanggaran</th><th>Poin</th><th>Keterangan</th><th>Admin</th></tr></thead><tbody>' + L.map(r => '<tr><td class="num">' + LA.dmy(r.tanggal) + '</td><td>' + esc(r.namaPelanggaran) + '</td><td><span class="badge err">' + r.poin + '</span></td><td class="sm mut">' + esc(r.keterangan || '—') + '</td><td class="sm mut">' + esc(r.admin) + '</td></tr>').join('') + '</tbody><tfoot><tr><td colspan="2" class="b tr">Total Poin</td><td colspan="3"><b>' + total + '</b></td></tr></tfoot></table></div>', foot: '<button class="btn p" data-act="modal.close">Tutup</button>' });
  };

  /* ---------- hapus ---------- */
  LA.ACT['pl.hapus'] = async el => {
    if (/^tmp_/.test(el.dataset.id)) return LA.toast('Catatan masih disimpan, tunggu sebentar…');
    const s = S(), r = s.rows.find(x => x.id === el.dataset.id); if (!r) return;
    if (!await LA.confirm('Hapus catatan pelanggaran?', r.namaMurid + ' • ' + r.namaPelanggaran + ' (' + r.poin + ' poin, ' + LA.dmy(r.tanggal) + '). Total poin murid dihitung ulang otomatis. Tidak dapat dibatalkan.', 'Hapus', true)) return;
    const prev = s.rows.slice(); s.rows = s.rows.filter(x => x.id !== r.id); A.draw();            // optimistis
    const x = await LA.api('pel.hapus', { id: r.id }); if (!x.success) { s.rows = prev; A.draw(); return LA.toast(x.message, 'err'); } LA.toast(x.message, 'ok'); load();
  };
  LA.ACT['pl.hapusSemua'] = () => {
    const n = S().rows.length;
    LA.modal({ title: 'Hapus seluruh catatan pelanggaran?', lock: true, body: '<div class="alert e">' + ic('warning', 'fill') + '<div><b>' + LA.nf(n) + ' catatan pelanggaran seluruh murid akan dihapus permanen</b> dan total poin semua murid kembali ke 0.<br>Yang <b>tidak</b> terhapus: data murid, kelas, presensi, dan daftar jenis pelanggaran.<br>Disarankan membuat backup dulu di menu Pengelolaan Database.</div></div><div class="fld" style="margin-top:14px"><label>Ketik <b>HAPUS SEMUA</b> untuk melanjutkan</label><input class="inp" id="pl-typed" autocomplete="off" data-in="pl.typed"></div>', foot: '<button class="btn" data-act="modal.close">Batal</button><button class="btn d" id="pl-go" data-act="pl.hapusSemuaGo" disabled>Hapus Seluruh Catatan</button>' });
  };
  LA.IN['pl.typed'] = el => { $('#pl-go').disabled = el.value.trim() !== 'HAPUS SEMUA'; };
  LA.ACT['pl.hapusSemuaGo'] = async b => {
    LA.busy(b, true); const r = await LA.api('pel.hapusSemua', { konfirmasi: 'HAPUS SEMUA' }); LA.busy(b, false);
    if (!r.success) return LA.toast(r.message, 'err'); LA.closeModal(); LA.toast(r.message, 'ok'); S().rows = []; A.draw(); load();
  };

  /* ---------- tab 2: rekap per murid ---------- */
  function vRekap() {
    const s = S(), R = rekap(filtered()), per = 25, pages = Math.max(1, Math.ceil(R.length / per)), pg = Math.min(s.pg, pages), vis = R.slice((pg - 1) * per, pg * per), mx = Math.max(1, ...R.map(x => x.total));
    return filterCard() + '<div class="card pad0"><div class="row sp wrap" style="padding:16px 20px"><h3>Rekapitulasi Total Poin per Murid</h3><span class="badge sq mut">' + R.length + ' murid</span></div><div class="tw"><table class="t"><thead><tr><th>No</th><th>Nama murid</th><th>Kelas</th><th>Jumlah pelanggaran</th><th style="min-width:200px">Total poin</th><th class="tr">Detail</th></tr></thead><tbody>' +
      (vis.length ? vis.map((x, i) => '<tr><td class="mut">' + ((pg - 1) * per + i + 1) + '</td><td><div class="row"><span class="av r">' + esc(LA.initials(x.nama)) + '</span><b>' + esc(x.nama) + '</b></div></td><td><span class="badge sq mut">' + esc(kelasNama(x.kelasId)) + '</span></td><td class="num">' + x.n + '×</td><td><div class="row"><div class="bar grow e"><i style="width:' + Math.round(x.total / mx * 100) + '%"></i></div><b class="num" style="min-width:36px;text-align:right">' + x.total + '</b></div></td><td class="tr"><button class="btn xs" data-act="pl.detail" data-id="' + esc(x.muridId) + '">' + ic('visibility', 's16') + 'Riwayat</button></td></tr>').join('') : '<tr><td colspan="6" class="empty">' + (s.rows.length ? 'Tidak ada data yang cocok dengan filter.' : 'Belum ada catatan pelanggaran.') + '</td></tr>') +
      '</tbody></table></div><div class="row sp wrap" style="padding:12px 16px"><span class="sm mut">Total dihitung dari catatan yang masih tersimpan</span>' + H.pager(R.length, pg, per, 'pl.pg') + '</div></div>';
  }

  /* ---------- tab 3: jenis pelanggaran ---------- */
  function vJenis() {
    const M = S().master;
    return '<div class="card"><div class="row sp wrap"><div><h3>' + ic('rule', 'pri') + ' Daftar Jenis Pelanggaran</h3><p class="sm mut" style="margin-top:2px">Mengubah nama atau poin hanya berlaku untuk pencatatan berikutnya. Jenis yang sudah dipakai tidak dihapus permanen, melainkan dinonaktifkan.</p></div><button class="btn p" data-act="pj.add">' + ic('add', 's18') + 'Tambah Jenis</button></div></div>' +
      '<div class="card pad0"><div class="tw"><table class="t"><thead><tr><th>No</th><th>Jenis pelanggaran</th><th>Poin</th><th>Status</th><th>Dipakai</th><th class="tr">Aksi</th></tr></thead><tbody>' +
      (M.length ? M.map((m, i) => '<tr class="' + (m.aktif ? '' : 'dim') + '"><td class="mut">' + (i + 1) + '</td><td style="white-space:normal"><b>' + esc(m.nama) + '</b></td><td><span class="badge err">' + m.poin + ' poin</span></td><td>' + (m.aktif ? '<span class="badge"><i class="dot"></i>Aktif</span>' : '<span class="badge mut">Nonaktif</span>') + '</td><td class="num sm">' + m.dipakai + '×</td><td class="tr" style="white-space:nowrap"><button class="btn sm" data-act="pj.tgl" data-id="' + esc(m.id) + '">' + (m.aktif ? 'Nonaktifkan' : 'Aktifkan') + '</button> <button class="btn g ico" title="Edit" data-act="pj.edit" data-id="' + esc(m.id) + '">' + ic('edit', 's18') + '</button> <button class="btn g ico" style="color:var(--err)" title="Hapus" data-act="pj.del" data-id="' + esc(m.id) + '">' + ic('delete', 's18') + '</button></td></tr>').join('') : '<tr><td colspan="6" class="empty">Belum ada jenis pelanggaran. Klik <b>Tambah Jenis</b>.</td></tr>') + '</tbody></table></div></div>';
  }
  function jForm(m) {
    m = m || {};
    LA.modal({ title: m.id ? 'Edit Jenis Pelanggaran' : 'Tambah Jenis Pelanggaran', body: '<div class="col" style="gap:12px">' + H.fld('Nama / deskripsi pelanggaran', '<input class="inp" id="pj-n" maxlength="120" value="' + esc(m.nama || '') + '" placeholder="mis. Terlambat masuk laboratorium">') + H.fld('Jumlah poin', '<input class="inp" type="number" id="pj-p" min="1" max="1000" step="1" value="' + esc(m.poin || '') + '">', m.id && m.dipakai ? '<b style="color:var(--warn-tx)">Sudah dipakai ' + m.dipakai + '×. Perubahan hanya berlaku untuk catatan baru; catatan lama tetap memakai poin saat dicatat.</b>' : 'Bilangan bulat 1–1000.') + '<label class="row"><input type="checkbox" id="pj-a"' + (m.id ? (m.aktif ? ' checked' : '') : ' checked') + '> Aktif (dapat dipilih saat mencatat)</label></div>', foot: '<button class="btn" data-act="modal.close">Batal</button><button class="btn p" data-act="pj.save" data-id="' + esc(m.id || '') + '">Simpan</button>' });
  }
  const mBy = id => (S().master || []).find(m => m.id === id);
  LA.ACT['pj.add'] = () => jForm(); LA.ACT['pj.edit'] = el => jForm(mBy(el.dataset.id));
  LA.ACT['pj.save'] = async b => {
    const d = { id: b.dataset.id || undefined, nama: $('#pj-n').value.trim(), poin: Number($('#pj-p').value), aktif: $('#pj-a').checked };
    if (d.nama.length < 3) return LA.toast('Nama pelanggaran minimal 3 karakter', 'err');
    if (!isFinite(d.poin) || Math.floor(d.poin) !== d.poin || d.poin < 1 || d.poin > 1000) return LA.toast('Poin harus bilangan bulat 1–1000', 'err');
    const s = S(); let tmp = null, prev = null;
    if (d.id) { const m = mBy(d.id); prev = Object.assign({}, m); Object.assign(m, { nama: d.nama, poin: d.poin, aktif: d.aktif }); }
    else { tmp = { id: 'tmp_' + Date.now(), nama: d.nama, poin: d.poin, aktif: d.aktif, dibuat: '', diperbarui: '', dipakai: 0 }; s.master.push(tmp); }
    LA.closeModal(); A.draw();                                          // optimistis
    const r = await LA.api('pel.masterSimpan', d);
    if (!r.success) { if (tmp) s.master = s.master.filter(x => x !== tmp); else Object.assign(mBy(d.id), prev); A.draw(); LA.toast(r.message, 'err'); jForm(Object.assign({}, prev || {}, d)); return; }
    if (tmp) tmp.id = r.data.id; LA.toast(r.message, 'ok'); load(true);
  };
  LA.ACT['pj.tgl'] = async el => {
    if (/^tmp_/.test(el.dataset.id)) return LA.toast('Masih disimpan, tunggu sebentar…');
    const m = mBy(el.dataset.id), v = m.aktif; m.aktif = !v; A.draw();
    const r = await LA.api('pel.masterSimpan', { id: m.id, nama: m.nama, poin: m.poin, aktif: !v });
    if (!r.success) { m.aktif = v; A.draw(); return LA.toast(r.message, 'err'); } LA.toast(m.nama + (v ? ' dinonaktifkan' : ' diaktifkan'), 'ok');
  };
  LA.ACT['pj.del'] = async el => {
    if (/^tmp_/.test(el.dataset.id)) return LA.toast('Masih disimpan, tunggu sebentar…');
    const m = mBy(el.dataset.id);
    const msg = m.dipakai ? '“' + m.nama + '” sudah dipakai ' + m.dipakai + '× dalam catatan pelanggaran. Jenis ini akan DINONAKTIFKAN (tidak dihapus): tidak bisa dipilih untuk catatan baru, tetapi seluruh riwayat lama tetap tersimpan dan tidak berubah.' : '“' + m.nama + '” belum pernah dipakai dan akan dihapus permanen.';
    if (!await LA.confirm(m.dipakai ? 'Nonaktifkan jenis pelanggaran?' : 'Hapus jenis pelanggaran?', msg, m.dipakai ? 'Nonaktifkan' : 'Hapus', !m.dipakai)) return;
    const prev = Object.assign({}, m), idx = S().master.indexOf(m);
    if (m.dipakai) m.aktif = false; else S().master.splice(idx, 1); A.draw();                                   // optimistis
    const r = await LA.api('pel.masterHapus', { id: prev.id });
    if (!r.success) { if (m.dipakai) Object.assign(m, prev); else S().master.splice(idx, 0, m); A.draw(); return LA.toast(r.message, 'err'); }
    LA.toast(r.message, 'ok'); load(true);
  };
  P.pelanggaran.revalidate = () => load(true);
})();
