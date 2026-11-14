/* LabAttend — Pengelolaan Tata Tertib Lab (v1.2). Semua aksi tulis divalidasi di backend (hanya Admin). */
(function () {
  'use strict';
  const { esc, ic, $ } = LA, A = LA.admin, H = A.h, P = A.pages;
  const T = () => A.S.tata || (A.S.tata = { list: null });
  const ms = (n) => (n === 'up' ? 'arrow_upward' : 'arrow_downward');

  async function load(quiet) {
    const s = T(); const r = await LA.api('tata.admin', {});
    if (r.success) { s.list = r.data; if (A.page === 'tata' && (!quiet || !$('.ov'))) A.draw(); }
    else LA.toast(r.message, 'err');
  }
  P.tata = {
    render() {
      const s = T();
      if (!s.list && !s.f) { s.f = 1; setTimeout(() => { s.f = 0; load(true); }, 0); }
      const L = s.list || [], aktif = L.filter(x => x.aktif).length;
      const kepala = A.me && A.me.role === 'kepala';
      const act = kepala ? '' : '<button class="btn p" data-act="tt.add">' + ic('add', 's18') + 'Tambah Tata Tertib</button>';
      return H.head('Konten murid', 'Tata Tertib Lab', 'Poin yang <b>aktif</b> ditampilkan kepada murid secara berurutan. Poin nonaktif tetap tersimpan.', act) +
        '<div class="g3"><div class="card stat"><div class="ic">' + ic('list_alt') + '</div><div class="up">Total poin</div><div class="v">' + L.length + '</div><div class="sm mut">Maks. 50 poin</div></div>' +
        '<div class="card stat"><div class="ic">' + ic('visibility') + '</div><div class="up">Ditampilkan ke murid</div><div class="v pri">' + aktif + '</div><div class="sm mut">Status aktif</div></div>' +
        '<div class="card stat"><div class="ic w">' + ic('visibility_off') + '</div><div class="up">Disembunyikan</div><div class="v">' + (L.length - aktif) + '</div><div class="sm mut">Status nonaktif</div></div></div>' +
        '<div class="card pad0">' + (!s.list ? '<div style="padding:16px">' + H.sk(3) + '</div>' : !L.length ? '<div class="empty" style="padding:48px 16px">' + ic('gavel', 's40') + '<p style="margin-top:8px"><b>Belum ada tata tertib.</b></p><p class="sm">Tambahkan poin pertama. Halaman murid akan menampilkan "belum tersedia" sampai ada poin yang aktif.</p></div>' :
          '<div class="tw"><table class="t"><thead><tr><th style="width:70px">Urutan</th><th>Isi tata tertib</th><th style="width:120px">Status</th><th style="width:150px">Diperbarui</th><th class="tr" style="width:200px">Aksi</th></tr></thead><tbody>' +
          L.map((x, i) => '<tr class="' + (x.aktif ? '' : 'dim') + '"><td><div class="row" style="gap:4px"><b class="num">' + (i + 1) + '</b>' + (kepala ? '' : '<span class="col" style="gap:0"><button class="btn g ico" style="height:22px;width:26px" data-act="tt.mv" data-id="' + esc(x.id) + '" data-d="up" ' + (i === 0 ? 'disabled' : '') + ' aria-label="Naikkan">' + ic(ms('up'), 's16') + '</button><button class="btn g ico" style="height:22px;width:26px" data-act="tt.mv" data-id="' + esc(x.id) + '" data-d="down" ' + (i === L.length - 1 ? 'disabled' : '') + ' aria-label="Turunkan">' + ic(ms('down'), 's16') + '</button></span>') + '</div></td><td style="white-space:normal;line-height:20px">' + esc(x.isi) + '</td><td>' + (x.aktif ? '<span class="badge"><i class="dot"></i>Aktif</span>' : '<span class="badge mut">Nonaktif</span>') + '</td><td class="sm mut num">' + esc((x.diperbarui || '').slice(0, 16)) + '</td><td class="tr" style="white-space:nowrap">' +
            (kepala ? '<span class="sm mut">Hanya lihat</span>' : '<button class="btn sm" data-act="tt.tgl" data-id="' + esc(x.id) + '" data-v="' + (x.aktif ? 0 : 1) + '">' + (x.aktif ? 'Sembunyikan' : 'Tampilkan') + '</button> <button class="btn g ico" title="Edit" data-act="tt.edit" data-id="' + esc(x.id) + '">' + ic('edit', 's18') + '</button> <button class="btn g ico" style="color:var(--err)" title="Hapus" data-act="tt.del" data-id="' + esc(x.id) + '">' + ic('delete', 's18') + '</button>') +
            '</td></tr>').join('') + '</tbody></table></div>') +
        '</div><div class="alert i">' + ic('info') + '<div>Halaman murid menampilkan judul <b>Tata Tertib Murid Laboratorium Komputer</b> dan tombol <b>LANJUT KE MENU PRESENSI</b> di bawah daftar. Perubahan langsung terlihat setelah disimpan.</div></div>';
    }
  };

  function form(x) {
    x = x || {};
    LA.modal({ title: x.id ? 'Edit Tata Tertib' : 'Tambah Tata Tertib', body: '<div class="col" style="gap:12px">' +
      H.fld('Isi tata tertib', '<textarea class="inp" id="tt-isi" maxlength="500" rows="4" placeholder="mis. Dilarang makan dan minum di dalam laboratorium.">' + esc(x.isi || '') + '</textarea>', 'Maks. 500 karakter. Tulis satu aturan per poin.') +
      '<label class="row"><input type="checkbox" id="tt-aktif"' + (x.id ? (x.aktif ? ' checked' : '') : ' checked') + '> Tampilkan kepada murid</label></div>',
      foot: '<button class="btn" data-act="modal.close">Batal</button><button class="btn p" data-act="tt.save" data-id="' + esc(x.id || '') + '">Simpan</button>' });
  }
  LA.ACT['tt.add'] = () => form();
  LA.ACT['tt.edit'] = el => form((T().list || []).find(x => x.id === el.dataset.id));
  LA.ACT['tt.save'] = async el => {
    const isi = $('#tt-isi').value.trim(); if (isi.length < 3) return LA.toast('Isi minimal 3 karakter', 'err');
    const id = el.dataset.id || undefined; LA.busy(el, true);
    const r = await LA.api('tata.simpan', { id: id, isi: isi }); LA.busy(el, false);
    if (!r.success) return LA.toast(r.message, 'err');
    // status untuk poin baru/edit: sinkronkan dengan checkbox
    const aktifWant = $('#tt-aktif') ? $('#tt-aktif').checked : true, idFinal = id || (r.data && r.data.id);
    const cur = (T().list || []).find(x => x.id === idFinal);
    if (idFinal && (!cur || cur.aktif !== aktifWant)) await LA.api('tata.status', { id: idFinal, aktif: aktifWant });
    LA.closeModal(); LA.toast(r.message, 'ok'); await load(true); A.draw();
  };

  LA.ACT['tt.tgl'] = async el => {
    const id = el.dataset.id, v = el.dataset.v === '1', s = T(), x = s.list.find(q => q.id === id); if (!x) return;
    const prev = x.aktif; x.aktif = v; A.draw();                          // optimistis
    const r = await LA.api('tata.status', { id: id, aktif: v });
    if (!r.success) { x.aktif = prev; A.draw(); return LA.toast(r.message, 'err'); }
    LA.toast(r.message, 'ok');
  };

  LA.ACT['tt.mv'] = async el => {
    const s = T(), L = s.list, i = L.findIndex(q => q.id === el.dataset.id), j = el.dataset.d === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= L.length) return;
    const prev = L.slice(); const nxt = L.slice(); [nxt[i], nxt[j]] = [nxt[j], nxt[i]]; s.list = nxt; A.draw();   // optimistis
    const r = await LA.api('tata.urutan', { ids: nxt.map(x => x.id) });
    if (!r.success) { s.list = prev; A.draw(); LA.toast(r.message, 'err'); await load(true); }
  };

  LA.ACT['tt.del'] = async el => {
    const x = (T().list || []).find(q => q.id === el.dataset.id); if (!x) return;
    if (!await LA.confirm('Hapus tata tertib?', '“' + x.isi.slice(0, 120) + (x.isi.length > 120 ? '…' : '') + '” akan dihapus permanen dari daftar. Bila hanya ingin menyembunyikan, pilih Sembunyikan.', 'Hapus', true)) return;
    const r = await LA.api('tata.hapus', { id: x.id });
    if (!r.success) return LA.toast(r.message, 'err');
    LA.toast(r.message, 'ok'); await load(true); A.draw();
  };
})();
