# 👨‍🍳 Panduan Operasional Koki MakanMakan

> **Versi**: 2.0
> **Tanggal Pembaruan**: 2025-10-26
> **Untuk**: Staf Dapur, Koki, Chef de Cuisine

---

## 📚 Daftar Isi

1. [Panduan Cepat](#panduan-cepat)
2. [Gambaran Umum Sistem](#gambaran-umum-sistem)
3. [Antarmuka Sistem Tampilan Dapur](#antarmuka-sistem-tampilan-dapur)
4. [Login dan Operasi Dasar](#login-dan-operasi-dasar)
5. [Proses Penerimaan Pesanan](#proses-penerimaan-pesanan)
6. [Manajemen Status Pesanan](#manajemen-status-pesanan)
7. [Pengelolaan Multi-Pesanan](#pengelolaan-multi-pesanan)
8. [Manajemen Prioritas](#manajemen-prioritas)
9. [Penanganan Situasi Khusus](#penanganan-situasi-khusus)
10. [Kolaborasi Tim](#kolaborasi-tim)
11. [Tips Peningkatan Efisiensi](#tips-peningkatan-efisiensi)
12. [Pertanyaan Umum](#pertanyaan-umum)
13. [Pemecahan Masalah](#pemecahan-masalah)

---

## 🚀 Panduan Cepat

### Tanggung Jawab Utama Koki

```
┌─────────────────────────────────────────────┐
│ Alur Kerja Koki                             │
├─────────────────────────────────────────────┤
│                                             │
│  1️⃣ Terima Pesanan Baru                     │
│      ↓                                      │
│  2️⃣ Konfirmasi Isi Pesanan                  │
│      ↓                                      │
│  3️⃣ Perbarui ke "Sedang Disiapkan"          │
│      ↓                                      │
│  4️⃣ Mulai Memasak                           │
│      ↓                                      │
│  5️⃣ Perbarui ke "Selesai" setelah selesai   │
│      ↓                                      │
│  6️⃣ Beritahu pelayan untuk mengambil        │
│                                             │
└─────────────────────────────────────────────┘
```

### Daftar Periksa Penggunaan Pertama

✅ **Langkah Pertama: Konfirmasi Akun dan Perangkat**

- Pastikan sudah mendapatkan akun koki
- Uji coba login ke sistem tampilan dapur
- Pastikan layar tampilan berfungsi normal

✅ **Langkah Kedua: Kenali Antarmuka**

- Pahami tata letak kartu pesanan
- Latih operasi pembaruan status
- Uji notifikasi suara

✅ **Langkah Ketiga: Pahami Alur Kerja**

- Cara notifikasi pesanan baru
- Langkah-langkah pembaruan status
- Proses penyelesaian pesanan

✅ **Langkah Keempat: Persiapan Kerja**

- Pastikan peralatan dapur siap
- Periksa persiapan bahan makanan
- Mulai menerima pesanan

---

## 🏢 Gambaran Umum Sistem

### Posisi Sistem Tampilan Dapur

```
┌─────────────────────────────────────────────────────────┐
│ Ekosistem Dapur MakanMakan                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Pelanggan Pesan ───→ Sistem Pesanan ───→ Tampilan Dapur ───→ Konfirmasi Pelayan   │
│                          ↓                   ↓                   ↓                    │
│                    Monitoring Pemilik   【Anda di Sini】    Pelacakan Pelanggan      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Mode Kolaborasi Peran Dapur

```
        Sumber Pesanan
           │
    ┌──────┴──────┐
    ↓             ↓
  Pesanan Meja   Pesanan Toko
    │             │
    └──────┬──────┘
           ↓
    【Sistem Tampilan Dapur】
     (Stasiun Kerja Anda)
           │
    ┌──────┴──────┐
    ↓             ↓
  Pelayan       Aplikasi Pelanggan
  Konfirmasi    Pelacakan Real-time
  Pengiriman
```

**Penjelasan**:

- **Pelanggan**: Memesan melalui QR Code
- **Sistem Dapur**: Menerima dan menampilkan pesanan secara real-time
- **Koki (Anda)**: Memproses pesanan dan memperbarui status
- **Pelayan**: Mengambil makanan dan mengirim ke pelanggan
- **Pemilik**: Memantau keseluruhan operasional

---

## 🖥️ Antarmuka Sistem Tampilan Dapur

### Tata Letak Layar Utama

```
┌───────────────────────────────────────────────────────────┐
│  🏪 Nama Restoran        👨‍🍳 Koki: Chef Wang     🕐 14:35     │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  【Menunggu】        【Sedang Disiapkan】      【Selesai】          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ #001     │    │ #002     │    │ #003     │          │
│  │ Meja: 5  │    │ Meja: 3  │    │ Meja: 8  │          │
│  │ Waktu:   │    │ Waktu:   │    │ Waktu:   │          │
│  │ 14:30    │    │ 14:25    │    │ 14:20    │          │
│  │          │    │          │    │          │          │
│  │ Item:    │    │ Item:    │    │ Item:    │          │
│  │ • Steak  │    │ • Spageti│    │ • Salad  │          │
│  │ • Salad  │    │ • Soup   │    │ • Soup   │          │
│  │          │    │          │    │          │          │
│  │ [Mulai]  │    │ [Selesai]│    │ ✓ Selesai│          │
│  └──────────┘    └──────────┘    └──────────┘          │
│                                                           │
│  ┌──────────┐                                            │
│  │ #004     │                                            │
│  │ Meja: 12 │                                            │
│  │ Waktu:   │                                            │
│  │ 14:32 🔔 │    (Notifikasi Pesanan Baru)               │
│  │          │                                            │
│  │ Item:    │                                            │
│  │ • Nasi   │                                            │
│  │   Kari   │                                            │
│  │ • Minuman│                                            │
│  │          │                                            │
│  │ [Mulai]  │                                            │
│  └──────────┘                                            │
│                                                           │
├───────────────────────────────────────────────────────────┤
│  📊 Statistik Hari Ini: Selesai 23 | Sedang Diproses 5 | Menunggu 2  │
└───────────────────────────────────────────────────────────┘
```

### Penjelasan Detail Kartu Pesanan

```
┌─────────────────────────────┐
│ Struktur Kartu Pesanan      │
├─────────────────────────────┤
│                             │
│  🔢 Nomor Pesanan: #001     │
│  ├─ Identifikasi cepat     │
│  └─ Sinkron dengan pelanggan│
│                             │
│  🪑 Nomor Meja/Kursi: Meja 5│
│  ├─ Lokasi pengiriman jelas│
│  └─ Hindari salah kirim    │
│                             │
│  ⏰ Waktu Pesan: 14:30      │
│  ├─ Ketahui waktu tunggu   │
│  └─ Referensi prioritas    │
│                             │
│  📋 Item Pesanan:           │
│  ├─ Steak x1 (medium)      │
│  ├─ Caesar Salad x1        │
│  └─ Corn Soup x2           │
│                             │
│  💬 Catatan: Tanpa bawang   │
│  └─ Pengingat kebutuhan khusus│
│                             │
│  🎯 Tombol Status: [Mulai]  │
│  └─ Perbarui status sekali klik│
│                             │
└─────────────────────────────┘
```

### Sistem Penanda Warna

```
┌─────────────────────────────────────────┐
│ Sistem Petunjuk Visual                  │
├─────────────────────────────────────────┤
│                                         │
│  🟦 Biru = Pesanan Baru (Menunggu)      │
│  └─ Belum mulai disiapkan              │
│                                         │
│  🟨 Kuning = Sedang Disiapkan           │
│  └─ Sedang dalam proses memasak        │
│                                         │
│  🟩 Hijau = Selesai                     │
│  └─ Siap dihidangkan                   │
│                                         │
│  🟥 Merah = Menunggu lebih dari 15 menit│
│  └─ Perlu prioritas penanganan         │
│                                         │
│  🔔 Animasi Berkedip = Pesanan Baru     │
│  └─ Disertai notifikasi suara          │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔐 Login dan Operasi Dasar

### Alur Login

**Langkah 1: Buka Sistem Tampilan Dapur**

Buka: URL sistem di tablet atau monitor dapur

```
Contoh URL:
https://kitchen.makanmakan.com
atau
https://your-restaurant.makanmakan.com/kitchen
```

**Langkah 2: Masukkan Akun Koki**

```
┌─────────────────────────────┐
│  👨‍🍳 Login Sistem Dapur     │
├─────────────────────────────┤
│                             │
│  Akun: [chef001________]    │
│  Kata Sandi: [***********]  │
│                             │
│  ☐ Ingat Saya (Khusus Stasiun Kerja) │
│                             │
│  [    Login Sistem    ]     │
│                             │
└─────────────────────────────┘
```

**Langkah 3: Pilih Stasiun Kerja (Jika Berlaku)**

Beberapa restoran memiliki beberapa stasiun kerja dapur (misalnya: Area Dingin, Area Tumis, Area Panggang)

```
Pilih Stasiun Kerja Anda:
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Area     │  │ Area     │  │ Area     │
│ Dingin   │  │ Tumis    │  │ Panggang │
│          │  │          │  │          │
│ Tampilan:│  │ Tampilan:│  │ Tampilan:│
│ Salad,   │  │ Nasi     │  │ Steak,   │
│ Appetizer│  │ Goreng,  │  │ Panggang │
│          │  │ Mie      │  │          │
└──────────┘  └──────────┘  └──────────┘
```

### Item Pemeriksaan Setelah Login

✅ **Konfirmasi Status Sistem**

```
┌─────────────────────────────┐
│ Daftar Pemeriksaan Sistem   │
├─────────────────────────────┤
│ ✓ Koneksi jaringan normal   │
│ ✓ Fungsi update real-time OK│
│ ✓ Notifikasi suara aktif    │
│ ✓ Kecerahan layar sesuai    │
│ ✓ Menu hari ini telah dimuat│
└─────────────────────────────┘
```

### Penyesuaian Pengaturan Dasar

**Pengaturan Suara**

Klik ikon ⚙️ Pengaturan di pojok kanan atas:

```
🔊 Suara Notifikasi Pesanan Baru:
├─ 🔔 Nada Standar
├─ 📢 Pengingat Keras
├─ 🎵 Musik Lembut
└─ 🔇 Mode Senyap

Volume: ▓▓▓▓▓▓▓▓░░ (80%)
```

**Pengaturan Tampilan**

```
📺 Mode Tampilan:
├─ 📱 Mode Kompak (Layar Kecil)
├─ 🖥️  Mode Standar (Layar Sedang)
└─ 📺 Mode Dapur (Layar Besar)

Ukuran Font:
├─ Standar (Direkomendasikan)
├─ Besar (Untuk Presbyopia)
└─ Ekstra Besar (Penglihatan Jarak Jauh)
```

---

## 📥 Proses Penerimaan Pesanan

### Mekanisme Notifikasi Pesanan Baru

```
┌─────────────────────────────────────────┐
│ Cara Notifikasi Pesanan Baru            │
├─────────────────────────────────────────┤
│                                         │
│  Cara 1: 🔔 Notifikasi Suara            │
│  ├─ Suara "Ding-Dong" default          │
│  └─ Dapat disesuaikan                  │
│                                         │
│  Cara 2: 📱 Layar Berkedip              │
│  ├─ Kartu pesanan berkedip 3 kali      │
│  └─ Menarik perhatian                  │
│                                         │
│  Cara 3: 📊 Update Counter Menunggu     │
│  ├─ Tampilkan "Menunggu: +1"           │
│  └─ Angka berubah merah                │
│                                         │
│  Cara 4: 💬 Pop-up Pratinjau Cepat      │
│  ├─ Tampilkan ringkasan pesanan        │
│  └─ Otomatis tutup setelah 5 detik     │
│                                         │
└─────────────────────────────────────────┘
```

### Langkah Konfirmasi Pesanan Baru

**Langkah 1: Tinjau Cepat Isi Pesanan**

```
Pratinjau Pesanan Baru:
┌─────────────────────────┐
│ 🔔 Pesanan Baru #025    │
├─────────────────────────┤
│ Meja: Meja 7            │
│ Waktu: 15:45            │
│                         │
│ Item:                   │
│ • Nasi Goreng Seafood x1│
│ • Sup Asam Pedas x2     │
│ • Cumi Goreng Lada x1   │
│                         │
│ ⚠️ Catatan: Tanpa cabai │
│                         │
│ [Mengerti] [Mulai Masak]│
└─────────────────────────┘
```

**Langkah 2: Periksa Kebutuhan Khusus**

```
Item yang perlu diperhatikan:
┌─────────────────────────────┐
│ 🔍 Poin Pemeriksaan         │
├─────────────────────────────┤
│ ✓ Penanda Alergen           │
│   └─ Tanpa kacang, seafood  │
│                             │
│ ✓ Permintaan Kustom         │
│   └─ Medium, tanpa bawang   │
│                             │
│ ✓ Catatan Khusus            │
│   └─ Hangat, pisah wadah    │
│                             │
│ ✓ Konfirmasi Jumlah         │
│   └─ Beberapa item sama     │
└─────────────────────────────┘
```

**Langkah 3: Estimasi Waktu Pembuatan**

```
Estimasi Waktu Cepat:
┌─────────────────────────────┐
│ Item           Waktu Estimasi│
├─────────────────────────────┤
│ Nasi/Mie Goreng 8-10 menit  │
│ Sup             5-7 menit   │
│ Salad           3-5 menit   │
│ Steak           12-15 menit │
│ Panggang        15-20 menit │
│ Gorengan        8-12 menit  │
└─────────────────────────────┘

Total Waktu Estimasi: 15 menit
Saran Penyajian: 16:00
```

---

## 📊 Manajemen Status Pesanan

### Siklus Hidup Pesanan

```
┌─────────────────────────────────────────────────────────┐
│ Alur Lengkap Pesanan                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🆕 Pesanan Baru                                        │
│   ↓                                                     │
│   ├─ Status: pending (menunggu)                        │
│   ├─ Warna: 🟦 Biru                                    │
│   └─ Operasi: Klik "Mulai Masak"                       │
│                                                         │
│   ↓                                                     │
│  🍳 Sedang Disiapkan                                    │
│   ↓                                                     │
│   ├─ Status: preparing (sedang disiapkan)              │
│   ├─ Warna: 🟨 Kuning                                  │
│   ├─ Operasi: Sedang memasak                           │
│   └─ Timer: Tampilkan waktu yang telah berlalu         │
│                                                         │
│   ↓                                                     │
│  ✅ Selesai                                             │
│   ↓                                                     │
│   ├─ Status: ready (selesai)                           │
│   ├─ Warna: 🟩 Hijau                                   │
│   ├─ Operasi: Menunggu pelayan mengambil               │
│   └─ Notifikasi: Pelayan telah diberitahu              │
│                                                         │
│   ↓                                                     │
│  🚶 Dikirim                                             │
│   ↓                                                     │
│   ├─ Status: delivered (dikirim)                       │
│   ├─ Operasi: Konfirmasi pelayan                       │
│   └─ Hasil: Dihapus dari tampilan dapur                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Operasi Pembaruan Status

**Perbarui ke "Sedang Disiapkan"**

Ketika Anda siap mulai memasak:

```
┌─────────────────────────┐
│ #025 - Meja 7           │
├─────────────────────────┤
│ • Nasi Goreng Seafood x1│
│ • Sup Asam Pedas x2     │
│                         │
│ [✋ Mulai Masak]         │  ← Klik tombol ini
└─────────────────────────┘

Setelah klik ↓

┌─────────────────────────┐
│ #025 - Meja 7  ⏱️ 3:25   │
├─────────────────────────┤
│ • Nasi Goreng Seafood x1│
│ • Sup Asam Pedas x2     │
│                         │
│ [✓ Selesai Masak]       │  ← Status telah diperbarui
└─────────────────────────┘
```

**Perbarui ke "Selesai"**

Ketika makanan telah selesai dimasak:

```
Sedang Disiapkan → Selesai

Langkah Operasi:
1. Pastikan semua item telah selesai
2. Periksa kualitas dan penampilan
3. Klik tombol "Selesai Masak"
4. Kartu berpindah ke kolom "Selesai"
5. Sistem otomatis memberitahu pelayan
```

### Fungsi Operasi Massal

**Proses Beberapa Pesanan Sekaligus**

Ketika beberapa pesanan dapat dibuat bersamaan:

```
Mode Pilihan Massal:

☐ #023 - Nasi Goreng x2
☑ #024 - Nasi Goreng x1, Mie Goreng x1
☑ #025 - Nasi Goreng x3

[Pilih Semua Sejenis] [Mulai Masak (2)]
                       ↑
                   2 pesanan dipilih

Keuntungan:
✓ Hemat waktu pembuatan
✓ Tingkatkan efisiensi dapur
✓ Penyajian simultan lebih cepat
```

---

## 🔄 Pengelolaan Multi-Pesanan

### Strategi Penanganan Simultan

```
┌─────────────────────────────────────────┐
│ Strategi Pemrosesan Pesanan Cerdas      │
├─────────────────────────────────────────┤
│                                         │
│  Strategi 1: Kelompokkan Berdasarkan Jenis│
│  ─────────────────────────              │
│  Nasi Goreng → Masak bersama            │
│  Sup → Masak bersamaan                  │
│  Panggang → Panggang bersamaan          │
│                                         │
│  Strategi 2: Urutkan Berdasarkan Waktu  │
│  ─────────────────────────              │
│  Waktu Lama → Prioritas mulai           │
│  (Steak)       (15 menit)               │
│            ↓                            │
│  Waktu Sedang → Proses berikutnya       │
│  (Nasi Goreng) (10 menit)               │
│            ↓                            │
│  Waktu Singkat → Buat terakhir          │
│  (Salad)       (5 menit)                │
│                                         │
│  Strategi 3: Integrasikan Berdasarkan Meja│
│  ─────────────────────────              │
│  Pesanan Satu Meja → Sajikan bersama    │
│  └─ Hindari pelanggan menunggu bertahap │
│                                         │
└─────────────────────────────────────────┘
```

### Manajemen Jam Sibuk

```
Alur Penanganan Jam Sibuk:

┌─────────────────────────────────┐
│ 12:00-13:00 Makan Siang Sibuk   │
│ 18:00-20:00 Makan Malam Sibuk   │
├─────────────────────────────────┤
│                                 │
│  Tahap 1: Persiapan Bahan (30 menit sebelumnya)│
│  ├─ Bahan umum siap            │
│  ├─ Bumbu disiapkan            │
│  └─ Peralatan dipanaskan       │
│                                 │
│  Tahap 2: Terima Pesanan Cepat (Saat Sibuk)│
│  ├─ Prioritas pesanan lama     │
│  ├─ Buat jenis sama bersama    │
│  └─ Jaga ritme lancar          │
│                                 │
│  Tahap 3: Penyelesaian (Setelah Sibuk)│
│  ├─ Selesaikan pesanan tersisa │
│  ├─ Bersihkan meja kerja       │
│  └─ Tambah bahan               │
│                                 │
└─────────────────────────────────┘
```

### Tips Peningkatan Efisiensi

```
┌─────────────────────────────────────┐
│ Aturan Emas Efisiensi Dapur         │
├─────────────────────────────────────┤
│                                     │
│  1️⃣ Proses Berdasarkan Kategori     │
│  └─ Buat makanan sejenis bersamaan │
│                                     │
│  2️⃣ Memasak Paralel                 │
│  └─ Gunakan beberapa kompor        │
│                                     │
│  3️⃣ Persiapan Awal                  │
│  └─ Siapkan bahan umum lebih dulu  │
│                                     │
│  4️⃣ Waktu Tumpang Tindih            │
│  └─ Manfaatkan waktu tunggu        │
│                                     │
│  5️⃣ Komunikasi Jelas                │
│  └─ Pembagian tugas yang jelas     │
│                                     │
└─────────────────────────────────────┘
```

**Contoh: Proses 3 Pesanan Sekaligus**

```
Timeline: 15:00 → 15:15

15:00 → Mulai Steak (#020) - Perlu 15 menit
15:05 → Mulai Nasi Goreng (#021) - Perlu 10 menit
        ├─ Steak terus dimasak
15:10 → Mulai Salad (#022) - Perlu 5 menit
        ├─ Steak hampir selesai
        └─ Nasi Goreng terus dimasak
15:15 → Ketiga makanan selesai bersamaan ✓

Efisiensi: 15 menit menyelesaikan 3 makanan
          (Terpisah perlu 30 menit)
```

---

## ⚡ Manajemen Prioritas

### Sistem Prioritas Pesanan

```
┌─────────────────────────────────────────┐
│ Standar Penentuan Prioritas             │
├─────────────────────────────────────────┤
│                                         │
│  🔴 Prioritas Tertinggi (Peringatan Merah)│
│  ├─ Menunggu lebih dari 15 menit       │
│  ├─ Pelanggan menanyakan pesanan       │
│  └─ Pesanan bawa pulang mendekati waktu│
│                                         │
│  🟠 Prioritas Tinggi (Pengingat Oranye) │
│  ├─ Menunggu 10-15 menit               │
│  ├─ Pesanan pelanggan VIP              │
│  └─ Pesanan meja besar                 │
│                                         │
│  🟡 Prioritas Sedang (Standar Kuning)   │
│  ├─ Menunggu 5-10 menit                │
│  └─ Pesanan umum                       │
│                                         │
│  🟢 Prioritas Rendah (Hijau)            │
│  ├─ Baru dipesan (<5 menit)            │
│  └─ Dapat diproses nanti               │
│                                         │
└─────────────────────────────────────────┘
```

### Petunjuk Visual Prioritas

```
Penandaan otomatis sistem:

┌─────────────────────────┐
│ #018 - Meja 3  🔴 18:32 │  ← Merah berkedip (overtime)
├─────────────────────────┤
│ ⚠️ Menunggu 18 menit!   │
│                         │
│ • Steak x2              │
│ • Salad x2              │
│                         │
│ [🚨 Proses Sekarang]    │
└─────────────────────────┘

┌─────────────────────────┐
│ #019 - Meja 5  🟠 12:25 │  ← Petunjuk oranye (hampir overtime)
├─────────────────────────┤
│ Menunggu 12 menit       │
│                         │
│ • Spageti x1            │
│ • Sup x2                │
│                         │
│ [Mulai Masak]           │
└─────────────────────────┘

┌─────────────────────────┐
│ #020 - Meja 8  🟢 3:45  │  ← Hijau standar (normal)
├─────────────────────────┤
│ • Nasi Goreng x1        │
│ • Minuman x1            │
│                         │
│ [Mulai Masak]           │
└─────────────────────────┘
```

### Strategi Penyesuaian Dinamis

```
Alur Penilaian Situasi:

Ketika pesanan baru masuk:
┌─────────────────────────────────┐
│                                 │
│  Pesanan Baru → Evaluasi Urgensi│
│           ↓                     │
│  Periksa ──→ Ada pesanan overtime?│
│           ↓ Ya     ↓ Tidak      │
│  Prioritas overtime  Antre normal│
│           ↓                     │
│  Pertimbangkan batch processing │
│                                 │
└─────────────────────────────────┘
```

---

## 🚨 Penanganan Situasi Khusus

### Penanganan Kekurangan Bahan

```
┌─────────────────────────────────────────┐
│ Alur Penanganan Kekurangan Bahan        │
├─────────────────────────────────────────┤
│                                         │
│  Temukan Kekurangan ──→ Tindakan Segera │
│                                         │
│  Langkah 1: Klik "Laporkan Masalah"     │
│           ↓                             │
│  Langkah 2: Pilih "Kekurangan Bahan"    │
│           ↓                             │
│  Langkah 3: Isi item yang kurang        │
│           ↓                             │
│  Langkah 4: Sistem memberitahu pemilik/kasir│
│           ↓                             │
│  Langkah 5: Tunggu instruksi            │
│           ├─ Alternatif?                │
│           ├─ Batalkan item?             │
│           └─ Tunggu restok?             │
│                                         │
└─────────────────────────────────────────┘
```

**Contoh Operasi**:

```
┌─────────────────────────┐
│ #023 - Meja 5           │
├─────────────────────────┤
│ • Steak x1 ❌ (Habis)   │
│ • Salad x1 ✓            │
│                         │
│ [⚠️ Laporkan Masalah]   │
└─────────────────────────┘

Setelah klik ↓

┌─────────────────────────┐
│ Laporan Masalah         │
├─────────────────────────┤
│ ⚪ Kekurangan Bahan      │
│ ⚪ Kerusakan Alat        │
│ ⚪ Kesalahan Pesanan     │
│ ⚪ Masalah Lain          │
│                         │
│ Item Habis: [Steak___]  │
│                         │
│ [Kirim Laporan]         │
└─────────────────────────┘
```

### Penanganan Kerusakan Peralatan

```
Masalah peralatan umum:

┌─────────────────────────────────┐
│ Jenis Masalah    Cara Penanganan│
├─────────────────────────────────┤
│ Kompor Rusak → Gunakan kompor lain│
│               └─ Beritahu pemilik │
│                                 │
│ Oven Rusak → Laporkan tidak bisa│
│             └─ Sarankan alternatif│
│                                 │
│ Kulkas Abnormal → Periksa suhu  │
│                 └─ Hentikan jika perlu│
│                                 │
│ Exhaust Fan → Tunda penggorengan│
│              └─ Perbaiki segera │
└─────────────────────────────────┘
```

### Penanganan Kesalahan Pesanan

```
┌─────────────────────────────────────────┐
│ Jenis dan Penanganan Masalah Pesanan    │
├─────────────────────────────────────────┤
│                                         │
│  Situasi 1: Pelanggan Salah Pesan       │
│  ──────────────────                     │
│  Jika belum mulai masak:                │
│  ├─ Klik "Modifikasi Pesanan"          │
│  ├─ Tunggu konfirmasi pelanggan/kasir  │
│  └─ Buat sesuai isi baru               │
│                                         │
│  Jika sudah mulai masak:                │
│  ├─ Selesaikan pembuatan saat ini      │
│  └─ Biaya ditentukan pemilik           │
│                                         │
│  Situasi 2: Kesalahan Tampilan Sistem   │
│  ──────────────────                     │
│  ├─ Screenshot bukti                   │
│  ├─ Hubungi pemilik konfirmasi         │
│  └─ Buat sesuai situasi aktual         │
│                                         │
│  Situasi 3: Pesanan Duplikat            │
│  ──────────────────                     │
│  ├─ Konfirmasi nomor pesanan           │
│  ├─ Periksa nomor meja/waktu           │
│  └─ Beritahu kasir untuk konfirmasi    │
│                                         │
└─────────────────────────────────────────┘
```

### Bantuan Penanganan Keluhan

```
Ketika menerima keluhan pelanggan:

┌─────────────────────────────────┐
│ Jenis Keluhan    Respons Dapur  │
├─────────────────────────────────┤
│ Terlalu Asin   → Buat ulang     │
│               └─ Perhatikan bumbu│
│                                 │
│ Porsi Kurang   → Tambah porsi   │
│               └─ Periksa standar│
│                                 │
│ Suhu Salah     → Panaskan/dinginkan│
│               └─ Konfirmasi suhu │
│                                 │
│ Tampilan Buruk → Plating ulang  │
│               └─ Perhatikan standar│
│                                 │
│ Ada Benda Asing → Hentikan bahan│
│                └─ Laporkan pemilik│
└─────────────────────────────────┘
```

---

## 👥 Kolaborasi Tim

### Kolaborasi dengan Pelayan

```
┌─────────────────────────────────────────┐
│ Dapur ←→ Pelayan Alur Komunikasi        │
├─────────────────────────────────────────┤
│                                         │
│  Dapur Selesai ──→ Tandai "Selesai"    │
│      ↓                                  │
│  Notifikasi Sistem ──→ Pelayan melihat │
│      ↓                                  │
│  Pelayan Konfirmasi ──→ Ambil makanan  │
│      ↓                                  │
│  Cek Pesanan ──→ Konfirmasi item & meja│
│      ↓                                  │
│  Kirim Pelanggan ──→ Tandai "Dikirim"  │
│      ↓                                  │
│  Pesanan Selesai ──→ Hapus dari sistem │
│                                         │
└─────────────────────────────────────────┘
```

**Contoh Komunikasi Penyajian**:

```
Skenario: Makanan selesai, menunggu pelayan

Tampilan Dapur:
┌─────────────────────────┐
│ #025 - Meja 7  ✅ Selesai│
├─────────────────────────┤
│ • Nasi Goreng Seafood x1│
│ • Sup Asam Pedas x2     │
│                         │
│ ✓ Menunggu pengambilan  │
│                         │
│ Notifikasi terkirim: Amin 📱│
└─────────────────────────┘

Tablet Pelayan:
┌─────────────────────────┐
│ 🔔 Notifikasi Penyajian │
├─────────────────────────┤
│ #025 - Meja 7           │
│ Koki: Chef Wang         │
│                         │
│ [Ambil] [Nanti]         │
└─────────────────────────┘
```

### Kolaborasi dengan Pemilik/Kasir

```
Situasi yang perlu campur tangan pemilik:

┌─────────────────────────────────┐
│ Skenario          Cara Notifikasi│
├─────────────────────────────────┤
│ Kekurangan Bahan → Notifikasi otomatis│
│                  └─ Perlu keputusan│
│                                 │
│ Kerusakan Alat   → Notifikasi darurat│
│                  └─ Perlu perbaikan│
│                                 │
│ Anomali Pesanan  → Tandai masalah│
│                  └─ Perlu konfirmasi│
│                                 │
│ Penanganan Keluhan → Komunikasi real-time│
│                    └─ Perlu instruksi│
│                                 │
│ Saran Stok       → Laporan harian│
│                  └─ Referensi restok│
└─────────────────────────────────┘
```

### Mode Kolaborasi Multi-Koki

```
Ketika dapur memiliki beberapa koki:

┌─────────────────────────────────────────┐
│ Mode Kolaborasi Pembagian Tugas         │
├─────────────────────────────────────────┤
│                                         │
│  Mode 1: Pembagian Stasiun Kerja        │
│  ─────────────────                      │
│  Koki A → Bertanggung jawab tumisan    │
│  Koki B → Bertanggung jawab panggang   │
│  Koki C → Bertanggung jawab sup/dingin │
│                                         │
│  Sistem otomatis distribusi pesanan    │
│                                         │
│  Mode 2: Terima Semua Pesanan           │
│  ─────────────────                      │
│  Semua koki lihat pesanan sama         │
│  Siapa cepat dia dapat                 │
│                                         │
│  ⚠️ Hindari duplikasi:                  │
│  └─ Setelah klik "Mulai" koki lain tidak lihat│
│                                         │
│  Mode 3: Koordinasi Head Chef           │
│  ─────────────────                      │
│  Head chef distribusi pesanan          │
│  Asisten bantu persiapan               │
│                                         │
└─────────────────────────────────────────┘
```

---

## 💡 Tips Peningkatan Efisiensi

### Tips Manajemen Waktu

```
┌─────────────────────────────────────────┐
│ Aturan Emas Manajemen Waktu Dapur       │
├─────────────────────────────────────────┤
│                                         │
│  Aturan 1: Maksimalkan Waktu Persiapan  │
│  ─────────────────────                  │
│  • Persiapan penuh saat sepi           │
│  • Tambah bahan umum terus             │
│  • Bumbu siapkan lebih dulu            │
│                                         │
│  Aturan 2: Manfaatkan Waktu Tunggu      │
│  ─────────────────────                  │
│  • Steak dipanggang → Siapkan salad    │
│  • Sup direbus → Potong bahan          │
│  • Nasi dikukus → Proses bahan lain    │
│                                         │
│  Aturan 3: Optimasi Urutan Memasak      │
│  ─────────────────────                  │
│  • Makanan waktu lama mulai dulu       │
│  • Makanan waktu singkat buat nanti    │
│  • Pastikan satu meja selesai bersamaan│
│                                         │
│  Aturan 4: Efisiensi Batch Processing   │
│  ─────────────────────                  │
│  • 3 porsi nasi goreng masak bersama   │
│  • 5 mangkuk sup masak bersamaan       │
│  • Hemat waktu gerakan berulang        │
│                                         │
└─────────────────────────────────────────┘
```

### Optimasi Alur Dapur

```
Alur kerja dapur yang ideal:

┌─────────────────────────────────┐
│                                 │
│  Area Prep ──→ Area Masak ──→ Area Sajian│
│    ↑                        │   │
│    └────────────────────────┘   │
│         Area Bersih/Recycle     │
│                                 │
└─────────────────────────────────┘

Prinsip optimasi alur:
✓ Kurangi bolak-balik
✓ Alat mudah dijangkau
✓ Bahan dikategorikan
✓ Tempat sampah tepat
✓ Alat bersih siap sedia
```

### Manfaatkan Fitur Sistem dengan Baik

```
┌─────────────────────────────────────────┐
│ Fitur Tersembunyi yang Berguna          │
├─────────────────────────────────────────┤
│                                         │
│  Fitur 1: Pencarian Pesanan             │
│  ─────────────────                      │
│  Shortcut: Ctrl + F                     │
│  Fungsi: Cari cepat nomor meja/makanan │
│                                         │
│  Fitur 2: Filter Pesanan                │
│  ─────────────────                      │
│  ☑ Tampilkan hanya nasi goreng         │
│  ☑ Tampilkan hanya sup                 │
│  → Batch processing lebih mudah         │
│                                         │
│  Fitur 3: Riwayat                       │
│  ─────────────────                      │
│  Lihat pesanan selesai hari ini        │
│  Konfirmasi ada duplikasi atau tidak   │
│                                         │
│  Fitur 4: Data Statistik                │
│  ─────────────────                      │
│  Hari ini selesai: 45 pesanan          │
│  Rata-rata waktu: 12 menit             │
│  Terpopuler: Nasi Goreng Seafood       │
│                                         │
│  Fitur 5: Catatan Cepat                 │
│  ─────────────────                      │
│  Tambah catatan saat selesai           │
│  "Sudah pedas" "Tanpa ketumbar-OK"     │
│                                         │
└─────────────────────────────────────────┘
```

### Panduan Bertahan di Jam Sibuk

```
Strategi jam sibuk:

┌─────────────────────────────────┐
│ Jam Sibuk Makan Siang/Malam     │
├─────────────────────────────────┤
│                                 │
│  30 menit sebelumnya:           │
│  ├─ Perkuat persiapan           │
│  ├─ Panaskan peralatan          │
│  ├─ Konfirmasi stok             │
│  └─ Atur mental                 │
│                                 │
│  Saat sibuk:                    │
│  ├─ Fokus pesanan saat ini      │
│  ├─ Hindari panik               │
│  ├─ Jaga ritme                  │
│  └─ Komunikasi tim              │
│                                 │
│  Setelah sibuk:                 │
│  ├─ Selesaikan pesanan tersisa  │
│  ├─ Bersihkan lingkungan        │
│  ├─ Tambah persiapan            │
│  └─ Istirahat sebentar          │
│                                 │
└─────────────────────────────────┘

Persiapan mental:
✓ Tetap tenang
✓ Satu per satu
✓ Kualitas tidak boleh dikorbankan
✓ Percaya tim
```

---

## ❓ Pertanyaan Umum

### Terkait Operasi Sistem

**Q1: Bagaimana jika pesanan tidak ada notifikasi suara?**

```
A: Langkah pemeriksaan
┌─────────────────────────────┐
│ 1. Periksa volume perangkat │
│    └─ Volume tablet/PC aktif?│
│                             │
│ 2. Periksa pengaturan sistem│
│    └─ Pengaturan → Suara → ON│
│                             │
│ 3. Tes suara                │
│    └─ Klik "Tes Suara"      │
│                             │
│ 4. Reload halaman           │
│    └─ F5 atau refresh       │
│                             │
│ 5. Hapus cache browser      │
│    └─ Pengaturan → Hapus cache│
└─────────────────────────────┘
```

**Q2: Mengapa beberapa pesanan tidak terlihat?**

```
A: Kemungkinan penyebab
┌─────────────────────────────┐
│ Alasan 1: Filter aktif      │
│ └─ Solusi: Klik "Tampilkan Semua"│
│                             │
│ Alasan 2: Sudah diambil koki lain│
│ └─ Solusi: Situasi normal   │
│                             │
│ Alasan 3: Pesanan dibatalkan│
│ └─ Solusi: Periksa catatan  │
│                             │
│ Alasan 4: Batasan stasiun kerja│
│ └─ Solusi: Hubungi pemilik  │
└─────────────────────────────┘
```

**Q3: Bagaimana jika salah klik tombol?**

```
A: Fungsi rollback status
┌─────────────────────────────┐
│ Dalam 30 detik setelah salah klik:│
│                             │
│ 1. Klik kartu pesanan       │
│ 2. Klik "⋯" opsi lainnya    │
│ 3. Pilih "Rollback Status"  │
│ 4. Konfirmasi rollback      │
│                             │
│ Lebih dari 30 detik:        │
│ └─ Hubungi kasir/pemilik    │
└─────────────────────────────┘
```

### Terkait Pemrosesan Pesanan

**Q4: Bagaimana jika isi pesanan tidak jelas?**

```
A: Fungsi tampilan diperbesar
┌─────────────────────────────┐
│ Cara 1: Klik kartu pesanan  │
│ └─ Muncul jendela detail    │
│                             │
│ Cara 2: Sesuaikan ukuran font│
│ └─ Pengaturan → Tampilan → Besar│
│                             │
│ Cara 3: Pembacaan suara (baru)│
│ └─ Sistem baca isi pesanan  │
└─────────────────────────────┘
```

**Q5: Beberapa pesanan butuh makanan sama, bagaimana batch?**

```
A: Fungsi pembuatan batch
┌─────────────────────────────┐
│ Langkah:                    │
│ 1. Buka "Mode Batch"        │
│ 2. Centang pesanan yang akan digabung│
│ 3. Klik "Mulai Masak (3)"   │
│ 4. Setelah selesai tandai satu per satu│
│                             │
│ Contoh:                     │
│ #020 Nasi Goreng x2 ☑       │
│ #021 Nasi Goreng x1 ☑       │
│ #023 Nasi Goreng x3 ☑       │
│ ────────────────            │
│ Total: 6 nasi goreng bersama│
└─────────────────────────────┘
```

**Q6: Bagaimana jika pesanan terlalu banyak tidak sempat?**

```
A: Strategi penanganan overload
┌─────────────────────────────┐
│ 1. Aktifkan mode darurat    │
│    └─ Sistem otomatis beritahu pemilik│
│                             │
│ 2. Prioritas pesanan overtime│
│    └─ Merah dulu            │
│                             │
│ 3. Minta dukungan           │
│    └─ Koki lain bantu       │
│                             │
│ 4. Sementara hentikan pesanan│
│    └─ Pemilik tutup online  │
│                             │
│ 5. Komunikasi jujur         │
│    └─ Beritahu waktu tunggu aktual│
└─────────────────────────────┘
```

### Terkait Situasi Abnormal

**Q7: Bagaimana jika internet putus?**

```
A: Penanganan mode offline
┌─────────────────────────────┐
│ Pesanan yang sudah diunduh: │
│ ✓ Dapat terus dilihat       │
│ ✓ Dapat terus diproses      │
│ ✗ Tidak bisa update status  │
│                             │
│ Saran:                      │
│ 1. Catat di kertas pesanan selesai│
│ 2. Sinkronisasi manual setelah online│
│ 3. Hubungi pemilik jelaskan │
│                             │
│ Backup darurat:             │
│ └─ Ganti ke mode manual     │
└─────────────────────────────┘
```

**Q8: Tablet/komputer hang?**

```
A: Penanganan kerusakan perangkat
┌─────────────────────────────┐
│ Tindakan segera:            │
│ 1. Gunakan perangkat backup │
│    └─ HP juga bisa          │
│                             │
│ 2. Hubungi pemilik/IT       │
│    └─ Perlu dukungan teknis │
│                             │
│ 3. Cara penanganan sementara│
│    └─ Konfirmasi pesanan lisan│
│                             │
│ Pencegahan:                 │
│ • Restart perangkat berkala │
│ • Update software           │
│ • Perangkat backup siaga    │
└─────────────────────────────┘
```

---

## 🔧 Pemecahan Masalah

### Masalah Teknis Umum

```
┌─────────────────────────────────────────┐
│ Tabel Referensi Pemecahan Masalah       │
├─────────────────────────────────────────┤
│                                         │
│  Masalah: Layar kosong                  │
│  ─────────                              │
│  ✓ Refresh halaman (F5)                 │
│  ✓ Hapus cache dan login ulang          │
│  ✓ Periksa koneksi jaringan             │
│                                         │
│  Masalah: Pesanan tidak update          │
│  ─────────                              │
│  ✓ Konfirmasi status jaringan           │
│  ✓ Lihat indikator koneksi kanan atas  │
│  ✓ Login ulang sistem                   │
│                                         │
│  Masalah: Tombol tidak merespons        │
│  ─────────                              │
│  ✓ Tunggu 3 detik klik lagi             │
│  ✓ Reload halaman                       │
│  ✓ Gunakan browser berbeda              │
│                                         │
│  Masalah: Tampilan kacau                │
│  ─────────                              │
│  ✓ Sesuaikan resolusi layar             │
│  ✓ Zoom in/out (Ctrl +/-)               │
│  ✓ Buka ulang browser                   │
│                                         │
└─────────────────────────────────────────┘
```

### Cara Kontak Darurat

```
┌─────────────────────────────┐
│ Ketika perlu bantuan:       │
├─────────────────────────────┤
│                             │
│ Lini Pertama: Pemilik/Manager│
│ └─ Penanganan on-site       │
│                             │
│ Lini Kedua: Dukungan Teknis │
│ ├─ Telepon: 0800-xxx-xxx    │
│ ├─ Email: support@xxx.com   │
│ └─ LINE: @makanmakan        │
│                             │
│ Darurat: Admin Sistem       │
│ └─ Telepon on-call 24 jam   │
│                             │
└─────────────────────────────┘
```

### Jadwal Pemeliharaan Sistem

```
Waktu pemeliharaan berkala:

┌─────────────────────────────┐
│ Setiap Rabu 2:00 - 4:00 pagi│
│ (Jam sepi)                  │
├─────────────────────────────┤
│                             │
│ Isi pemeliharaan:           │
│ • Update sistem             │
│ • Optimasi database         │
│ • Peningkatan performa      │
│                             │
│ Dampak:                     │
│ • Mungkin tidak bisa login  │
│ • Pesanan berjalan tidak terpengaruh│
│                             │
│ Notifikasi:                 │
│ • Hari sebelumnya ada pengingat│
│ • 1 jam sebelum pengingat lagi│
└─────────────────────────────┘
```

---

## 📊 Pelacakan Kinerja

### Data Statistik Pribadi

Sistem otomatis mencatat performa kerja Anda:

```
┌─────────────────────────────────────────┐
│ Dashboard Kinerja Koki                  │
├─────────────────────────────────────────┤
│                                         │
│  Statistik Hari Ini: (2025-10-26)       │
│  ├─ Pesanan Selesai: 45                │
│  ├─ Rata-rata Waktu: 11 menit          │
│  ├─ Ketepatan Waktu: 96%               │
│  └─ Keluhan: 0                         │
│                                         │
│  Statistik Minggu Ini:                  │
│  ├─ Total Pesanan: 276                 │
│  ├─ Rekor Tercepat: 3 menit (Salad)    │
│  ├─ Terpopuler: Nasi Goreng (52 porsi) │
│  └─ Review Positif: 98%                │
│                                         │
│  Peringkat Pribadi:                     │
│  ├─ Peringkat Kecepatan: 2/5           │
│  ├─ Skor Kualitas: 4.8/5.0             │
│  └─ Kontribusi Tim: 35%                │
│                                         │
└─────────────────────────────────────────┘
```

### Peningkatan Berkelanjutan

```
Arah peningkatan kinerja:

┌─────────────────────────────┐
│ 1. Optimasi Kecepatan       │
│    ├─ Kenali menu           │
│    ├─ Persiapan cukup       │
│    └─ Gerakan lancar        │
│                             │
│ 2. Kontrol Kualitas         │
│    ├─ Proses standar        │
│    ├─ Konfirmasi sebelum sajian│
│    └─ Terus belajar         │
│                             │
│ 3. Komunikasi Kolaborasi    │
│    ├─ Lapor proaktif        │
│    ├─ Kerja sama tim        │
│    └─ Berbagi pengalaman    │
│                             │
│ 4. Penggunaan Sistem        │
│    ├─ Manfaatkan fitur      │
│    ├─ Operasi cepat         │
│    └─ Analisis data         │
└─────────────────────────────┘
```

---

## 🎯 Kode Etik Koki

### Standar Kualitas

```
┌─────────────────────────────────────────┐
│ Daftar Periksa Kualitas Penyajian       │
├─────────────────────────────────────────┤
│                                         │
│  ✓ Konfirmasi Suhu                      │
│    ├─ Makanan panas cukup panas (>65°C)│
│    └─ Makanan dingin cukup dingin (<5°C)│
│                                         │
│  ✓ Konfirmasi Porsi                     │
│    ├─ Sesuai berat standar             │
│    └─ Proporsi lauk tepat              │
│                                         │
│  ✓ Pemeriksaan Penampilan               │
│    ├─ Plating rapi                     │
│    ├─ Warna cerah                      │
│    └─ Tidak ada noda                   │
│                                         │
│  ✓ Konfirmasi Kelengkapan               │
│    ├─ Semua item lengkap               │
│    ├─ Bumbu/aksesoris lengkap          │
│    └─ Alat makan benar                 │
│                                         │
└─────────────────────────────────────────┘
```

### Kebersihan dan Keamanan

```
┌─────────────────────────────┐
│ Poin Keamanan Makanan       │
├─────────────────────────────┤
│ Kebersihan Pribadi:         │
│ ✓ Cuci tangan sebelum kerja │
│ ✓ Pakai seragam dan topi    │
│ ✓ Kuku pendek               │
│ ✓ Tidak pakai perhiasan     │
│                             │
│ Kebersihan Lingkungan:      │
│ ✓ Meja kerja bersih         │
│ ✓ Bahan dikategorikan       │
│ ✓ Pisahkan mentah/matang    │
│ ✓ Buang sampah tepat waktu  │
│                             │
│ Penanganan Bahan:           │
│ ✓ Periksa tanggal kadaluarsa│
│ ✓ Simpan di suhu tepat      │
│ ✓ Hindari kontaminasi silang│
│ ✓ Masak dengan matang       │
└─────────────────────────────┘
```

---

## 📱 Operasi Cepat Sistem

### Shortcut Keyboard

```
┌─────────────────────────────────────────┐
│ Shortcut untuk Tingkatkan Efisiensi     │
├─────────────────────────────────────────┤
│                                         │
│ F5             Refresh halaman          │
│ Ctrl + F       Cari pesanan             │
│ Ctrl + P       Print pesanan (jika perlu)│
│ Spacebar       Mulai/Selesai (saat pilih)│
│ Esc            Tutup popup              │
│ ↑ ↓ ← →        Navigasi antar pesanan   │
│ Tab            Pindah field input       │
│                                         │
└─────────────────────────────────────────┘
```

### Operasi Gesture (Layar Sentuh)

```
┌─────────────────────────────┐
│ Gesture Sentuh              │
├─────────────────────────────┤
│ Tap sekali     Pilih pesanan│
│ Tap dua kali   Mulai cepat  │
│ Tahan          Opsi lainnya │
│ Geser kiri     Tandai selesai│
│ Geser kanan    Rollback/Batal│
│ Pinch          Zoom tampilan│
└─────────────────────────────┘
```

---

## 🌟 Penutup

Terima kasih telah menggunakan Sistem Tampilan Dapur MakanMakan!

```
┌─────────────────────────────────────────┐
│                                         │
│  Anda adalah inti restoran              │
│  Setiap masakan membawa harapan pelanggan│
│  Sistem adalah asisten Anda             │
│  Mari ciptakan pengalaman makan yang indah│
│                                         │
│            👨‍🍳 Semangat!                 │
│                                         │
└─────────────────────────────────────────┘
```

### Ingat Prinsip Ini

✅ **Kualitas Pertama** - Jangan pernah kompromi
✅ **Efisiensi Utama** - Tapi jangan korbankan kualitas
✅ **Kerja Sama Tim** - Komunikasi adalah kunci
✅ **Terus Belajar** - Sempurnakan diri
✅ **Jaga Semangat** - Cintai memasak

---

## 📞 Perlu Bantuan?

**Dukungan Teknis**: support@makanmakan.com
**Hotline Layanan**: 0800-123-456
**Dokumentasi Online**: docs.makanmakan.com
**Dukungan Komunitas**: Facebook / LINE Official Account

---

<div align="center">

**Panduan Operasional Koki MakanMakan**

Buat manajemen dapur lebih cerdas, memasak lebih fokus

**Versi 2.0** | **2025-10-26**

Built with ❤️ for all chefs

</div>
