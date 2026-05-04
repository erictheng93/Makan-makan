# 👨‍🍳 Sổ Tay Vận Hành MakanMasak Cho Đầu Bếp

> **Phiên bản**: 2.0
> **Cập nhật**: 2025-10-26
> **Đối tượng**: Nhân viên bếp, Đầu bếp, Bếp trưởng

---

## 📚 Mục Lục

1. [Bắt Đầu Nhanh](#bắt-đầu-nhanh)
2. [Tổng Quan Hệ Thống](#tổng-quan-hệ-thống)
3. [Giao Diện Màn Hình Bếp](#giao-diện-màn-hình-bếp)
4. [Đăng Nhập và Thao Tác Cơ Bản](#đăng-nhập-và-thao-tác-cơ-bản)
5. [Quy Trình Nhận Đơn](#quy-trình-nhận-đơn)
6. [Quản Lý Trạng Thái Đơn](#quản-lý-trạng-thái-đơn)
7. [Xử Lý Nhiều Đơn](#xử-lý-nhiều-đơn)
8. [Quản Lý Ưu Tiên](#quản-lý-ưu-tiên)
9. [Xử Lý Tình Huống Đặc Biệt](#xử-lý-tình-huống-đặc-biệt)
10. [Phối Hợp Nhóm](#phối-hợp-nhóm)
11. [Mẹo Nâng Cao Hiệu Suất](#mẹo-nâng-cao-hiệu-suất)
12. [Câu Hỏi Thường Gặp](#câu-hỏi-thường-gặp)
13. [Khắc Phục Sự Cố](#khắc-phục-sự-cố)

---

## 🚀 Bắt Đầu Nhanh

### Trách Nhiệm Cốt Lõi Của Đầu Bếp

```
┌─────────────────────────────────────────────┐
│ Quy Trình Làm Việc Đầu Bếp                  │
├─────────────────────────────────────────────┤
│                                             │
│  1️⃣ Nhận đơn hàng mới                       │
│      ↓                                      │
│  2️⃣ Xác nhận chi tiết đơn hàng              │
│      ↓                                      │
│  3️⃣ Cập nhật thành "Đang chuẩn bị"         │
│      ↓                                      │
│  4️⃣ Bắt đầu nấu                             │
│      ↓                                      │
│  5️⃣ Cập nhật thành "Hoàn thành" khi xong   │
│      ↓                                      │
│  6️⃣ Thông báo nhân viên phục vụ lấy món    │
│                                             │
└─────────────────────────────────────────────┘
```

### Danh Sách Kiểm Tra Lần Đầu

✅ **Bước 1: Xác Nhận Tài Khoản & Thiết Bị**

- Xác minh thông tin tài khoản đầu bếp
- Kiểm tra đăng nhập hệ thống màn hình bếp
- Đảm bảo màn hình hiển thị hoạt động tốt

✅ **Bước 2: Làm Quen Giao Diện**

- Hiểu bố cục thẻ đơn hàng
- Thực hành cập nhật trạng thái
- Kiểm tra thông báo âm thanh

✅ **Bước 3: Học Quy Trình**

- Phương thức thông báo đơn mới
- Thủ tục cập nhật trạng thái
- Quy trình hoàn thành đơn hàng

✅ **Bước 4: Chuẩn Bị**

- Xác nhận thiết bị bếp sẵn sàng
- Kiểm tra nguyên liệu chuẩn bị
- Bắt đầu nhận đơn

---

## 🏢 Tổng Quan Hệ Thống

### Vị Trí Hệ Thống Màn Hình Bếp

```
┌─────────────────────────────────────────────────────────┐
│ Hệ Sinh Thái Bếp MakanMasak                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Khách đặt ───→ Hệ thống ───→ Màn hình bếp ───→ Phục vụ│
│                     ↓             ↓             ↓       │
│                Chủ giám sát  【Bạn ở đây】  Khách theo  │
│                                                  dõi    │
└─────────────────────────────────────────────────────────┘
```

### Mô Hình Phối Hợp Vai Trò Bếp

```
        Nguồn Đơn Hàng
           │
    ┌──────┴──────┐
    ↓             ↓
Đơn Bàn       Đơn Cửa Hàng
    │             │
    └──────┬──────┘
           ↓
   【Hệ Thống Màn Hình Bếp】
     (Trạm Làm Việc Của Bạn)
           │
    ┌──────┴──────┐
    ↓             ↓
Nhân Viên      Ứng Dụng
Phục Vụ       Khách Hàng
```

**Giải Thích**:

- **Khách Hàng**: Đặt qua mã QR
- **Hệ Thống Bếp**: Nhận và hiển thị đơn thời gian thực
- **Đầu Bếp (Bạn)**: Xử lý đơn và cập nhật trạng thái
- **Nhân Viên Phục Vụ**: Lấy và giao cho khách
- **Chủ Nhà Hàng**: Giám sát vận hành tổng thể

---

## 🖥️ Giao Diện Màn Hình Bếp

### Bố Cục Màn Hình Chính

```
┌───────────────────────────────────────────────────────────┐
│  🏪 Tên Nhà Hàng    👨‍🍳 Bếp: Minh    🕐 14:35           │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  【Chờ】           【Đang làm】      【Sẵn sàng】        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ #001     │    │ #002     │    │ #003     │          │
│  │ Bàn: 5   │    │ Bàn: 3   │    │ Bàn: 8   │          │
│  │ Giờ:     │    │ Giờ:     │    │ Giờ:     │          │
│  │ 14:30    │    │ 14:25    │    │ 14:20    │          │
│  │          │    │          │    │          │          │
│  │ Món:     │    │ Món:     │    │ Món:     │          │
│  │ • Bít tết│    │ • Mì Ý   │    │ • Salad  │          │
│  │ • Salad  │    │ • Súp    │    │ • Súp    │          │
│  │          │    │          │    │          │          │
│  │ [Bắt đầu]│    │ [Xong]   │    │ ✓ Sẵn    │          │
│  └──────────┘    └──────────┘    └──────────┘          │
│                                                           │
│  ┌──────────┐                                            │
│  │ #004     │                                            │
│  │ Bàn: 12  │                                            │
│  │ Giờ:     │                                            │
│  │ 14:32 🔔 │    (Thông báo đơn mới)                    │
│  │          │                                            │
│  │ Món:     │                                            │
│  │ • Cà ri  │                                            │
│  │ • Nước   │                                            │
│  │          │                                            │
│  │ [Bắt đầu]│                                            │
│  └──────────┘                                            │
│                                                           │
├───────────────────────────────────────────────────────────┤
│  📊 Hôm nay: 23 Xong | 5 Đang làm | 2 Chờ               │
└───────────────────────────────────────────────────────────┘
```

### Giải Thích Chi Tiết Thẻ Đơn

```
┌─────────────────────────────┐
│ Cấu Trúc Thẻ Đơn            │
├─────────────────────────────┤
│                             │
│  🔢 Số Đơn: #001            │
│  ├─ Nhận diện nhanh        │
│  └─ Đồng bộ với khách      │
│                             │
│  🪑 Bàn/Ghế: Bàn 5          │
│  ├─ Vị trí giao rõ ràng    │
│  └─ Tránh giao nhầm         │
│                             │
│  ⏰ Giờ Đặt: 14:30          │
│  ├─ Theo dõi thời gian chờ │
│  └─ Tham khảo ưu tiên      │
│                             │
│  📋 Món Ăn:                 │
│  ├─ Bít tết x1 (chín vừa)  │
│  ├─ Salad Caesar x1        │
│  └─ Súp ngô x2             │
│                             │
│  💬 Ghi Chú: Không hành     │
│  └─ Yêu cầu đặc biệt       │
│                             │
│  🎯 Nút: [Bắt đầu]          │
│  └─ Cập nhật 1 chạm        │
│                             │
└─────────────────────────────┘
```

### Hệ Thống Mã Màu

```
┌─────────────────────────────────────────┐
│ Hệ Thống Chỉ Báo Trực Quan              │
├─────────────────────────────────────────┤
│                                         │
│  🟦 Xanh dương = Đơn mới (Chờ)         │
│  └─ Chưa bắt đầu                       │
│                                         │
│  🟨 Vàng = Đang chuẩn bị               │
│  └─ Đang nấu                           │
│                                         │
│  🟩 Xanh lá = Sẵn sàng                 │
│  └─ Sẵn sàng phục vụ                   │
│                                         │
│  🟥 Đỏ = Chờ > 15 phút                 │
│  └─ Cần ưu tiên                        │
│                                         │
│  🔔 Nhấp nháy = Đơn mới tới            │
│  └─ Có âm thanh thông báo              │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔐 Đăng Nhập và Thao Tác Cơ Bản

### Quy Trình Đăng Nhập

**Bước 1: Mở Hệ Thống Màn Hình Bếp**

Truy cập: URL hệ thống trên máy tính bảng hoặc màn hình bếp

```
Ví dụ URL:
https://kitchen.makanmasak.com
hoặc
https://nha-hang-cua-ban.makanmasak.com/kitchen
```

**Bước 2: Nhập Thông Tin Đầu Bếp**

```
┌─────────────────────────────┐
│  👨‍🍳 Đăng Nhập Hệ Thống Bếp│
├─────────────────────────────┤
│                             │
│  Tài khoản: [chef001____]  │
│  Mật khẩu: [**********]    │
│                             │
│  ☐ Ghi nhớ (Trạm làm việc) │
│                             │
│  [   Đăng Nhập Hệ Thống   ]│
│                             │
└─────────────────────────────┘
```

**Bước 3: Chọn Trạm Làm Việc (Nếu Có)**

Một số nhà hàng có nhiều trạm bếp (ví dụ: Bếp lạnh, Bếp xào, Bếp nướng)

```
Chọn Trạm Của Bạn:
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Bếp Lạnh │  │ Bếp Xào  │  │ Bếp Nướng│
│          │  │          │  │          │
│ Hiển thị:│  │ Hiển thị:│  │ Hiển thị:│
│ Salad,   │  │ Cơm, Mì  │  │ Bít tết, │
│ Khai vị  │  │ Xào      │  │ Nướng    │
└──────────┘  └──────────┘  └──────────┘
```

### Danh Sách Kiểm Tra Sau Đăng Nhập

✅ **Xác Minh Trạng Thái Hệ Thống**

```
┌─────────────────────────────┐
│ Danh Sách Kiểm Tra          │
├─────────────────────────────┤
│ ✓ Kết nối mạng OK           │
│ ✓ Cập nhật thời gian thực ON│
│ ✓ Thông báo âm thanh BẬT    │
│ ✓ Độ sáng màn hình tối ưu   │
│ ✓ Thực đơn hôm nay đã tải   │
└─────────────────────────────┘
```

### Điều Chỉnh Cài Đặt Cơ Bản

**Cài Đặt Âm Thanh**

Nhấp biểu tượng ⚙️ Cài đặt ở góc trên:

```
🔊 Cảnh Báo Đơn Mới:
├─ 🔔 Chuông Chuẩn
├─ 📢 Cảnh Báo To
├─ 🎵 Nhạc Nhẹ
└─ 🔇 Im Lặng

Âm lượng: ▓▓▓▓▓▓▓▓░░ (80%)
```

**Cài Đặt Hiển Thị**

```
📺 Chế Độ Hiển Thị:
├─ 📱 Gọn (Màn Hình Nhỏ)
├─ 🖥️  Chuẩn (Màn Hình Vừa)
└─ 📺 Bếp (Màn Hình Lớn)

Cỡ Chữ:
├─ Chuẩn (Khuyến nghị)
├─ Lớn (Kính lão)
└─ Rất Lớn (Xem xa)
```

---

## 📥 Quy Trình Nhận Đơn

### Cơ Chế Thông Báo Đơn Mới

```
┌─────────────────────────────────────────┐
│ Thông Báo Đơn Hàng Mới Đến              │
├─────────────────────────────────────────┤
│                                         │
│  Phương thức 1: 🔔 Cảnh báo âm thanh   │
│  ├─ Âm thanh "Ding Dong" mặc định      │
│  └─ Có thể tùy chỉnh                   │
│                                         │
│  Phương thức 2: 📱 Màn hình nhấp nháy  │
│  ├─ Thẻ đơn nhấp nháy 3 lần           │
│  └─ Thu hút chú ý                      │
│                                         │
│  Phương thức 3: 📊 Cập nhật bộ đếm     │
│  ├─ Hiển thị "Chờ: +1"                │
│  └─ Số chuyển màu đỏ                   │
│                                         │
│  Phương thức 4: 💬 Xem trước nhanh     │
│  ├─ Hiển thị tóm tắt đơn              │
│  └─ Tự động đóng sau 5 giây           │
│                                         │
└─────────────────────────────────────────┘
```

### Các Bước Xác Nhận Đơn Mới

**Bước 1: Xem Nhanh Nội Dung Đơn**

```
Xem Trước Đơn Mới:
┌─────────────────────────┐
│ 🔔 Đơn Mới #025         │
├─────────────────────────┤
│ Bàn: Bàn 7              │
│ Giờ: 15:45              │
│                         │
│ Món:                    │
│ • Cơm rang hải sản x1  │
│ • Súp chua cay x2      │
│ • Mực rang muối x1     │
│                         │
│ ⚠️ Ghi chú: Không ớt    │
│                         │
│ [Hiểu rồi] [Bắt đầu nấu]│
└─────────────────────────┘
```

**Bước 2: Kiểm Tra Yêu Cầu Đặc Biệt**

```
Mục Cần Chú Ý Đặc Biệt:
┌─────────────────────────────┐
│ 🔍 Điểm Kiểm Tra            │
├─────────────────────────────┤
│ ✓ Chỉ báo dị ứng           │
│   └─ Không đậu, không hải sản│
│                             │
│ ✓ Yêu cầu tùy chỉnh        │
│   └─ Chín vừa, không hành  │
│                             │
│ ✓ Ghi chú đặc biệt         │
│   └─ Nóng, tách riêng      │
│                             │
│ ✓ Xác nhận số lượng        │
│   └─ Cùng món nhiều phần   │
└─────────────────────────────┘
```

**Bước 3: Ước Tính Thời Gian Chuẩn Bị**

```
Ước Tính Thời Gian Nhanh:
┌─────────────────────────────┐
│ Món          Thời Gian Ước  │
├─────────────────────────────┤
│ Cơm rang     8-10 phút      │
│ Súp          5-7 phút       │
│ Salad        3-5 phút       │
│ Bít tết      12-15 phút     │
│ Nướng        15-20 phút     │
│ Chiên        8-12 phút      │
└─────────────────────────────┘

Tổng Ước: 15 phút
Đề Xuất Xong: 16:00
```

---

## 📊 Quản Lý Trạng Thái Đơn

### Vòng Đời Đơn Hàng

```
┌─────────────────────────────────────────────────────────┐
│ Quy Trình Đơn Hàng Đầy Đủ                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🆕 Đơn Mới                                             │
│   ↓                                                     │
│   ├─ Trạng thái: chờ                                   │
│   ├─ Màu: 🟦 Xanh dương                                │
│   └─ Hành động: Nhấp "Bắt đầu nấu"                    │
│                                                         │
│   ↓                                                     │
│  🍳 Đang Chuẩn Bị                                       │
│   ↓                                                     │
│   ├─ Trạng thái: đang chuẩn bị                        │
│   ├─ Màu: 🟨 Vàng                                      │
│   ├─ Hành động: Đang nấu                              │
│   └─ Đồng hồ: Hiển thị thời gian đã trôi             │
│                                                         │
│   ↓                                                     │
│  ✅ Sẵn Sàng                                            │
│   ↓                                                     │
│   ├─ Trạng thái: sẵn sàng                             │
│   ├─ Màu: 🟩 Xanh lá                                   │
│   ├─ Hành động: Chờ nhân viên phục vụ                 │
│   └─ Thông báo: Đã báo nhân viên                      │
│                                                         │
│   ↓                                                     │
│  🚶 Đã Giao                                             │
│   ↓                                                     │
│   ├─ Trạng thái: đã giao                              │
│   ├─ Hành động: Nhân viên xác nhận                    │
│   └─ Kết quả: Xóa khỏi màn hình bếp                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Thao Tác Cập Nhật Trạng Thái

**Cập Nhật Thành "Đang Chuẩn Bị"**

Khi bạn sẵn sàng bắt đầu nấu:

```
┌─────────────────────────┐
│ #025 - Bàn 7            │
├─────────────────────────┤
│ • Cơm hải sản x1       │
│ • Súp chua cay x2      │
│                         │
│ [✋ Bắt đầu nấu]        │  ← Nhấp nút này
└─────────────────────────┘

Sau Khi Nhấp ↓

┌─────────────────────────┐
│ #025 - Bàn 7  ⏱️ 3:25   │
├─────────────────────────┤
│ • Cơm hải sản x1       │
│ • Súp chua cay x2      │
│                         │
│ [✓ Đánh dấu xong]      │  ← Trạng thái đã cập nhật
└─────────────────────────┘
```

**Cập Nhật Thành "Sẵn Sàng"**

Khi món ăn hoàn thành:

```
Đang chuẩn bị → Sẵn sàng

Các bước:
1. Xác nhận tất cả món đã xong
2. Kiểm tra chất lượng và ngoại hình
3. Nhấp nút "Đánh dấu xong"
4. Thẻ chuyển sang cột "Sẵn sàng"
5. Hệ thống tự động báo nhân viên
```

### Tính Năng Thao Tác Hàng Loạt

**Xử Lý Nhiều Đơn Cùng Lúc**

Khi nhiều đơn có thể chuẩn bị cùng nhau:

```
Chế Độ Chọn Hàng Loạt:

☐ #023 - Cơm rang x2
☑ #024 - Cơm rang x1, Mì xào x1
☑ #025 - Cơm rang x3

[Chọn Tương Tự] [Bắt đầu nấu (2)]
                ↑
            2 đơn đã chọn

Lợi ích:
✓ Tiết kiệm thời gian chuẩn bị
✓ Tăng hiệu suất bếp
✓ Phục vụ đồng thời nhanh hơn
```

---

## 🔄 Xử Lý Nhiều Đơn

### Chiến Lược Xử Lý Đồng Thời

```
┌─────────────────────────────────────────┐
│ Chiến Lược Xử Lý Đơn Thông Minh         │
├─────────────────────────────────────────┤
│                                         │
│  Chiến lược 1: Nhóm theo loại món      │
│  ─────────────────────────             │
│  Món cơm → Nấu cùng nhau               │
│  Món súp → Chuẩn bị đồng thời          │
│  Món nướng → Cùng mẻ                   │
│                                         │
│  Chiến lược 2: Sắp xếp theo thời gian  │
│  ─────────────────────────             │
│  Lâu → Bắt đầu trước                   │
│  (Bít tết)    (15 phút)                │
│            ↓                            │
│  Vừa → Xử lý tiếp                      │
│  (Cơm rang)   (10 phút)                │
│            ↓                            │
│  Nhanh → Chuẩn bị cuối                 │
│  (Salad)      (5 phút)                 │
│                                         │
│  Chiến lược 3: Hợp nhất theo bàn       │
│  ─────────────────────────             │
│  Cùng bàn → Phục vụ cùng lúc           │
│  └─ Tránh chờ đợi từng phần            │
│                                         │
└─────────────────────────────────────────┘
```

### Quản Lý Giờ Cao Điểm

```
Quy Trình Xử Lý Giờ Cao Điểm:

┌─────────────────────────────────┐
│ 12:00-13:00 Cao điểm trưa       │
│ 18:00-20:00 Cao điểm tối        │
├─────────────────────────────────┤
│                                 │
│  Giai đoạn 1: Chuẩn bị (30p)   │
│  ├─ Nguyên liệu thông dụng     │
│  ├─ Gia vị chuẩn bị            │
│  └─ Thiết bị làm nóng          │
│                                 │
│  Giai đoạn 2: Phục vụ nhanh    │
│  ├─ Ưu tiên đơn cũ             │
│  ├─ Nhóm món tương tự          │
│  └─ Giữ nhịp ổn định           │
│                                 │
│  Giai đoạn 3: Dọn dẹp (Sau)    │
│  ├─ Hoàn thành đơn còn lại    │
│  ├─ Vệ sinh trạm làm việc     │
│  └─ Bổ sung nguyên liệu        │
│                                 │
└─────────────────────────────────┘
```

### Mẹo Nâng Cao Hiệu Suất

```
┌─────────────────────────────────────┐
│ Quy Tắc Vàng Hiệu Suất Bếp          │
├─────────────────────────────────────┤
│                                     │
│  1️⃣ Xử Lý Theo Loại                 │
│  └─ Nhóm món giống nhau            │
│                                     │
│  2️⃣ Nấu Song Song                   │
│  └─ Dùng nhiều trạm                │
│                                     │
│  3️⃣ Nguyên Liệu Chuẩn Bị Sẵn        │
│  └─ Món thông dụng sẵn sàng        │
│                                     │
│  4️⃣ Chồng Chéo Thời Gian            │
│  └─ Xử lý đơn khác khi chờ         │
│                                     │
│  5️⃣ Giao Tiếp Rõ Ràng               │
│  └─ Phân công công việc rõ         │
│                                     │
└─────────────────────────────────────┘
```

**Ví dụ: Xử Lý 3 Đơn Đồng Thời**

```
Dòng Thời Gian: 15:00 → 15:15

15:00 → Bắt đầu Bít tết (#020) - 15 phút
15:05 → Bắt đầu Cơm rang (#021) - 10 phút
        ├─ Bít tết tiếp tục nấu
15:10 → Bắt đầu Salad (#022) - 5 phút
        ├─ Bít tết gần xong
        └─ Cơm rang tiếp tục
15:15 → Cả 3 món sẵn sàng ✓

Hiệu suất: 3 món trong 15 phút
          (30 phút nếu tuần tự)
```

---

## ⚡ Quản Lý Ưu Tiên

### Hệ Thống Ưu Tiên Đơn

```
┌─────────────────────────────────────────┐
│ Tiêu Chí Xác Định Ưu Tiên              │
├─────────────────────────────────────────┤
│                                         │
│  🔴 Ưu tiên cao nhất (Cảnh báo đỏ)     │
│  ├─ Chờ > 15 phút                      │
│  ├─ Khách hỏi                          │
│  └─ Mang đi gần giờ lấy                │
│                                         │
│  🟠 Ưu tiên cao (Cam)                  │
│  ├─ Chờ 10-15 phút                     │
│  ├─ Đơn khách VIP                      │
│  └─ Đơn bàn lớn                        │
│                                         │
│  🟡 Ưu tiên trung bình (Vàng)          │
│  ├─ Chờ 5-10 phút                      │
│  └─ Đơn chuẩn                          │
│                                         │
│  🟢 Ưu tiên thấp (Xanh)                │
│  ├─ Vừa đặt (<5 phút)                  │
│  └─ Có thể xử lý sau                   │
│                                         │
└─────────────────────────────────────────┘
```

### Chỉ Báo Trực Quan Ưu Tiên

```
Tự Động Đánh Dấu Hệ Thống:

┌─────────────────────────┐
│ #018 - Bàn 3  🔴 18:32  │  ← Đỏ nhấp nháy (Quá hạn)
├─────────────────────────┤
│ ⚠️ Chờ 18 phút!         │
│                         │
│ • Bít tết x2           │
│ • Salad x2             │
│                         │
│ [🚨 XỬ LÝ NGAY]         │
└─────────────────────────┘

┌─────────────────────────┐
│ #019 - Bàn 5  🟠 12:25  │  ← Cam cảnh báo (Gần hạn)
├─────────────────────────┤
│ Chờ 12 phút             │
│                         │
│ • Mì Ý x1              │
│ • Súp x2               │
│                         │
│ [Bắt đầu nấu]           │
└─────────────────────────┘

┌─────────────────────────┐
│ #020 - Bàn 8  🟢 3:45   │  ← Xanh (Bình thường)
├─────────────────────────┤
│ • Cơm rang x1          │
│ • Nước x1              │
│                         │
│ [Bắt đầu nấu]           │
└─────────────────────────┘
```

### Chiến Lược Điều Chỉnh Linh Hoạt

```
Quy Trình Đánh Giá Tình Huống:

Khi đơn mới đến:
┌─────────────────────────────────┐
│                                 │
│  Đơn mới → Đánh giá mức độ     │
│           ↓                     │
│  Kiểm ──→ Có đơn quá hạn không?│
│           ↓ Có    ↓ Không      │
│  Ưu tiên xử lý   Xếp hàng      │
│           ↓                     │
│  Cân nhắc xử lý hàng loạt      │
│                                 │
└─────────────────────────────────┘
```

---

Vì giới hạn độ dài, tôi sẽ tiếp tục tạo phần còn lại của file. Bạn có muốn tôi hoàn thiện toàn bộ file vi-VN không, hay chỉ cần phần đầu là đủ và tôi tiếp tục với các ngôn ngữ khác?
