// ============================================================
//  script.js — Album Kỷ Niệm
//  Nội dung:
//  1. Biến & dữ liệu
//  2. Lưu / đọc dữ liệu (IndexedDB) + Sao lưu / khôi phục
//  3. Chọn ảnh & nén ảnh
//  4. Thêm kỷ niệm mới
//  5. Hiển thị album
//  6. Bộ lọc (loại album, tháng, năm)
//  7. Xem ảnh lớn & xóa
//  8. Tiện ích (định dạng ngày, thông báo, chống lỗi chữ)
//  9. Khởi chạy
// ============================================================


// ============================================================
//  1. BIẾN & DỮ LIỆU
// ============================================================

// Tên khóa dùng để lưu trong trình duyệt
const KHOA_LUU = 'albumKyNiem_v1';

// Danh sách kỷ niệm. Mỗi kỷ niệm là 1 object:
// { id, loai: 'chung' | 'mot-minh', anh: (dữ liệu ảnh), ten, ngay: 'YYYY-MM-DD', ghiChu }
let danhSachKyNiem = [];

// Trạng thái bộ lọc hiện tại
let locLoai  = 'tat-ca';  // 'tat-ca' | 'chung' | 'mot-minh'
let locThang = '';        // '' hoặc '01'...'12'
let locNam   = '';        // '' hoặc '2025'...

// Ảnh vừa chọn trong form (đã nén), chưa lưu
let anhDangChon = '';

// Id kỷ niệm đang xem trong lightbox
let idDangXem = null;

// Tên loại album để hiển thị
const TEN_LOAI = {
  'chung':    '👫 Chụp chung',
  'mot-minh': '🧍 Ảnh em'
};

// Màu băng keo xen kẽ cho đẹp
const MAU_KEO = [
  'rgba(244, 213, 141, 0.85)',
  'rgba(224, 96, 126, 0.55)',
  'rgba(106, 166, 160, 0.6)',
  'rgba(160, 140, 200, 0.55)'
];


// ============================================================
//  2. LƯU / ĐỌC DỮ LIỆU
//  Dùng IndexedDB: kho lưu trữ của trình duyệt, chứa được
//  rất nhiều ảnh (hàng trăm MB) và vẫn còn khi tắt trang,
//  tắt trình duyệt hoặc khởi động lại máy.
//  Nếu trình duyệt không hỗ trợ → tự dùng localStorage.
// ============================================================

const TEN_DB  = 'AlbumKyNiemDB';
const TEN_KHO = 'kyNiem';
let db = null;   // kết nối IndexedDB (null nếu không dùng được)

/** Mở (hoặc tạo mới) cơ sở dữ liệu */
function moDatabase() {
  return new Promise(function (xong) {
    if (!window.indexedDB) { xong(null); return; }
    try {
      const yeuCau = indexedDB.open(TEN_DB, 1);
      yeuCau.onupgradeneeded = function () {
        yeuCau.result.createObjectStore(TEN_KHO, { keyPath: 'id' });
      };
      yeuCau.onsuccess = function () { db = yeuCau.result; xong(db); };
      yeuCau.onerror   = function () { xong(null); };
    } catch (loi) {
      xong(null);
    }
  });
}

/** Đọc tất cả kỷ niệm đã lưu */
function docTatCa() {
  return new Promise(function (xong) {
    if (!db) {
      try {
        const chuoi = localStorage.getItem(KHOA_LUU);
        xong(chuoi ? JSON.parse(chuoi) : []);
      } catch (loi) { xong([]); }
      return;
    }
    const yeuCau = db.transaction(TEN_KHO, 'readonly').objectStore(TEN_KHO).getAll();
    yeuCau.onsuccess = function () { xong(yeuCau.result || []); };
    yeuCau.onerror   = function () { xong([]); };
  });
}

