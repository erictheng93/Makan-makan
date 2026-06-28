import type { Messages } from "../types";

const idID: Messages = {
  app: {
    footer: {
      copyright: "© 2024 MakanMakan. Semua hak dilindungi undang-undang.",
    },
    tagline: {
      selfHosted: "Dihosting Sendiri",
    },
  },
  apply: {
    form: {
      businessName: {
        label: "Nama Restoran",
        placeholder: "misalnya Dapur Kerajaan",
      },
      contactEmail: {
        label: "Surel",
        placeholder: "anda@email.com",
      },
      contactName: {
        label: "Nama Kontak",
        placeholder: "Namamu",
      },
      contactPhone: {
        label: "Telepon",
        placeholder: "+1-234-567-8900",
      },
      location: {
        failure:
          "Tidak dapat memperoleh lokasi Anda saat ini. Periksa izin lokasi atau masukkan koordinat secara manual.",
        help: "Digunakan untuk penemuan pasar malam / distrik dan pencarian terdekat. Gunakan koordinat etalase atau kios sebenarnya.",
        label: "Lokasi Restoran",
        latitudePlaceholder: "Lintang, mis. 24.147736",
        locating: "Menemukan...",
        longitudePlaceholder: "Bujur, mis. 120.673648",
        unsupported:
          "Browser ini tidak mendukung geolokasi. Masukkan koordinat secara manual.",
        useCurrent: "Gunakan Lokasi Saat Ini",
      },
      next: "Selanjutnya",
      subdomain: {
        available: "URL ini tersedia",
        emptyHint: "Biarkan kosong untuk menghasilkan secara otomatis",
        invalidFormat:
          "Hanya huruf kecil, angka, dan tanda hubung yang diperbolehkan",
        label: "URL yang diinginkan (Opsional)",
        placeholder: "restoran Anda",
        suggestionsLabel: "Alternatif yang disarankan:",
        taken: "URL ini sudah dipakai",
      },
      submitting: "Mengirimkan...",
    },
    title: "Formulir Aplikasi",
    toast: {
      submitFailureFallback: "Pengiriman gagal. Silakan coba lagi nanti.",
      submitSuccess: "Permohonan diajukan",
    },
    validation: {
      businessNameRequired: "Silakan masukkan nama restoran",
      contactNameRequired: "Silakan masukkan nama kontak",
      emailInvalid: "Silakan masukkan email yang valid",
      emailRequired: "Silakan masukkan email",
      latitudeInvalid: "Lintang harus antara -90 dan 90",
      latitudeRequired: "Silakan masukkan garis lintang restoran",
      longitudeInvalid: "Garis bujur harus antara -180 dan 180",
      longitudeRequired: "Silakan masukkan garis bujur restoran",
      phoneRequired: "Silakan masukkan nomor telepon",
      subdomainInvalidFormat:
        "Hanya huruf kecil, angka, dan tanda hubung yang diperbolehkan",
      subdomainTaken: "URL ini sudah dipakai",
      subdomainTooShort: "Minimal harus 3 karakter",
    },
  },
  common: {
    back: "Kembali",
    cancel: "Batalkan",
    loading: "Memuat...",
    submit: "Kirim",
    toast: {
      copiedToClipboard: "Disalin ke papan klip",
    },
  },
  connect: {
    assignedSubdomainLabel: "URL khusus Anda:",
    button: {
      complete: "Aplikasi Lengkap",
      completing: "Memproses...",
      verify: "Verifikasi Koneksi",
      verifying: "Memverifikasi...",
    },
    form: {
      accountId: {
        label: "ID Akun Cloudflare",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
      apiToken: {
        label: "Token API",
        placeholder: "•••••••••••••••••••••••••••••••••",
      },
    },
    help: {
      linkText: "Hubungi kami untuk panduan video",
      prompt: "Butuh bantuan?",
    },
    info: {
      description:
        "MakanMakan berjalan di akun Cloudflare Anda sendiri, memastikan Anda memiliki kendali penuh atas data Anda. Biaya sumber daya sudah termasuk dalam langganan Anda.",
      title: "Mengapa Anda memerlukan akun Cloudflare?",
    },
    permissions: {
      pagesOptional: "Halaman (Opsional)",
      titleSuccess: "Pemeriksaan izin berlalu",
      titleWarning: "Hasil pemeriksaan izin",
    },
    steps: {
      heading: "Langkah-langkah:",
      step1Prefix: "Pergi ke",
      step1Suffix: "(daftar terlebih dahulu jika belum mempunyai akun)",
      step2: 'Klik avatar di kanan atas → pilih "Profil Saya"',
      step3ClipboardText: "ID Akun ada di sidebar kanan Dashboard",
      step3Prefix: "Salin milik Anda",
      step4: 'Buka "Token API" → klik "Buat Token"',
      step5: 'Pilih templat "Edit Cloudflare Workers".',
      step6: "Salin Token API yang dihasilkan",
    },
    title: "Hubungkan Akun Cloudflare",
    toast: {
      completeFailureFallback:
        "Gagal menyelesaikan aplikasi. Silakan coba lagi nanti.",
      completeSuccess: "Aplikasi selesai!",
      verifyFailureFallback: "Verifikasi gagal. Silakan periksa detail Anda.",
      verifySuccess: "Akun Cloudflare terverifikasi!",
    },
    validation: {
      accountIdLength: "ID Akun harus terdiri dari 32 karakter",
      accountIdRequired: "Silakan masukkan ID Akun",
      apiTokenFormat: "Format Token API tidak valid",
      apiTokenRequired: "Silakan masukkan Token API",
    },
    verifiedMessage: "Akun Cloudflare berhasil terhubung!",
  },
  home: {
    cta: {
      button: "Mulai Aplikasi",
      subtitle:
        "Isi aplikasi dan kami akan menghubungi Anda dalam waktu 24 jam.",
      title: "Siap Memulai?",
    },
    features: {
      fast: {
        description: "Alur penerapan otomatis. Hidup dalam 24 jam.",
        title: "Penerapan Cepat",
      },
      isolated: {
        description:
          "Lingkungan cloud yang sepenuhnya terisolasi. Data Anda 100% milik Anda.",
        title: "Lingkungan Terisolasi",
      },
      secure: {
        description:
          "Dibangun di jaringan edge global Cloudflare dengan keamanan tingkat perusahaan.",
        title: "Aman & Andal",
      },
    },
    hero: {
      ctaApply: "Lamar Sekarang",
      ctaDemo: "Lihat Demo →",
      subtitle: "Dihosting Sendiri · Data Aman · Peluncuran dalam 24 Jam",
      titleLine1: "Bangun Restoran Anda",
      titleLine2: "Sistem Manajemen Khusus",
    },
  },
  plans: {
    enterprise: "Perusahaan",
    professional: "Profesional",
    standard: "Standar",
  },
  success: {
    button: {
      backHome: "Kembali ke Rumah",
      goToAdmin: "Buka Dasbor Admin",
    },
    contact: {
      prompt: "Ada pertanyaan? Kontak",
    },
    nextSteps: {
      deploy: {
        description:
          "Sistem khusus Anda sedang diterapkan, biasanya dalam beberapa menit. Detail login akan dikirim jika sudah siap.",
        title: "Penerapan Sistem",
      },
      email: {
        prefix: "Kami telah mengirimkan email konfirmasi ke",
        suffix: ". Silakan periksa kotak masuk Anda.",
        title: "Email Konfirmasi",
      },
      start: {
        description:
          "Setelah Anda menerima detail login, Anda dapat segera mengakses dasbor admin dan mulai mengonfigurasi restoran Anda.",
        title: "Memulai",
      },
      title: "Apa yang Terjadi Selanjutnya?",
    },
    subtitleLine1: "Selamat! Penerapan MakanMakan Anda telah dibuat.",
    subtitleLine2: "Sistem sedang mempersiapkan lingkungan khusus Anda.",
    summary: {
      applicationId: "ID Aplikasi",
      businessName: "Nama Restoran",
      cloudflare: "Hosting Platform",
      connected: "Aktif",
      contactEmail: "Hubungi Email",
      plan: "Paket yang Dipilih",
      subdomain: "URL khusus",
      tenantId: "ID Penyewa",
      title: "Ringkasan Aplikasi",
    },
    title: "Aplikasi Selesai!",
  },
};

export default idID;
