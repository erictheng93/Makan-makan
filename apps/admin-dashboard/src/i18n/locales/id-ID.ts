import { Messages } from '../index'

/**
 * Terjemahan Bahasa Indonesia
 */
const idID: Messages = {
  // Kosakata umum
  common: {
    save: 'Simpan',
    cancel: 'Batal',
    confirm: 'Konfirmasi',
    delete: 'Hapus',
    edit: 'Edit',
    add: 'Tambah',
    search: 'Cari',
    filter: 'Filter',
    export: 'Ekspor',
    import: 'Impor',
    refresh: 'Segarkan',
    loading: 'Memuat...',
    noData: 'Tidak ada data',
    submit: 'Kirim',
    reset: 'Reset',
    back: 'Kembali',
    next: 'Selanjutnya',
    previous: 'Sebelumnya',
    close: 'Tutup',
    view: 'Lihat',
    download: 'Unduh',
    upload: 'Unggah',
    select: 'Pilih',
    selectAll: 'Pilih Semua',
    deselectAll: 'Batalkan Semua',
    actions: 'Aksi',
    status: 'Status',
    createdAt: 'Tanggal Dibuat',
    updatedAt: 'Tanggal Diperbarui',
    yes: 'Ya',
    no: 'Tidak',
    fillRequired: 'Harap isi kolom yang wajib diisi'
  },

  // Sistem jadwal kerja
  scheduling: {
    title: 'Jadwal Kerja Karyawan',
    calendar: 'Tampilan Kalender',
    list: 'Tampilan Daftar',
    createSchedule: 'Buat Jadwal',
    editSchedule: 'Edit Jadwal',
    deleteSchedule: 'Hapus Jadwal',
    scheduleDetails: 'Detail Jadwal',

    filters: {
      searchEmployee: 'Cari nama karyawan...',
      dateRange: 'Rentang Tanggal',
      startDate: 'Tanggal Mulai',
      endDate: 'Tanggal Selesai',
      status: 'Status',
      allStatus: 'Semua Status',
      shift: 'Shift',
      allShifts: 'Semua Shift'
    },

    columns: {
      date: 'Tanggal',
      weekday: 'Hari',
      employee: 'Karyawan',
      shift: 'Shift',
      startTime: 'Waktu Mulai',
      endTime: 'Waktu Selesai',
      hours: 'Jam Kerja',
      status: 'Status',
      notes: 'Catatan'
    },

    form: {
      selectEmployee: 'Pilih Karyawan',
      selectShift: 'Pilih Shift',
      selectDate: 'Pilih Tanggal',
      workDate: 'Tanggal Kerja',
      shiftTemplate: 'Template Shift',
      notes: 'Catatan',
      addNotes: 'Tambah catatan...',
      repeatSchedule: 'Ulangi Jadwal',
      repeatDays: 'Jumlah Hari Pengulangan',
      repeatUntil: 'Ulangi Sampai'
    },

    batch: {
      title: 'Operasi Massal',
      selected: '{count} terpilih',
      confirmAll: 'Konfirmasi Semua',
      cancelAll: 'Batalkan Semua',
      deleteAll: 'Hapus Semua',
      exportSelected: 'Ekspor Yang Dipilih',
      confirmAction: 'Apakah Anda yakin ingin melakukan operasi ini pada {count} jadwal?'
    },

    pagination: {
      showing: 'Menampilkan {start}-{end} dari {total}',
      itemsPerPage: 'item/halaman',
      firstPage: 'Halaman Pertama',
      lastPage: 'Halaman Terakhir',
      previousPage: 'Halaman Sebelumnya',
      nextPage: 'Halaman Selanjutnya'
    },

    conflicts: {
      title: 'Konflik Jadwal',
      detected: 'Terdeteksi {count} konflik',
      noConflicts: 'Tidak ada konflik',
      overlapShift: 'Shift Tumpang Tindih',
      exceedHours: 'Melebihi Jam Kerja',
      leaveConflict: 'Konflik Cuti',
      maxConsecutiveDays: 'Melebihi Hari Kerja Berturut-turut',
      insufficientRest: 'Waktu Istirahat Tidak Cukup',
      resolve: 'Selesaikan',
      ignore: 'Abaikan',
      details: 'Detail Konflik'
    },

    stats: {
      totalSchedules: 'Total Jadwal',
      totalHours: 'Total Jam',
      averageHours: 'Rata-rata Jam',
      employeeCount: 'Jumlah Karyawan',
      thisWeek: 'Minggu Ini',
      thisMonth: 'Bulan Ini',
      today: 'Hari Ini'
    }
  },

  // Template shift
  shiftTemplates: {
    title: 'Template Shift',
    create: 'Buat Template',
    edit: 'Edit Template',
    delete: 'Hapus Template',
    duplicate: 'Duplikat Template',

    form: {
      name: 'Nama Template',
      nameRequired: 'Silakan masukkan nama template',
      startTime: 'Waktu Mulai',
      endTime: 'Waktu Selesai',
      duration: 'Durasi',
      hours: '{hours} jam',
      color: 'Warna',
      description: 'Deskripsi',
      isActive: 'Aktifkan template ini'
    },

    usage: {
      title: 'Statistik Penggunaan',
      timesUsed: 'Kali Digunakan',
      lastUsed: 'Terakhir Digunakan',
      never: 'Belum Pernah Digunakan'
    },

    colors: {
      blue: 'Biru',
      green: 'Hijau',
      orange: 'Oranye',
      purple: 'Ungu',
      red: 'Merah',
      pink: 'Pink',
      cyan: 'Cyan',
      gray: 'Abu-abu'
    },

    presets: {
      morning: 'Shift Pagi',
      afternoon: 'Shift Siang',
      evening: 'Shift Sore',
      night: 'Shift Malam',
      fullDay: 'Seharian'
    }
  },

  // Permintaan tukar shift
  swapRequests: {
    title: 'Permintaan Tukar Shift',
    create: 'Ajukan Tukar Shift',
    approve: 'Setujui',
    reject: 'Tolak',
    cancel: 'Batalkan Permintaan',

    status: {
      pending: 'Menunggu',
      approved: 'Disetujui',
      rejected: 'Ditolak',
      cancelled: 'Dibatalkan'
    },

    form: {
      requester: 'Pemohon',
      target: 'Karyawan Tujuan',
      reason: 'Alasan',
      reasonRequired: 'Silakan masukkan alasan',
      originalShift: 'Shift Saat Ini',
      targetShift: 'Shift Tujuan',
      selectOriginal: 'Pilih shift yang akan ditukar',
      selectTarget: 'Pilih shift lawan',
      noAvailableShifts: 'Tidak ada shift yang tersedia'
    },

    details: {
      requestedBy: 'Diminta Oleh',
      requestedAt: 'Waktu Permintaan',
      swapWith: 'Tukar Dengan',
      reason: 'Alasan',
      originalShiftDetails: 'Detail Shift Saat Ini',
      targetShiftDetails: 'Detail Shift Tujuan',
      approvedBy: 'Disetujui Oleh',
      approvedAt: 'Waktu Persetujuan',
      rejectedBy: 'Ditolak Oleh',
      rejectedAt: 'Waktu Penolakan',
      rejectionReason: 'Alasan Penolakan'
    },

    actions: {
      viewDetails: 'Lihat Detail',
      approveConfirm: 'Apakah Anda yakin ingin menyetujui permintaan tukar shift ini?',
      rejectConfirm: 'Apakah Anda yakin ingin menolak permintaan tukar shift ini?',
      cancelConfirm: 'Apakah Anda yakin ingin membatalkan permintaan tukar shift ini?'
    }
  },

  status: {
    scheduled: 'Terjadwal',
    confirmed: 'Dikonfirmasi',
    cancelled: 'Dibatalkan',
    completed: 'Selesai',
    pending: 'Menunggu',
    active: 'Aktif',
    inactive: 'Tidak Aktif'
  },

  weekdays: {
    short: {
      sunday: 'Min',
      monday: 'Sen',
      tuesday: 'Sel',
      wednesday: 'Rab',
      thursday: 'Kam',
      friday: 'Jum',
      saturday: 'Sab'
    },
    long: {
      sunday: 'Minggu',
      monday: 'Senin',
      tuesday: 'Selasa',
      wednesday: 'Rabu',
      thursday: 'Kamis',
      friday: 'Jumat',
      saturday: 'Sabtu'
    }
  },

  errors: {
    generic: 'Operasi gagal, silakan coba lagi',
    networkError: 'Kesalahan jaringan, silakan periksa koneksi Anda',
    notFound: 'Data tidak ditemukan',
    unauthorized: 'Anda tidak memiliki izin untuk melakukan operasi ini',
    validationError: 'Validasi data gagal',
    requiredField: 'Bidang ini wajib diisi',
    invalidDate: 'Format tanggal tidak valid',
    invalidTime: 'Format waktu tidak valid',
    startTimeAfterEndTime: 'Waktu mulai harus sebelum waktu selesai',
    dateInPast: 'Tanggal tidak boleh di masa lalu',
    duplicateSchedule: 'Sudah ada jadwal untuk rentang waktu ini',
    loadFailed: 'Gagal memuat',
    saveFailed: 'Gagal menyimpan',
    deleteFailed: 'Gagal menghapus'
  },

  success: {
    saved: 'Berhasil disimpan',
    deleted: 'Berhasil dihapus',
    created: 'Berhasil dibuat',
    updated: 'Berhasil diperbarui',
    scheduled: 'Berhasil dijadwalkan',
    cancelled: 'Berhasil dibatalkan',
    confirmed: 'Berhasil dikonfirmasi',
    approved: 'Berhasil disetujui',
    rejected: 'Berhasil ditolak',
    exported: 'Berhasil diekspor',
    imported: 'Berhasil diimpor'
  },

  confirmations: {
    delete: 'Apakah Anda yakin ingin menghapus?',
    deleteSchedule: 'Apakah Anda yakin ingin menghapus jadwal ini?',
    deleteTemplate: 'Apakah Anda yakin ingin menghapus template ini?',
    cancel: 'Apakah Anda yakin ingin membatalkan?',
    unsavedChanges: 'Ada perubahan yang belum disimpan, apakah Anda yakin ingin keluar?',
    batchDelete: 'Apakah Anda yakin ingin menghapus {count} item yang dipilih?'
  },

  // Komponen grafik
  charts: {
    workHours: {
      title: 'Statistik Total Jam Kerja',
      customPeriod: 'Periode kustom',
      barChart: 'Grafik batang',
      lineChart: 'Grafik garis',
      totalHours: 'Total jam kerja',
      averageHours: 'Rata-rata jam kerja',
      employeeCount: 'Jumlah karyawan',
      loadFailed: 'Gagal memuat data',
      top10: '10 Teratas',
      hoursUnit: 'j'
    },
    shiftDistribution: {
      title: 'Distribusi Shift',
      doughnutChart: 'Grafik donat',
      pieChart: 'Grafik lingkaran',
      distribution: 'Distribusi shift',
      people: 'orang',
      loadFailed: 'Gagal memuat data'
    },
    trend: {
      title: 'Analisis Tren Jam Kerja',
      totalHours: 'Total jam kerja',
      averageHours: 'Rata-rata jam kerja',
      scheduleCount: 'Jumlah jadwal',
      last7Days: '7 Hari Terakhir',
      last30Days: '30 Hari Terakhir',
      last90Days: '90 Hari Terakhir',
      currentValue: 'Nilai saat ini',
      trend: 'Tren',
      changeRate: 'Tingkat perubahan',
      upTrend: 'Tren naik',
      downTrend: 'Tren turun',
      stable: 'Stabil',
      items: 'item',
      loadFailed: 'Gagal memuat data'
    }
  },

  // Sistem reservasi
  reservation: {
    title: 'Manajemen Reservasi',
    create: 'Reservasi Baru',
    createSuccess: 'Reservasi berhasil dibuat',
    createError: 'Gagal membuat reservasi',
    loadError: 'Gagal memuat daftar reservasi',
    confirmPrompt: 'Apakah Anda yakin ingin mengkonfirmasi reservasi ini?',
    confirmError: 'Gagal mengkonfirmasi reservasi',
    arrivedError: 'Gagal menandai sudah tiba',
    seatedError: 'Gagal menandai sudah duduk',
    cancelPrompt: 'Apakah Anda yakin ingin membatalkan reservasi ini?',
    cancelError: 'Gagal membatalkan reservasi',
    confirmationCode: 'Kode Konfirmasi',
    customerName: 'Nama Pelanggan',
    customerPhone: 'Nomor Telepon',
    customerEmail: 'Email',
    datetime: 'Waktu Reservasi',
    selectDatetime: 'Pilih waktu reservasi',
    partySize: 'Jumlah Orang',
    people: 'orang',
    duration: 'Durasi',
    minutes: 'menit',
    specialRequests: 'Permintaan Khusus',
    specialRequestsPlaceholder: 'Mis: kursi bayi, akses kursi roda, tempat duduk di jendela, dll.',
    notes: 'Catatan',
    status: 'Status',
    detail: 'Detail Reservasi',
    stats: {
      total: 'Total Reservasi',
      pending: 'Menunggu',
      confirmed: 'Dikonfirmasi',
      seated: 'Sudah Duduk'
    },
    filter: {
      date: 'Tanggal',
      selectDate: 'Pilih tanggal',
      status: 'Status',
      allStatus: 'Semua Status',
      phone: 'Nomor Telepon',
      enterPhone: 'Masukkan nomor telepon'
    }
  },

  // Sistem daftar tunggu
  waitingList: {
    title: 'Manajemen Daftar Tunggu',
    addCustomer: 'Tambah ke Daftar Tunggu',
    addSuccess: 'Berhasil ditambahkan ke daftar tunggu',
    addError: 'Gagal menambahkan ke daftar tunggu',
    loadError: 'Gagal memuat daftar tunggu',
    callCustomer: 'Panggil Pelanggan',
    callError: 'Gagal memanggil pelanggan',
    confirmCall: 'Konfirmasi Panggilan',
    call: 'Panggil',
    callNext: 'Panggil Berikutnya',
    seat: 'Duduk',
    expire: 'Kadaluarsa',
    cancel: 'Batal',
    seatedError: 'Gagal menandai sudah duduk',
    expirePrompt: 'Apakah Anda yakin ingin menandai sebagai kadaluarsa?',
    expireError: 'Gagal menandai sebagai kadaluarsa',
    cancelPrompt: 'Apakah Anda yakin ingin membatalkan entri ini?',
    cancelError: 'Gagal membatalkan',
    batchCallError: 'Gagal memanggil secara massal',
    customerName: 'Nama Pelanggan',
    customerPhone: 'Nomor Telepon',
    partySize: 'Jumlah Orang',
    people: 'orang',
    notes: 'Catatan',
    notesPlaceholder: 'Mis: kereta bayi, kebutuhan khusus, dll.',
    queueNumber: 'Nomor Antrian',
    waitTime: 'Waktu Tunggu',
    joinedAt: 'Waktu Bergabung',
    estimatedWait: 'Estimasi Waktu Tunggu',
    partiesAhead: 'Antrian di Depan',
    availableTables: 'Meja Tersedia',
    assignTable: 'Tetapkan Meja',
    selectTable: 'Pilih meja',
    selectTableRequired: 'Harap pilih meja untuk ditetapkan',
    notificationMethod: 'Metode Notifikasi',
    sms: 'SMS',
    display: 'Tampilan',
    both: 'Keduanya',
    queue: 'Antrian',
    noQueue: 'Tidak ada yang menunggu',
    cardView: 'Tampilan Kartu',
    tableView: 'Tampilan Tabel',
    stats: {
      waiting: 'Menunggu',
      called: 'Dipanggil',
      avgWait: 'Rata-rata Tunggu',
      todayTotal: 'Total Hari Ini'
    },
    filter: {
      status: 'Status',
      allStatus: 'Semua Status',
      phone: 'Nomor Telepon',
      enterPhone: 'Masukkan nomor telepon'
    }
  },

  // Judul halaman dan navigasi
  header: {
    title: 'Dashboard Admin MakanMakan',
    home: 'Beranda',
    realtime: {
      connected: 'Terhubung real-time',
      disconnected: 'Koneksi terputus'
    },
    userMenu: {
      logout: 'Keluar'
    },
    breadcrumb: {
      home: 'Beranda',
      orders: 'Manajemen Pesanan',
      menu: 'Manajemen Menu',
      tables: 'Manajemen Meja',
      users: 'Manajemen Karyawan',
      analytics: 'Analisis Data'
    },
    roles: {
      admin: 'Administrator',
      owner: 'Pemilik',
      chef: 'Koki',
      service: 'Pelayan',
      cashier: 'Kasir'
    }
  }
}

export default idID