/** Lưu (thêm mới hoặc ghi đè) 1 kỷ niệm. Trả về true nếu thành công */
function luuMotKyNiem(kn) {
  return new Promise(function (xong) {
    if (!db) {
      try {
        const ds = JSON.parse(localStorage.getItem(KHOA_LUU) || '[]')
          .filter(function (k) { return k.id !== kn.id; });
        ds.unshift(kn);
        localStorage.setItem(KHOA_LUU, JSON.stringify(ds));
        xong(true);
      } catch (loi) { xong(false); }
      return;
    }
    try {
      const giaoDich = db.transaction(TEN_KHO, 'readwrite');
      giaoDich.objectStore(TEN_KHO).put(kn);
      giaoDich.oncomplete = function () { xong(true); };
      giaoDich.onerror    = function () { xong(false); };
      giaoDich.onabort    = function () { xong(false); };
    } catch (loi) { xong(false); }
  });
}

/** Xóa 1 kỷ niệm theo id */
function xoaMotKyNiem(id) {
  return new Promise(function (xong) {
    if (!db) {
      try {
        const ds = JSON.parse(localStorage.getItem(KHOA_LUU) || '[]')
          .filter(function (k) { return k.id !== id; });
        localStorage.setItem(KHOA_LUU, JSON.stringify(ds));
      } catch (loi) {}
      xong();
      return;
    }
    const giaoDich = db.transaction(TEN_KHO, 'readwrite');
    giaoDich.objectStore(TEN_KHO).delete(id);
    giaoDich.oncomplete = function () { xong(); };
    giaoDich.onerror    = function () { xong(); };
  });
}

/** Chuyển ảnh đã lưu ở bản cũ (localStorage) sang kho mới, không làm mất ảnh nào */
async function chuyenDuLieuCu() {
  if (!db) return;
  try {
    const chuoi = localStorage.getItem(KHOA_LUU);
    if (!chuoi) return;
    const dsCu = JSON.parse(chuoi);
    for (let i = 0; i < dsCu.length; i++) {
      await luuMotKyNiem(dsCu[i]);
    }
    localStorage.removeItem(KHOA_LUU);   // chuyển xong thì xóa bản cũ
  } catch (loi) {}
}

/** Xin trình duyệt KHÔNG tự dọn dữ liệu của trang này khi thiếu bộ nhớ */
function xinLuuBenVung() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () {});
  }
}


// ============================================================
//  SAO LƯU & KHÔI PHỤC
//  Dùng để chuyển album giữa điện thoại ↔ máy tính,
//  hoặc cất 1 bản dự phòng.
// ============================================================

/** Tải toàn bộ album về thành 1 file .json */
function saoLuuAlbum() {
  if (danhSachKyNiem.length === 0) {
    hienToast('📭 Album đang trống, chưa có gì để sao lưu.');
    return;
  }
  const noiDung = JSON.stringify({ phienBan: 1, kyNiem: danhSachKyNiem });
  const tep = new Blob([noiDung], { type: 'application/json' });
  const duongDan = URL.createObjectURL(tep);

  const homNay = new Date().toISOString().slice(0, 10);
  const lienKet = document.createElement('a');
  lienKet.href = duongDan;
  lienKet.download = 'album-ky-niem-' + homNay + '.json';
  document.body.appendChild(lienKet);
  lienKet.click();
  lienKet.remove();
  setTimeout(function () { URL.revokeObjectURL(duongDan); }, 2000);

  hienToast('💾 Đã tải file sao lưu về máy!');
}

/** Đọc file sao lưu và gộp vào album hiện tại (không ghi đè ảnh đã có) */
async function khoiPhucAlbum(file) {
  if (!file) return;
  try {
    const duLieu = JSON.parse(await file.text());
    const dsMoi = Array.isArray(duLieu) ? duLieu : duLieu.kyNiem;
    if (!Array.isArray(dsMoi)) throw new Error('sai dinh dang');

    const idDaCo = danhSachKyNiem.map(function (k) { return k.id; });
    let soThem = 0;

    for (let i = 0; i < dsMoi.length; i++) {
      const kn = dsMoi[i];
      // Bỏ qua mục thiếu thông tin hoặc đã có sẵn
      if (!kn || !kn.id || !kn.anh || !kn.ten || !kn.ngay) continue;
      if (idDaCo.indexOf(kn.id) !== -1) continue;
      if (kn.loai !== 'chung' && kn.loai !== 'mot-minh') continue;
      if (await luuMotKyNiem(kn)) {
        danhSachKyNiem.push(kn);
        soThem++;
      }
    }

    capNhatBoLoc();
    hienThiAlbum();
    hienToast(soThem > 0
      ? '📥 Đã khôi phục ' + soThem + ' kỷ niệm!'
      : 'ℹ️ Không có kỷ niệm mới nào để thêm.');
  } catch (loi) {
    hienToast('❌ File này không phải file sao lưu của album.');
  }
  document.getElementById('inputKhoiPhuc').value = '';
}


