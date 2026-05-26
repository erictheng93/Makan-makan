import type { Messages } from "../types";

const msMY: Messages = {
  app: {
    footer: {
      copyright: "© 2024 MakanMakan. Semua hak terpelihara.",
    },
    tagline: {
      selfHosted: "Dihoskan Sendiri",
    },
  },
  apply: {
    form: {
      businessName: {
        label: "Nama Restoran",
        placeholder: "cth. Dapur Diraja",
      },
      contactEmail: {
        label: "E-mel",
        placeholder: "your@email.com",
      },
      contactName: {
        label: "Nama Kenalan",
        placeholder: "nama awak",
      },
      contactPhone: {
        label: "telefon",
        placeholder: "+1-234-567-8900",
      },
      location: {
        failure:
          "Tidak dapat mendapatkan lokasi semasa anda. Semak kebenaran lokasi atau masukkan koordinat secara manual.",
        help: "Digunakan untuk penemuan pasar malam / daerah dan carian berdekatan. Gunakan koordinat etalase atau gerai sebenar.",
        label: "Lokasi Restoran",
        latitudePlaceholder: "Latitud, mis. 24.147736",
        locating: "Mengesan...",
        longitudePlaceholder: "Longitud, cth. 120.673648",
        unsupported:
          "Penyemak imbas ini tidak menyokong geolokasi. Masukkan koordinat secara manual.",
        useCurrent: "Gunakan Lokasi Semasa",
      },
      next: "Seterusnya",
      subdomain: {
        available: "URL ini tersedia",
        emptyHint: "Biarkan kosong untuk menjana automatik",
        invalidFormat: "Hanya huruf kecil, nombor dan sempang dibenarkan",
        label: "URL yang dikehendaki (Pilihan)",
        placeholder: "restoran anda",
        suggestionsLabel: "Alternatif yang dicadangkan:",
        taken: "URL ini sudah diambil",
      },
      submitting: "Menyerahkan...",
    },
    title: "Borang Permohonan",
    toast: {
      submitFailureFallback: "Penyerahan gagal. Sila cuba lagi kemudian.",
      submitSuccess: "Permohonan diserahkan",
    },
    validation: {
      businessNameRequired: "Sila masukkan nama restoran",
      contactNameRequired: "Sila masukkan nama kenalan",
      emailInvalid: "Sila masukkan e-mel yang sah",
      emailRequired: "Sila masukkan e-mel",
      latitudeInvalid: "Latitud mestilah antara -90 dan 90",
      latitudeRequired: "Sila masukkan latitud restoran",
      longitudeInvalid: "Longitud mestilah antara -180 dan 180",
      longitudeRequired: "Sila masukkan longitud restoran",
      phoneRequired: "Sila masukkan nombor telefon",
      subdomainInvalidFormat:
        "Hanya huruf kecil, nombor dan sempang dibenarkan",
      subdomainTaken: "URL ini sudah diambil",
      subdomainTooShort: "Mestilah sekurang-kurangnya 3 aksara",
    },
  },
  common: {
    back: "belakang",
    cancel: "Batal",
    loading: "Memuatkan...",
    submit: "Hantar",
    toast: {
      copiedToClipboard: "Disalin ke papan keratan",
    },
  },
  connect: {
    assignedSubdomainLabel: "URL khusus anda:",
    button: {
      complete: "Permohonan Lengkap",
      completing: "Memproses...",
      verify: "Sahkan Sambungan",
      verifying: "Mengesahkan...",
    },
    form: {
      accountId: {
        label: "ID Akaun Cloudflare",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
      apiToken: {
        label: "Token API",
        placeholder: "•••••••••••••••••••••••••••••••••",
      },
    },
    help: {
      linkText: "Hubungi kami untuk panduan video",
      prompt: "Perlukan bantuan?",
    },
    info: {
      description:
        "MakanMakan berjalan pada akaun Cloudflare anda sendiri, memastikan anda mempunyai kawalan penuh ke atas data anda. Kos sumber disertakan dalam langganan anda.",
      title: "Mengapa anda memerlukan akaun Cloudflare?",
    },
    permissions: {
      pagesOptional: "Halaman (Pilihan)",
      titleSuccess: "Semakan kebenaran lulus",
      titleWarning: "Keputusan semakan kebenaran",
    },
    steps: {
      heading: "Langkah-langkah:",
      step1Prefix: "Pergi ke",
      step1Suffix: "(daftar dahulu jika anda tidak mempunyai akaun)",
      step2: 'Klik avatar di bahagian atas sebelah kanan → pilih "Profil Saya"',
      step3ClipboardText: "ID Akaun berada dalam bar sisi kanan Papan Pemuka",
      step3Prefix: "Salin anda",
      step4: 'Pergi ke "Token API" → klik "Buat Token"',
      step5: 'Pilih templat "Edit Cloudflare Workers".',
      step6: "Salin Token API yang dijana",
    },
    title: "Sambungkan Akaun Cloudflare",
    toast: {
      completeFailureFallback:
        "Gagal melengkapkan permohonan. Sila cuba lagi kemudian.",
      completeSuccess: "Permohonan selesai!",
      verifyFailureFallback: "Pengesahan gagal. Sila semak butiran anda.",
      verifySuccess: "Akaun Cloudflare disahkan!",
    },
    validation: {
      accountIdLength: "ID Akaun mestilah 32 aksara",
      accountIdRequired: "Sila masukkan ID Akaun",
      apiTokenFormat: "Format Token API tidak sah",
      apiTokenRequired: "Sila masukkan Token API",
    },
    verifiedMessage: "Akaun Cloudflare berjaya disambungkan!",
  },
  home: {
    cta: {
      button: "Mulakan Permohonan",
      subtitle:
        "Isi permohonan dan kami akan menghubungi anda dalam masa 24 jam.",
      title: "Bersedia untuk Bermula?",
    },
    features: {
      fast: {
        description:
          "Saluran paip penggunaan automatik. Hidup dalam masa 24 jam.",
        title: "Deployment Cepat",
      },
      isolated: {
        description:
          "Persekitaran awan terpencil sepenuhnya. Data anda adalah 100% milik anda.",
        title: "Persekitaran Terpencil",
      },
      secure: {
        description:
          "Dibina pada rangkaian kelebihan global Cloudflare dengan keselamatan gred perusahaan.",
        title: "Selamat & Boleh Dipercayai",
      },
    },
    hero: {
      ctaApply: "Mohon Sekarang",
      ctaDemo: "Lihat Demo →",
      subtitle: "Dihoskan Sendiri · Data Selamat · Pelancaran dalam 24 Jam",
      titleLine1: "Bina Restoran Anda",
      titleLine2: "Sistem Pengurusan Berdedikasi",
    },
  },
  plans: {
    enterprise: "Perusahaan",
    professional: "Profesional",
    standard: "Standard",
  },
  success: {
    button: {
      backHome: "Kembali ke Rumah",
      goToAdmin: "Pergi ke Papan Pemuka Pentadbir",
    },
    contact: {
      prompt: "Sebarang pertanyaan? Kenalan",
    },
    nextSteps: {
      deploy: {
        description:
          "Sistem khusus anda sedang digunakan, biasanya dalam masa beberapa minit. Butiran log masuk akan dihantar apabila sedia.",
        title: "Penerapan Sistem",
      },
      email: {
        prefix: "Kami telah menghantar e-mel pengesahan kepada",
        suffix: ". Sila semak peti masuk anda.",
        title: "E-mel Pengesahan",
      },
      start: {
        description:
          "Sebaik sahaja anda menerima butiran log masuk anda, anda boleh segera mengakses papan pemuka pentadbir dan mula mengkonfigurasi restoran anda.",
        title: "Mulakan",
      },
      title: "Apa yang Berlaku Seterusnya?",
    },
    subtitleLine1: "tahniah! Arahan MakanMakan anda telah dibuat.",
    subtitleLine2: "Sistem sedang menyediakan persekitaran khusus anda.",
    summary: {
      applicationId: "ID Permohonan",
      businessName: "Nama Restoran",
      cloudflare: "Akaun Cloudflare",
      connected: "Bersambung ✓",
      contactEmail: "E-mel Hubungi",
      plan: "Rancangan Terpilih",
      subdomain: "URL khusus",
      tenantId: "ID penyewa",
      title: "Ringkasan Permohonan",
    },
    title: "Permohonan Selesai!",
  },
};

export default msMY;
