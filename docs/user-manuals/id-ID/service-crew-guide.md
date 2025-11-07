# 🚀 Panduan Operasional Server MakanMakan

> **Versi**: 2.0
> **Terakhir Diperbarui**: 2025-10-26
> **Untuk**: Server Restoran, Staf Pelayanan

---

## 📚 Daftar Isi

1. [Mulai Cepat](#mulai-cepat)
2. [Gambaran Sistem](#gambaran-sistem)
3. [Login & Operasi Dasar](#login--operasi-dasar)
4. [Manajemen Pesanan](#manajemen-pesanan)
5. [Proses Pengiriman](#proses-pengiriman)
6. [Manajemen Status Pesanan](#manajemen-status-pesanan)
7. [Layanan Pelanggan](#layanan-pelanggan)
8. [Pencatatan Kerja](#pencatatan-kerja)
9. [Penanganan Situasi Darurat](#penanganan-situasi-darurat)
10. [Pertanyaan Umum](#pertanyaan-umum)

---

## 🚀 Mulai Cepat

### Selamat Bergabung dengan Tim MakanMakan!

Sebagai server, Anda adalah jembatan penting antara restoran dan pelanggan. Tanggung jawab utama Anda adalah:

```
┌─────────────────────────────────────────┐
│ Tanggung Jawab Inti Server              │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Menerima dan melihat pesanan baru  │
│  ✅ Mengambil makanan dari dapur       │
│  ✅ Mengantar ke meja/kursi yang tepat │
│  ✅ Memperbarui status pengiriman      │
│  ✅ Merespons permintaan pelanggan     │
│  ✅ Menjaga kualitas layanan           │
│                                         │
└─────────────────────────────────────────┘
```

### Gambaran Alur Kerja Harian

```
08:00 Login sistem → Cek jadwal
   ↓
09:00 Persiapan buka → Cek peralatan
   ↓
11:00 Mulai operasional → Terima pesanan
   ↓
11:30 Jam sibuk → Pengiriman cepat
   ↓
14:00 Waktu istirahat → Bersihkan area
   ↓
17:00 Persiapan makan malam → Cek ulang
   ↓
21:00 Penutupan → Laporan catatan
   ↓
21:30 Sign out → Selesai tugas harian
```

---

## 🏢 Gambaran Sistem

### Peran Server dalam Tim

```
        Pemilik
           │
    ┌──────┼──────┬──────┐
    ↓      ↓      ↓      ↓
   Chef  Server Kasir Pelanggan
    │      │      │      │
    └──────┴──────┴──────┘
           │
   Sistem Pesanan Real-time
```

**Penjelasan Peran**:
- **Chef**: Siapkan makanan → Notifikasi pengambilan
- **Anda (Server)**: Ambil → Antar → Update status
- **Kasir**: Proses pembayaran → Selesaikan pesanan
- **Pelanggan**: Pesan → Tunggu → Makan

### Ruang Lingkup Izin

```
┌─────────────────────────────────────────┐
│ Operasi yang Dapat Dilakukan Server    │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Lihat daftar pesanan tertunda      │
│  ✅ Lihat detail pesanan               │
│  ✅ Update pesanan ke "Sedang Diantar" │
│  ✅ Update pesanan ke "Sudah Diantar"  │
│  ✅ Lihat informasi meja               │
│  ✅ Lihat catatan kerja pribadi        │
│  ✅ Edit profil pribadi                │
│                                         │
│  ❌ Tidak dapat ubah harga menu        │
│  ❌ Tidak dapat hapus pesanan          │
│  ❌ Tidak dapat lihat omset            │
│  ❌ Tidak dapat kelola staf lain       │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔐 Login & Operasi Dasar

### Proses Login Pertama

```
┌──────────────────────────────────────────┐
│ Langkah Login                            │
├──────────────────────────────────────────┤
│                                          │
│  1️⃣ Buka App Server MakanMakan          │
│      ↓                                   │
│  2️⃣ Masukkan username & password        │
│      dari pemilik                        │
│      ↓                                   │
│  3️⃣ Wajib ubah password saat login      │
│      pertama                             │
│      ↓                                   │
│  4️⃣ Lengkapi profil pribadi             │
│      ↓                                   │
│  5️⃣ Masuk ke workspace server           │
│                                          │
└──────────────────────────────────────────┘
```

### Contoh Informasi Login

| Item | Keterangan | Contoh |
|------|-----------|--------|
| Username | Akun karyawan dibuat pemilik | crew001 atau email.anda@example.com |
| Password Awal | Password sementara dari pemilik | Temp123456 |
| Password Baru | Min 8 karakter, huruf dan angka | MyPass2025! |

### Checklist Login Pertama

✅ **Ubah Password Default**
- Set password yang aman dan mudah diingat
- Jangan bagikan ke orang lain

✅ **Lengkapi Profil Pribadi**
- Upload foto profil (opsional)
- Isi nomor telepon kontak
- Konfirmasi kontak darurat

✅ **Kenali Interface**
- Jelajahi area fungsi utama
- Test fungsi lihat pesanan
- Pahami cara update status

---

## 📋 Manajemen Pesanan

### Interface Tampilan Pesanan

```
┌─────────────────────────────────────────────┐
│ 🍽️ Pesanan Tertunda                        │
├─────────────────────────────────────────────┤
│                                             │
│  【Pesanan #1234】            🔴 Baru       │
│  ┌─────────────────────────────────────┐   │
│  │ 🕐 11:23  📍 Meja A3  👥 4 org      │   │
│  │                                     │   │
│  │ 🍜 Mie Sapi x 2                    │   │
│  │ 🥤 Teh Manis x 2                   │   │
│  │ 🍲 Platter Pembuka x 1             │   │
│  │                                     │   │
│  │ 💬 Catatan: Mie sapi tidak pedas   │   │
│  │                                     │   │
│  │ [🍳 Dapur Selesai] [📦 Siap Ambil] │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  【Pesanan #1235】            🟡 Diproses   │
│  ┌─────────────────────────────────────┐   │
│  │ 🕐 11:25  📍 Meja B2  👥 2 org      │   │
│  │                                     │   │
│  │ 🍛 Nasi Kari x 1                   │   │
│  │ 🥗 Salad Sayur x 1                 │   │
│  │                                     │   │
│  │ [🍳 Dapur Memproses]                │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Penjelasan Status Pesanan

```
┌─────────────────────────────────────────┐
│ Alur Status Pesanan                     │
├─────────────────────────────────────────┤
│                                         │
│  🆕 Pesanan Baru                       │
│   ↓                                     │
│  🍳 Dapur Memproses (Chef)             │
│   ↓                                     │
│  ✅ Dapur Selesai → 📦 Siap Diambil    │
│   ↓                                     │
│  🚶 Sedang Diantar (Anda)              │
│   ↓                                     │
│  ✅ Sudah Diantar (Anda)               │
│   ↓                                     │
│  💰 Sudah Dibayar (Kasir)              │
│   ↓                                     │
│  🎉 Pesanan Selesai                    │
│                                         │
└─────────────────────────────────────────┘
```

### Panduan Informasi Pesanan

| Ikon/Label | Arti | Tindakan Anda |
|-----------|------|--------------|
| 🔴 Pesanan Baru | Baru dipesan | Pantau progress dapur |
| 🟡 Diproses | Dapur sedang masak | Tunggu notifikasi ambil |
| 🟢 Siap Diambil | Makanan sudah siap | **Segera ambil** |
| 🔵 Sedang Diantar | Anda sedang mengantar | Antar secepat mungkin |
| ✅ Sudah Diantar | Makanan sudah diantar | Tugas selesai |

### Fungsi Filter Pesanan

Navigasi: **Workspace → Daftar Pesanan → Filter**

```
Opsi Filter:
  ├─ 📦 Pesanan Siap Diambil (Paling sering)
  ├─ 🚶 Sedang Diantar
  ├─ ✅ Selesai Hari Ini
  ├─ 📍 Filter Berdasarkan Meja
  └─ 🕐 Urutkan Berdasarkan Waktu
```

---

## 🍽️ Proses Pengiriman

### Langkah Pengiriman Standar

```
┌─────────────────────────────────────────────┐
│ Proses Pengiriman Standar (SOP)            │
├─────────────────────────────────────────────┤
│                                             │
│  Langkah 1: Terima Notifikasi Pengambilan  │
│  ─────────────────────────                  │
│   ✓ Sistem tampilkan "📦 Siap Diambil"    │
│   ✓ Cek nomor pesanan dan meja            │
│   ✓ Konfirmasi item makanan               │
│                                             │
│  Langkah 2: Pergi ke Dapur Ambil Makanan   │
│  ─────────────────────────                  │
│   ✓ Konfirmasi nomor pesanan dengan chef  │
│   ✓ Verifikasi item dan jumlah            │
│   ✓ Cek tampilan dan suhu makanan         │
│   ✓ Siapkan alat makan dan bumbu          │
│                                             │
│  Langkah 3: Update ke "Sedang Diantar"     │
│  ─────────────────────────                  │
│   ✓ Klik kartu pesanan                    │
│   ✓ Pilih "🚶 Mulai Antar"                │
│   ✓ Sistem kirim notifikasi ke pelanggan │
│                                             │
│  Langkah 4: Antar ke Meja                  │
│  ─────────────────────────                  │
│   ✓ Konfirmasi nomor meja/kursi           │
│   ✓ Sapa pelanggan dengan sopan           │
│   ✓ Letakkan makanan dan jelaskan         │
│   ✓ Tanyakan ada kebutuhan lain           │
│                                             │
│  Langkah 5: Konfirmasi Sudah Diantar       │
│  ─────────────────────────                  │
│   ✓ Klik tombol "✅ Sudah Diantar"        │
│   ✓ Sistem catat waktu selesai           │
│   ✓ Lanjutkan proses pesanan berikutnya   │
│                                             │
└─────────────────────────────────────────────┘
```

### Checklist Pengambilan

Saat mengambil dari dapur, pastikan:

| Item Cek | Konfirmasi |
|---------|-----------|
| ✅ Nomor Pesanan | Cocokkan dengan tampilan sistem |
| ✅ Item Makanan | Verifikasi nama dan jumlah satu per satu |
| ✅ Kelengkapan | Lauk, saus, alat makan lengkap |
| ✅ Kondisi Makanan | Makanan panas cukup panas, minuman dingin cukup dingin |
| ✅ Kualitas Tampilan | Plating rapi, tidak tumpah |
| ✅ Permintaan Khusus | Cek catatan (contoh: tidak pedas, vegetarian) |

### Etika Layanan Pengiriman

```
┌─────────────────────────────────────────┐
│ Etika Layanan Pengiriman                │
├─────────────────────────────────────────┤
│                                         │
│  ✅ DO - Lakukan Ini                   │
│  ─────────────────                      │
│  • Senyum & sapa: "Halo, ini pesanan   │
│    Anda"                               │
│  • Bicara pelan, jangan ganggu lainnya │
│  • Letakkan hati-hati, hindari tumpah  │
│  • Kenalkan menu andalan: "Ini menu    │
│    spesial kami"                       │
│  • Tanyakan proaktif: "Ada yang        │
│    diperlukan lagi?"                   │
│  • Ucapkan: "Selamat menikmati"        │
│                                         │
│  ❌ DON'T - Hindari Ini                │
│  ─────────────────────                  │
│  • Salah meja, tidak konfirmasi nomor  │
│  • Sikap dingin, tidak kontak mata     │
│  • Kasar menaruh piring                │
│  • Lupa alat makan atau bumbu          │
│  • Tidak update status setelah antar   │
│  • Abaikan pertanyaan pelanggan        │
│                                         │
└─────────────────────────────────────────┘
```

### Pengiriman Multi-Pesanan Bersamaan

Saat perlu mengantar beberapa pesanan sekaligus:

```
Strategi Pengiriman Efisien:

  📍 Rencanakan rute berdasarkan zona meja
     │
     ├─ Zona A (A1-A5)
     ├─ Zona B (B1-B5)
     └─ Zona C (C1-C5)

  🎯 Ambil dan antar batch
     │
     ├─ Zona sama → Antar bersamaan
     ├─ Zona beda → Batch terpisah
     └─ Makanan panas prioritas → Jaga suhu
```

**Contoh**:

```
Situasi: 3 pesanan tertunda

Pesanan #1234 → Meja A3 → Mie Sapi (panas)
Pesanan #1235 → Meja A5 → Nasi Goreng (panas)
Pesanan #1236 → Meja B2 → Es Smoothie (dingin)

✅ Strategi Terbaik:
  1. Ambil A3, A5 makanan panas dulu (zona sama)
  2. Antar A3 → A5 (rute efisien)
  3. Kembali ambil B2 minuman dingin
  4. Antar B2

⏱️ Hemat Waktu: 5-10 menit
```

---

## 🔄 Manajemen Status Pesanan

### Cara Update Status Pesanan

```
┌──────────────────────────────────────────┐
│ Langkah Update Status Pesanan            │
├──────────────────────────────────────────┤
│                                          │
│  Metode 1: Update langsung di daftar     │
│  ───────────────────────────              │
│                                          │
│   [Pesanan #1234]  [📦 Mulai Antar]     │
│                      ↑                   │
│                   Klik tombol ini        │
│                                          │
│  Metode 2: Update via detail pesanan     │
│  ───────────────────────────              │
│                                          │
│   [Pesanan #1234] → Klik lihat detail    │
│         ↓                                │
│   【Halaman Detail Pesanan】             │
│   [Update Status: Sedang Diantar ▼]     │
│         ↓                                │
│   Pilih status baru → Konfirmasi         │
│                                          │
└──────────────────────────────────────────┘
```

### Waktu Update Status

| Status Saat Ini | Update Ke | Waktu |
|----------------|-----------|-------|
| 🟢 Siap Diambil | 🚶 Sedang Diantar | **Setelah ambil, sebelum berangkat** |
| 🚶 Sedang Diantar | ✅ Sudah Diantar | **Setelah letakkan di meja** |

### Pentingnya Update Status

```
Mengapa harus update status tepat waktu?

  1. 📱 Pelanggan lacak real-time
     └─ App pelanggan tampilkan progress

  2. 🏢 Pemilik monitor efisiensi
     └─ Dashboard analisis waktu antar

  3. 📊 Statistik data sistem
     └─ Optimasi alokasi tenaga kerja

  4. 🤝 Kolaborasi tim lancar
     └─ Staf lain paham situasi
```

---

## 🤝 Layanan Pelanggan

### Permintaan Pelanggan Umum

```
┌─────────────────────────────────────────┐
│ Permintaan Pelanggan & Respons          │
├─────────────────────────────────────────┤
│                                         │
│  Permintaan 1: "Bisa tambah sumpit?"    │
│  Respons: "Baik, saya ambilkan sekarang"│
│  Tindakan: Segera sediakan              │
│                                         │
│  Permintaan 2: "Pesanan saya mana?"     │
│  Respons: "Maaf, saya cek dulu"         │
│  Tindakan: Cek status → Konfirmasi dapur│
│                                         │
│  Permintaan 3: "Ini terlalu pedas,      │
│                 bisa ganti?"            │
│  Respons: "Maaf, saya panggil manager"  │
│  Tindakan: Hubungi pemilik/supervisor   │
│                                         │
│  Permintaan 4: "Bisa foto kami?"        │
│  Respons: "Tentu saja!"                 │
│  Tindakan: Bantu foto, tunjukkan        │
│             kehangatan                  │
│                                         │
│  Permintaan 5: "Kami mau bayar"         │
│  Respons: "Baik, saya panggil kasir"    │
│  Tindakan: Hubungi kasir                │
│                                         │
└─────────────────────────────────────────┘
```

### Standar Sikap Layanan

```
🌟 5 Kunci Layanan Berkualitas

  1️⃣ Senyum (Smile)
     └─ Selalu pertahankan senyum ramah

  2️⃣ Kontak Mata (Eye Contact)
     └─ Tunjukkan Anda mendengarkan serius

  3️⃣ Respons Cepat (Quick Response)
     └─ Balas permintaan dalam 30 detik

  4️⃣ Komunikasi Jelas (Clear Communication)
     └─ Pastikan pelanggan paham jawaban

  5️⃣ Perhatian Ekstra (Extra Care)
     └─ Layanan melebihi ekspektasi
```

### Langkah Penanganan Keluhan

```
┌──────────────────────────────────────────┐
│ SOP Penanganan Keluhan Pelanggan         │
├──────────────────────────────────────────┤
│                                          │
│  Langkah 1: Dengar & Minta Maaf          │
│  ───────────────────                      │
│   • Jangan potong, dengarkan sabar       │
│   • Ungkapkan maaf: "Maaf atas           │
│     ketidaknyamanannya"                  │
│                                          │
│  Langkah 2: Konfirmasi Masalah           │
│  ───────────────────                      │
│   • Ulangi masalah: "Maksud Anda...      │
│     benar?"                              │
│   • Pastikan pahami sepenuhnya           │
│                                          │
│  Langkah 3: Tawarkan Solusi              │
│  ───────────────────                      │
│   • Masalah kecil: Tangani langsung      │
│   • Masalah besar: Minta bantuan atasan  │
│                                          │
│  Langkah 4: Eksekusi & Tindak Lanjut     │
│  ───────────────────                      │
│   • Cepat laksanakan solusi              │
│   • Konfirmasi kepuasan pelanggan        │
│                                          │
│  Langkah 5: Catat & Laporkan             │
│  ───────────────────                      │
│   • Catat kejadian di sistem             │
│   • Laporkan masalah serius ke atasan    │
│                                          │
└──────────────────────────────────────────┘
```

---

## 📊 Pencatatan Kerja

### Lihat Statistik Kerja Pribadi

Navigasi: **Profil Pribadi → Catatan Kerja**

```
┌─────────────────────────────────────────┐
│ 📊 Statistik Minggu Ini                │
├─────────────────────────────────────────┤
│                                         │
│  🚀 Pesanan Selesai: 127 pesanan       │
│  ⏱️ Waktu Antar Rata-rata: 4.2 menit  │
│  ⭐ Kepuasan Pelanggan: 4.8 / 5.0     │
│  🏆 Penilaian Layanan: Sangat Baik    │
│                                         │
│  📈 Tren Pengiriman Harian             │
│  ───────────────────                    │
│   Senin: ████████░░ 18 pesanan        │
│   Selasa: ██████████ 22 pesanan       │
│   Rabu: ███████░░░ 15 pesanan         │
│   Kamis: █████████░ 20 pesanan        │
│   Jumat: ████████████ 28 pesanan      │
│   Sabtu: ██████████████ 32 pesanan    │
│   Minggu: ████████░░ 16 pesanan       │
│                                         │
└─────────────────────────────────────────┘
```

### Lihat Catatan Pengiriman Detail

```
Daftar Catatan Pengiriman
  │
  ├─ [2025-10-26 12:30] Pesanan #1234
  │   └─ Meja A3 → Waktu antar: 3m 45s ✅
  │
  ├─ [2025-10-26 12:45] Pesanan #1235
  │   └─ Meja B2 → Waktu antar: 4m 12s ✅
  │
  ├─ [2025-10-26 13:00] Pesanan #1236
  │   └─ Meja C5 → Waktu antar: 5m 30s ✅
  │
  └─ [2025-10-26 13:15] Pesanan #1237
      └─ Meja A1 → Waktu antar: 3m 20s ✅
```

### Penjelasan Indikator Kinerja

| Indikator | Keterangan | Target |
|----------|-----------|--------|
| Waktu Antar Rata-rata | Dari ambil hingga antar | < 5 menit |
| Jumlah Pesanan Selesai | Pengiriman sukses per hari | Tergantung shift |
| Kepuasan Pelanggan | Berdasarkan rating pelanggan | ≥ 4.5 / 5.0 |
| Tingkat Tepat Waktu | Antar dalam waktu estimasi | ≥ 95% |

---

## 🚨 Penanganan Situasi Darurat

### Situasi Darurat Umum

```
┌─────────────────────────────────────────┐
│ Panduan Respons Situasi Darurat         │
├─────────────────────────────────────────┤
│                                         │
│  Situasi 1: Makanan tumpah saat antar   │
│  ───────────────────────                │
│   1. Segera bersihkan lokasi            │
│   2. Hubungi dapur untuk masak ulang    │
│   3. Minta maaf ke pelanggan & jelaskan │
│   4. Berikan estimasi waktu tunggu      │
│   5. Catat kejadian & laporkan atasan   │
│                                         │
│  Situasi 2: Salah antar meja            │
│  ───────────────────────                │
│   1. Segera konfirmasi nomor meja benar │
│   2. Minta maaf ke meja yang salah      │
│   3. Ambil makanan antar ke meja benar  │
│   4. Cek apakah perlu ganti makanan     │
│                                         │
│  Situasi 3: Pelanggan tidak puas        │
│              dengan makanan             │
│  ───────────────────────                │
│   1. Dengarkan & catat masalah          │
│   2. Segera hubungi atasan/manager      │
│   3. Jangan janji ganti/refund sendiri  │
│   4. Dampingi atasan tangani masalah    │
│                                         │
│  Situasi 4: Sistem error tidak bisa     │
│              update status              │
│  ───────────────────────                │
│   1. Lanjutkan layanan pengiriman       │
│   2. Catat nomor pesanan di kertas      │
│   3. Hubungi teknisi atau atasan        │
│   4. Setelah pulih, update catatan      │
│                                         │
│  Situasi 5: Jam sibuk pesanan meledak   │
│  ───────────────────────                │
│   1. Tetap tenang, tangani teratur      │
│   2. Prioritaskan makanan panas         │
│   3. Proses batch untuk zona sama       │
│   4. Minta dukungan jika perlu          │
│                                         │
└─────────────────────────────────────────┘
```

### Kontak Darurat

```
📞 Daftar Kontak Darurat
   │
   ├─ Manager/Supervisor: [Extension] atau [HP]
   ├─ Head Chef: [Extension]
   ├─ Kasir: [Extension]
   └─ Dukungan Teknis: support@makanmakan.com
```

### Laporan Kejadian

Jika terjadi kejadian yang perlu dicatat:

Navigasi: **Profil Pribadi → Laporan Kejadian**

```
Formulir Laporan Kejadian
  │
  ├─ Jenis Kejadian: [Menu Dropdown]
  ├─ Waktu Kejadian: [Isi Otomatis]
  ├─ Pesanan Terkait: [Nomor Pesanan]
  ├─ Deskripsi Kejadian: [Penjelasan Detail]
  ├─ Cara Penanganan: [Tindakan yang Diambil]
  └─ Bukti Foto: [Upload Foto (Opsional)]
```

---

## ❓ Pertanyaan Umum

### Q1: Bagaimana jika lupa password?

```
A: Langkah Reset Password

  1. Klik "Lupa Password" di halaman login
     ↓
  2. Masukkan username atau email karyawan
     ↓
  3. Sistem kirim link reset ke email
     ↓
  4. Klik link untuk set password baru
     ↓
  5. Jika masih tidak bisa, hubungi pemilik
```

---

### Q2: Pesanan tampil "Siap Diambil" tapi dapur bilang belum siap?

```
A: Kemungkinan delay update status

  ✅ Tindakan yang Benar:
     • Konfirmasi dengan chef
     • Percaya penilaian chef
     • Tunggu makanan benar-benar siap
     • Jangan terburu-buru催促 dapur
     • Jika sering terjadi, laporkan atasan
```

---

### Q3: Pelanggan bilang ada kesalahan pesanan, bagaimana?

```
A: Proses Penanganan Kesalahan Pesanan

  Langkah 1: Cek detail pesanan di sistem
         └─ Konfirmasi salah pelanggan atau sistem

  Langkah 2: Jika pelanggan salah pesan
         └─ Jelaskan sopan "Ini pesanan Anda"
         └─ Tanyakan ingin tambah item lain
         └─ Arahkan ke kasir untuk konsultasi

  Langkah 3: Jika dapur salah masak
         └─ Segera minta maaf
         └─ Hubungi dapur untuk masak ulang
         └─ Beri tahu pelanggan waktu tunggu

  Langkah 4: Catat kejadian
         └─ Tambah catatan di sistem
         └─ Laporan singkat ke atasan
```

---

### Q4: Jam sibuk pesanan terlalu banyak, tidak bisa selesai?

```
A: Strategi Jam Sibuk

  🎯 Strategi Prioritas
     │
     ├─ Prioritas 1: Pesanan tunggu > 10 menit
     ├─ Prioritas 2: Makanan panas (hindari dingin)
     ├─ Prioritas 3: Multi-pesanan zona sama (batch)
     └─ Prioritas 4: Minuman dingin, dessert

  🤝 Cari Bantuan
     │
     ├─ Minta dukungan server lain
     ├─ Beri tahu atasan butuh tenaga
     └─ Dapur prioritaskan pesanan lama

  💡 Tingkatkan Efisiensi
     │
     ├─ Gunakan tray untuk bawa banyak pesanan
     ├─ Rencanakan rute antar terpendek
     └─ Kurangi bolak-balik ke dapur
```

---

### Q5: Boleh pakai HP pribadi untuk cek pesanan?

```
A: Tergantung kebijakan restoran

  ✅ Jika restoran sediakan app mobile:
     • Boleh pakai HP sendiri
     • Download App Server MakanMakan
     • Login dengan akun karyawan
     • Pastikan koneksi internet stabil

  ⚠️ Jika pakai tablet restoran:
     • Hanya pakai perangkat yang disediakan
     • Jangan install app sembarangan
     • Jangan login di perangkat pribadi
     • Ikuti kebijakan keamanan informasi
```

---

### Q6: Setelah antar pelanggan tidak respons, tetap update "Sudah Diantar"?

```
A: Ya! Sudah antar = Update

  ✅ Tindakan yang Benar:
     • Makanan di meja = Sudah diantar
     • Tidak perlu konfirmasi pelanggan
     • Segera update status
     • Lanjutkan pesanan berikutnya

  ℹ️ Penjelasan:
     • Pelanggan lihat status antar di app
     • Jika ada masalah pelanggan akan panggil
     • Jangan tunda karena tunggu konfirmasi
```

---

### Q7: Bagaimana meningkatkan kecepatan antar?

```
A: Tips Peningkatan Efisiensi

  ⚡ Metode Optimasi Kecepatan
     │
     ├─ 1. Hafal layout meja
     │      └─ Ingat posisi nomor meja tiap zona
     │
     ├─ 2. Proses batch pesanan
     │      └─ Zona sama antar sekaligus
     │
     ├─ 3. Siapkan alat makan lebih dulu
     │      └─ Ambil semua saat ambil makanan
     │
     ├─ 4. Rencanakan rute terpendek
     │      └─ Hindari jalan memutar
     │
     ├─ 5. Jaga area kerja rapi
     │      └─ Kurangi waktu cari barang
     │
     └─ 6. Gunakan tray atau trolley
            └─ Bawa lebih banyak makanan sekaligus

  📊 Setting Target
     • Waktu antar rata-rata: < 5 menit
     • Dari ambil ke antar: < 3 menit
     • Kepuasan pelanggan: ≥ 4.5 bintang
```

---

### Q8: Boleh pakai HP saat bekerja?

```
A: Ikuti aturan restoran

  ✅ Boleh Digunakan:
     • Pakai App MakanMakan cek pesanan
     • Kontak darurat keluarga
     • Terima telepon atasan
     • Hal terkait pekerjaan

  ❌ Tidak Boleh:
     • Browse media sosial saat kerja
     • Chat, main game
     • Foto selfie (kecuali diizinkan)
     • Apapun yang ganggu efisiensi kerja

  📱 Prinsip Penggunaan:
     • Waktu istirahat bebas pakai
     • Jam kerja prioritas pekerjaan
     • Hal darurat bisa minta izin
```

---

### Q9: Pelanggan kasih tip, boleh terima?

```
A: Ikuti kebijakan restoran

  Opsi A: Dilarang terima tip
     • Tolak sopan: "Terima kasih, ini
       pekerjaan kami"
     • Jelaskan kebijakan toko
     • Jika pelanggan tetap bersikeras,
       tanyakan atasan

  Opsi B: Boleh terima tip
     • Ucapkan terima kasih sopan: "Terima
       kasih atas dorongannya"
     • Laporkan atau setor sesuai aturan
     • Ikuti sistem distribusi tip

  ⚠️ Perhatian:
     • Jangan minta tip aktif
     • Jangan ubah sikap layanan karena tip
     • Berikan layanan berkualitas sama rata
```

---

### Q10: Bertemu pelanggan tidak ramah bagaimana?

```
A: Respons Profesional

  🛡️ Strategi Respons
     │
     ├─ Tetap tenang
     │   └─ Jangan respons emosional
     │
     ├─ Sikap profesional
     │   └─ Pertahankan kesopanan & hormat
     │
     ├─ Dengarkan keluhan
     │   └─ Biarkan mereka selesai bicara
     │
     ├─ Minta maaf dengan tepat
     │   └─ "Maaf atas ketidaknyamanannya"
     │
     ├─ Cari bantuan
     │   └─ Minta atasan campur tangan
     │
     └─ Lindungi diri
         └─ Jika ada serangan verbal atau ancaman,
             segera laporkan

  💬 Respons Standar:
     "Maaf atas ketidaknyamanannya.
      Saya segera panggil supervisor kami
      untuk membantu Anda."

  📝 Penanganan Setelahnya:
     • Catat detail kejadian
     • Laporkan ke atasan
     • Jangan ambil hati, lanjutkan kerja profesional
```

---

## 🎯 Rahasia Menjadi Server Unggulan

### Sikap & Mindset

```
┌─────────────────────────────────────────┐
│ Ciri Server Unggulan                    │
├─────────────────────────────────────────┤
│                                         │
│  💪 Proaktif                           │
│     └─ Tidak tunggu instruksi, temukan │
│        kebutuhan sendiri               │
│                                         │
│  ⚡ Respons Cepat                      │
│     └─ Cepat tanggapi kebutuhan        │
│        pelanggan dan sistem            │
│                                         │
│  😊 Ramah & Bersahabat                 │
│     └─ Senyum tulus mengalahkan        │
│        ribuan kata                     │
│                                         │
│  🎯 Perhatian Detail                   │
│     └─ Perhatikan detail, antisipasi   │
│        kebutuhan pelanggan             │
│                                         │
│  🤝 Kerja Tim                          │
│     └─ Kolaborasi erat dengan dapur    │
│        dan kasir                       │
│                                         │
│  📚 Belajar Terus                      │
│     └─ Kenali menu baru, fitur baru    │
│                                         │
│  💎 Image Profesional                  │
│     └─ Penampilan rapi, perilaku sopan │
│                                         │
└─────────────────────────────────────────┘
```

### Jenjang Karir

```
Tangga Karir Server
   │
   ├─ Level 1: Server Pemula
   │   └─ Pelajari proses antar dasar
   │
   ├─ Level 2: Server Senior
   │   └─ Bisa tangani berbagai situasi mandiri
   │
   ├─ Level 3: Ketua Tim Layanan
   │   └─ Bimbing newcomer, koordinasi kerja
   │
   ├─ Level 4: Supervisor Lantai
   │   └─ Kelola seluruh tim layanan
   │
   └─ Level 5: Manager/Manajer Operasional
       └─ Manajemen operasional restoran keseluruhan
```

---

## 📞 Butuh Bantuan?

### Dukungan Internal

```
🆘 Urutan Minta Bantuan

  1️⃣ Server Senior (Bantuan rekan kerja)
     ↓
  2️⃣ Ketua Tim (Supervisor on-site)
     ↓
  3️⃣ Manager (Manajemen keseluruhan)
     ↓
  4️⃣ Dukungan Teknis (Masalah sistem)
```

### Informasi Kontak

- **Masalah Teknis Sistem**: support@makanmakan.com
- **Masalah Penggunaan App**: "Pusat Bantuan" di dalam sistem
- **Masalah Terkait Pekerjaan**: Hubungi atasan langsung

---

## 🌟 Penutup

Terima kasih telah memilih menjadi bagian dari tim MakanMakan!

Sebagai server, Anda adalah jembatan penting yang menghubungkan dapur dengan pelanggan. Setiap senyum Anda, setiap pengiriman tepat waktu, menciptakan pengalaman makan yang indah bagi pelanggan.

Ingat:
- ✨ **Sikap menentukan segalanya** - Pertahankan positif & antusias
- 🚀 **Efisiensi ciptakan nilai** - Cepat tapi tetap stabil
- 🤝 **Layanan dari hati** - Perlakukan setiap pelanggan dengan tulus
- 📈 **Terus tingkatkan diri** - Hari ini lebih baik dari kemarin

Semoga sukses dalam pekerjaan, menjadi server terbaik!

---

<div align="center">

**Panduan Operasional Server MakanMakan**

Buat setiap layanan menjadi pengalaman yang indah

**Versi 2.0** | **2025-10-26**

</div>