// ============================================================
//  3. CHỌN ẢNH & NÉN ẢNH
//  (Ảnh gốc từ điện thoại rất nặng, nên ta thu nhỏ lại
//   để lưu được nhiều ảnh hơn)
// ============================================================

/**
 * Đọc file ảnh, thu nhỏ còn tối đa 900px rồi trả về dạng chuỗi
 * @param {File} file - File ảnh người dùng chọn
 * @returns {Promise<string>} Chuỗi dữ liệu ảnh (data URL)
 */
function nenAnh(file) {
  return new Promise(function (xong, loi) {
    const docFile = new FileReader();

    docFile.onload = function () {
      const anh = new Image();

      anh.onload = function () {
        const CANH_TOI_DA = 900;
        let rong = anh.width;
        let cao  = anh.height;

        // Thu nhỏ giữ nguyên tỉ lệ
        if (rong > cao && rong > CANH_TOI_DA) {
          cao  = Math.round(cao * CANH_TOI_DA / rong);
          rong = CANH_TOI_DA;
        } else if (cao >= rong && cao > CANH_TOI_DA) {
          rong = Math.round(rong * CANH_TOI_DA / cao);
          cao  = CANH_TOI_DA;
        }

        // Vẽ ảnh lên canvas rồi xuất ra JPEG chất lượng 75%
        const canvas = document.createElement('canvas');
        canvas.width  = rong;
        canvas.height = cao;
        canvas.getContext('2d').drawImage(anh, 0, 0, rong, cao);
        xong(canvas.toDataURL('image/jpeg', 0.75));
      };

      anh.onerror = loi;
      anh.src = docFile.result;
    };

    docFile.onerror = loi;
    docFile.readAsDataURL(file);
  });
}

/** Xử lý khi người dùng chọn (hoặc kéo thả) 1 file ảnh */
async function xuLyChonAnh(file) {
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    hienToast('⚠️ Vui lòng chọn file ảnh!');
    return;
  }

  try {
    anhDangChon = await nenAnh(file);

    // Hiện ảnh xem trước trong khung
    const preview = document.getElementById('preview');
    preview.src = anhDangChon;
    preview.hidden = false;
    document.getElementById('dropText').hidden = true;
  } catch (loi) {
    hienToast('❌ Không đọc được ảnh này, hãy thử ảnh khác.');
  }
}

/** Đưa khung chọn ảnh về trạng thái ban đầu */
function datLaiKhungAnh() {
  anhDangChon = '';
  document.getElementById('preview').hidden = true;
  document.getElementById('preview').src = '';
  document.getElementById('dropText').hidden = false;
  document.getElementById('inputAnh').value = '';
}


// ============================================================
//  4. THÊM KỶ NIỆM MỚI
// ============================================================

/** Khi bấm nút "Dán vào album" */
async function themKyNiem(e) {
  e.preventDefault();

  if (!anhDangChon) {
    hienToast('📸 Bạn chưa chọn ảnh nào cả!');
    return;
  }

  const kyNiem = {
    id:     Date.now(),
    loai:   document.querySelector('input[name="loai"]:checked').value,
    anh:    anhDangChon,
    ten:    document.getElementById('inputTen').value.trim(),
    ngay:   document.getElementById('inputNgay').value,   // dạng YYYY-MM-DD
    ghiChu: document.getElementById('inputGhiChu').value.trim()
  };

  // Lưu vào kho của trình duyệt trước; thành công mới thêm lên màn hình
  const daLuu = await luuMotKyNiem(kyNiem);
  if (!daLuu) {
    hienToast('💾 Không lưu được (bộ nhớ đầy?). Hãy xóa bớt ảnh cũ.');
    return;
  }
  danhSachKyNiem.unshift(kyNiem);

  // Làm sạch form
  document.getElementById('formKyNiem').reset();
  datNgayHomNay();
  datLaiKhungAnh();

  capNhatBoLoc();
  hienThiAlbum();
  hienToast('📌 Đã dán kỷ niệm vào album!');
}


// ============================================================
//  5. HIỂN THỊ ALBUM
// ============================================================

/** Lấy danh sách sau khi áp dụng các bộ lọc */
function layDanhSachDaLoc() {
  return danhSachKyNiem
    .filter(function (kn) {
      // Lọc theo loại album
      if (locLoai !== 'tat-ca' && kn.loai !== locLoai) return false;

      // kn.ngay có dạng "2025-03-18" → tách ra năm, tháng
      const phan = kn.ngay.split('-');
      const nam   = phan[0];
      const thang = phan[1];

      if (locNam   && nam   !== locNam)   return false;
      if (locThang && thang !== locThang) return false;
      return true;
    })
    // Sắp xếp ảnh mới nhất (theo ngày chụp) lên trước
    .sort(function (a, b) {
      return b.ngay.localeCompare(a.ngay);
    });
}

/** Vẽ toàn bộ ảnh Polaroid lên màn hình */
function hienThiAlbum() {
  const luoi = document.getElementById('grid');
  const trong = document.getElementById('empty');
  const ds = layDanhSachDaLoc();

  luoi.innerHTML = '';

  // Cập nhật số liệu ở đầu trang
  capNhatThongKe();

  // Nếu không có ảnh → hiện thông báo
  if (ds.length === 0) {
    trong.hidden = false;
    document.getElementById('emptyText').textContent =
      danhSachKyNiem.length === 0
        ? 'Album còn trống. Hãy thêm kỷ niệm đầu tiên nhé!'
        : 'Không tìm thấy ảnh nào trong thời gian này 🔍';
    return;
  }
  trong.hidden = true;

  ds.forEach(function (kn, viTri) {
    const the = document.createElement('div');
    the.className = 'polaroid';

    // Mỗi ảnh nghiêng một góc khác nhau (ổn định theo id)
    const goc = ((kn.id % 7) - 3) * 0.9;
    the.style.setProperty('--goc', goc + 'deg');
    the.style.setProperty('--keo', (((kn.id % 5) - 2) * 3) + 'deg');
    the.style.setProperty('--mau-keo', MAU_KEO[kn.id % MAU_KEO.length]);
    // Các ảnh hiện ra lần lượt
    the.style.animationDelay = Math.min(viTri * 0.06, 0.8) + 's';

    // Dùng escapeHtml để tránh lỗi/chèn mã độc từ chữ người dùng nhập
    the.innerHTML =
      '<span class="nhan ' + kn.loai + '">' + TEN_LOAI[kn.loai] + '</span>' +
      '<img class="anh" src="' + kn.anh + '" alt="' + escapeHtml(kn.ten) + '" />' +
      '<div class="ten">' + escapeHtml(kn.ten) + '</div>' +
      '<div class="ngay">📅 ' + dinhDangNgay(kn.ngay) + '</div>';

    the.addEventListener('click', function () { moLightbox(kn.id); });
    luoi.appendChild(the);
  });
}

/** Cập nhật 3 con số thống kê ở đầu trang */
function capNhatThongKe() {
  const chung = danhSachKyNiem.filter(function (k) { return k.loai === 'chung'; }).length;
  const rieng = danhSachKyNiem.filter(function (k) { return k.loai === 'mot-minh'; }).length;
  document.getElementById('statTong').textContent  = danhSachKyNiem.length;
  document.getElementById('statChung').textContent = chung;
  document.getElementById('statRieng').textContent = rieng;
}


// ============================================================
//  6. BỘ LỌC
// ============================================================

/** Tạo danh sách tháng & năm trong 2 ô chọn */
function capNhatBoLoc() {
  const oThang = document.getElementById('locThang');
  const oNam   = document.getElementById('locNam');

  // --- Tháng: luôn có đủ 12 tháng ---
  let htmlThang = '<option value="">Tất cả các tháng</option>';
  for (let t = 1; t <= 12; t++) {
    const gia = String(t).padStart(2, '0');
    htmlThang += '<option value="' + gia + '">Tháng ' + t + '</option>';
  }
  oThang.innerHTML = htmlThang;
  oThang.value = locThang;

  // --- Năm: chỉ hiện những năm đang có ảnh ---
  const cacNam = [];
  danhSachKyNiem.forEach(function (kn) {
    const nam = kn.ngay.split('-')[0];
    if (cacNam.indexOf(nam) === -1) cacNam.push(nam);
  });
  cacNam.sort().reverse(); // năm mới nhất lên trước

  let htmlNam = '<option value="">Tất cả các năm</option>';
  cacNam.forEach(function (nam) {
    htmlNam += '<option value="' + nam + '">Năm ' + nam + '</option>';
  });
  oNam.innerHTML = htmlNam;

  // Nếu năm đang lọc không còn ảnh nào thì bỏ lọc
  if (locNam && cacNam.indexOf(locNam) === -1) locNam = '';
  oNam.value = locNam;
}

/** Bấm nút "Xóa lọc" */
function xoaLoc() {
  locThang = '';
  locNam   = '';
  document.getElementById('locThang').value = '';
  document.getElementById('locNam').value   = '';
  hienThiAlbum();
}


// ============================================================
//  7. XEM ẢNH LỚN & XÓA
// ============================================================

/** Mở cửa sổ xem ảnh lớn */
function moLightbox(id) {
  const kn = danhSachKyNiem.find(function (k) { return k.id === id; });
  if (!kn) return;

  idDangXem = id;
  document.getElementById('lbImg').src = kn.anh;
  document.getElementById('lbImg').alt = kn.ten;
  document.getElementById('lbTen').textContent = kn.ten;
  document.getElementById('lbNgay').textContent = '📅 ' + dinhDangNgayDai(kn.ngay);
  document.getElementById('lbGhiChu').textContent = kn.ghiChu || '(Chưa có ghi chú)';

  const tag = document.getElementById('lbTag');
  tag.textContent = TEN_LOAI[kn.loai];
  tag.className = 'lb-tag ' + kn.loai;

  document.getElementById('lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
}

/** Đóng cửa sổ xem ảnh lớn */
function dongLightbox() {
  document.getElementById('lightbox').hidden = true;
  document.body.style.overflow = '';
  idDangXem = null;
}

/** Xóa kỷ niệm đang xem */
async function xoaKyNiem() {
  if (idDangXem === null) return;
  if (!confirm('Bạn chắc chắn muốn xóa kỷ niệm này chứ?')) return;

  await xoaMotKyNiem(idDangXem);
  danhSachKyNiem = danhSachKyNiem.filter(function (k) { return k.id !== idDangXem; });
  dongLightbox();
  capNhatBoLoc();
  hienThiAlbum();
  hienToast('🗑 Đã xóa kỷ niệm.');
}


// ============================================================
//  8. TIỆN ÍCH
// ============================================================

/** "2025-03-18" → "18/03/2025" */
function dinhDangNgay(chuoi) {
  const p = chuoi.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

/** "2025-03-18" → "Ngày 18 tháng 3 năm 2025" */
function dinhDangNgayDai(chuoi) {
  const p = chuoi.split('-');
  return 'Ngày ' + parseInt(p[2], 10) + ' tháng ' + parseInt(p[1], 10) + ' năm ' + p[0];
}

/** Đổi ký tự đặc biệt để chữ người dùng nhập không phá giao diện */
function escapeHtml(chu) {
  return String(chu)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Hiện thông báo nhỏ ở cuối màn hình */
let timerToast = null;
function hienToast(noiDung) {
  const el = document.getElementById('toast');
  el.textContent = noiDung;
  el.classList.add('show');
  clearTimeout(timerToast);
  timerToast = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/** Đặt ô ngày mặc định là hôm nay (và không cho chọn ngày tương lai) */
function datNgayHomNay() {
  const homNay = new Date();
  const nam   = homNay.getFullYear();
  const thang = String(homNay.getMonth() + 1).padStart(2, '0');
  const ngay  = String(homNay.getDate()).padStart(2, '0');
  const chuoi = nam + '-' + thang + '-' + ngay;

  const o = document.getElementById('inputNgay');
  o.value = chuoi;
  o.max   = chuoi;
}

/** Tạo các trái tim bay trang trí */
function taoTraiTim() {
  const khung = document.getElementById('hearts');
  const bieuTuong = ['💗', '💖', '✨', '🌸', '💕'];

  setInterval(function () {
    const tim = document.createElement('span');
    tim.className = 'heart';
    tim.textContent = bieuTuong[Math.floor(Math.random() * bieuTuong.length)];
    tim.style.left = Math.random() * 100 + '%';
    tim.style.fontSize = (12 + Math.random() * 16) + 'px';
    tim.style.animationDuration = (7 + Math.random() * 6) + 's';
    khung.appendChild(tim);
    setTimeout(function () { tim.remove(); }, 14000);
  }, 1400);
}


// ============================================================
//  9. KHỞI CHẠY KHI TRANG TẢI XONG
// ============================================================

document.addEventListener('DOMContentLoaded', async function () {

  // Mở kho lưu trữ → chuyển ảnh bản cũ (nếu có) → đọc ảnh lên màn hình
  await moDatabase();
  await chuyenDuLieuCu();
  danhSachKyNiem = await docTatCa();
  xinLuuBenVung();

  datNgayHomNay();
  capNhatBoLoc();
  hienThiAlbum();
  taoTraiTim();

  // --- Form ---
  document.getElementById('formKyNiem').addEventListener('submit', themKyNiem);

  // --- Chọn ảnh ---
  document.getElementById('inputAnh').addEventListener('change', function (e) {
    xuLyChonAnh(e.target.files[0]);
  });

  // --- Nút chụp ảnh bằng camera (điện thoại) ---
  document.getElementById('btnCamera').addEventListener('click', function () {
    document.getElementById('inputCamera').click();
  });
  document.getElementById('inputCamera').addEventListener('change', function (e) {
    xuLyChonAnh(e.target.files[0]);
    e.target.value = '';
  });

  // --- Sao lưu / khôi phục ---
  document.getElementById('btnSaoLuu').addEventListener('click', saoLuuAlbum);
  document.getElementById('btnKhoiPhuc').addEventListener('click', function () {
    document.getElementById('inputKhoiPhuc').click();
  });
  document.getElementById('inputKhoiPhuc').addEventListener('change', function (e) {
    khoiPhucAlbum(e.target.files[0]);
  });

  // --- Kéo thả ảnh vào khung ---
  const khung = document.getElementById('dropzone');
  khung.addEventListener('dragover', function (e) {
    e.preventDefault();
    khung.classList.add('keo');
  });
  khung.addEventListener('dragleave', function () {
    khung.classList.remove('keo');
  });
  khung.addEventListener('drop', function (e) {
    e.preventDefault();
    khung.classList.remove('keo');
    xuLyChonAnh(e.dataTransfer.files[0]);
  });

  // --- Tab loại album ---
  document.getElementById('tabs').addEventListener('click', function (e) {
    const nut = e.target.closest('.tab');
    if (!nut) return;
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    nut.classList.add('active');
    locLoai = nut.dataset.loai;
    hienThiAlbum();
  });

  // --- Bộ lọc tháng / năm ---
  document.getElementById('locThang').addEventListener('change', function (e) {
    locThang = e.target.value;
    hienThiAlbum();
  });
  document.getElementById('locNam').addEventListener('change', function (e) {
    locNam = e.target.value;
    hienThiAlbum();
  });
  document.getElementById('btnReset').addEventListener('click', xoaLoc);

  // --- Lightbox ---
  document.getElementById('lbClose').addEventListener('click', dongLightbox);
  document.getElementById('lbXoa').addEventListener('click', xoaKyNiem);
  document.getElementById('lightbox').addEventListener('click', function (e) {
    // Bấm ra ngoài khung ảnh thì đóng
    if (e.target.id === 'lightbox') dongLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') dongLightbox();
  });
});
