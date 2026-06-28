import type { Messages } from "../types";

const viVN: Messages = {
  app: {
    footer: {
      copyright: "© 2024 MakanMakan. Mọi quyền được bảo lưu.",
    },
    tagline: {
      selfHosted: "Tự lưu trữ",
    },
  },
  apply: {
    form: {
      businessName: {
        label: "Tên nhà hàng",
        placeholder: "ví dụ: Bếp Hoàng Gia",
      },
      contactEmail: {
        label: "Email",
        placeholder: "your@email.com",
      },
      contactName: {
        label: "Tên liên hệ",
        placeholder: "Tên của bạn",
      },
      contactPhone: {
        label: "Điện thoại",
        placeholder: "+1-234-567-8900",
      },
      location: {
        failure:
          "Không thể nhận được vị trí hiện tại của bạn. Kiểm tra quyền vị trí hoặc nhập tọa độ theo cách thủ công.",
        help: "Được sử dụng để khám phá chợ đêm / quận và tìm kiếm gần đó. Sử dụng tọa độ mặt tiền cửa hàng hoặc gian hàng thực tế.",
        label: "Vị trí nhà hàng",
        latitudePlaceholder: "Vĩ độ, ví dụ: 24.147736",
        locating: "Đang định vị...",
        longitudePlaceholder: "Kinh độ, ví dụ: 120.673648",
        unsupported:
          "Trình duyệt này không hỗ trợ định vị địa lý. Nhập tọa độ bằng tay.",
        useCurrent: "Sử dụng vị trí hiện tại",
      },
      next: "Tiếp theo",
      subdomain: {
        available: "URL này có sẵn",
        emptyHint: "Để trống để tự động tạo",
        invalidFormat: "Chỉ cho phép chữ cái viết thường, số và dấu gạch nối",
        label: "URL mong muốn (Tùy chọn)",
        placeholder: "nhà hàng của bạn",
        suggestionsLabel: "Các lựa chọn thay thế được đề xuất:",
        taken: "URL này đã được sử dụng",
      },
      submitting: "Đang gửi...",
    },
    title: "Đơn đăng ký",
    toast: {
      submitFailureFallback: "Gửi không thành công. Vui lòng thử lại sau.",
      submitSuccess: "Đơn đăng ký đã được gửi",
    },
    validation: {
      businessNameRequired: "Vui lòng nhập tên nhà hàng",
      contactNameRequired: "Vui lòng nhập tên liên hệ",
      emailInvalid: "Vui lòng nhập email hợp lệ",
      emailRequired: "Vui lòng nhập email",
      latitudeInvalid: "Vĩ độ phải nằm trong khoảng từ -90 đến 90",
      latitudeRequired: "Vui lòng nhập vĩ độ nhà hàng",
      longitudeInvalid: "Kinh độ phải nằm trong khoảng từ -180 đến 180",
      longitudeRequired: "Vui lòng nhập kinh độ của nhà hàng",
      phoneRequired: "Vui lòng nhập số điện thoại",
      subdomainInvalidFormat:
        "Chỉ cho phép chữ cái viết thường, số và dấu gạch nối",
      subdomainTaken: "URL này đã được sử dụng",
      subdomainTooShort: "Phải có ít nhất 3 ký tự",
    },
  },
  common: {
    back: "Quay lại",
    cancel: "Hủy bỏ",
    loading: "Đang tải...",
    submit: "Gửi",
    toast: {
      copiedToClipboard: "Đã sao chép vào bảng nhớ tạm",
    },
  },
  connect: {
    assignedSubdomainLabel: "URL chuyên dụng của bạn:",
    button: {
      complete: "Hoàn thành ứng dụng",
      completing: "Đang xử lý...",
      verify: "Xác minh kết nối",
      verifying: "Đang xác minh...",
    },
    form: {
      accountId: {
        label: "ID tài khoản Cloudflare",
        placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      },
      apiToken: {
        label: "Mã thông báo API",
        placeholder: "•··················································",
      },
    },
    help: {
      linkText: "Liên hệ với chúng tôi để có video hướng dẫn",
      prompt: "Cần giúp đỡ?",
    },
    info: {
      description:
        "MakanMakan chạy trên tài khoản Cloudflare của riêng bạn, đảm bảo bạn có toàn quyền kiểm soát dữ liệu của mình. Chi phí tài nguyên được bao gồm trong đăng ký của bạn.",
      title: "Tại sao bạn cần tài khoản Cloudflare?",
    },
    permissions: {
      pagesOptional: "Trang (Tùy chọn)",
      titleSuccess: "Đã vượt qua kiểm tra quyền",
      titleWarning: "Kết quả kiểm tra quyền",
    },
    steps: {
      heading: "Các bước:",
      step1Prefix: "Đi tới",
      step1Suffix: "(đăng ký trước nếu bạn chưa có tài khoản)",
      step2:
        'Nhấp vào hình đại diện ở trên cùng bên phải → chọn "Hồ sơ của tôi"',
      step3ClipboardText:
        "ID tài khoản nằm ở thanh bên phải của Bảng điều khiển",
      step3Prefix: "Sao chép của bạn",
      step4: 'Chuyển đến "Mã thông báo API" → nhấp vào "Tạo mã thông báo"',
      step5: 'Chọn mẫu "Chỉnh sửa công nhân Cloudflare"',
      step6: "Sao chép mã thông báo API đã tạo",
    },
    title: "Kết nối tài khoản Cloudflare",
    toast: {
      completeFailureFallback:
        "Không thể hoàn tất đơn đăng ký. Vui lòng thử lại sau.",
      completeSuccess: "Ứng dụng đã hoàn tất!",
      verifyFailureFallback:
        "Xác minh không thành công. Vui lòng kiểm tra thông tin chi tiết của bạn.",
      verifySuccess: "Tài khoản Cloudflare đã được xác minh!",
    },
    validation: {
      accountIdLength: "ID tài khoản phải có 32 ký tự",
      accountIdRequired: "Vui lòng nhập ID tài khoản",
      apiTokenFormat: "Định dạng mã thông báo API không hợp lệ",
      apiTokenRequired: "Vui lòng nhập mã thông báo API",
    },
    verifiedMessage: "Tài khoản Cloudflare được kết nối thành công!",
  },
  home: {
    cta: {
      button: "Bắt đầu ứng dụng",
      subtitle:
        "Điền vào đơn đăng ký và chúng tôi sẽ liên hệ với bạn trong vòng 24 giờ.",
      title: "Sẵn sàng để bắt đầu?",
    },
    features: {
      fast: {
        description: "Đường ống triển khai tự động. Sống trong vòng 24 giờ.",
        title: "Triển khai nhanh",
      },
      isolated: {
        description:
          "Môi trường đám mây bị cô lập hoàn toàn. Dữ liệu của bạn là của bạn 100%.",
        title: "Môi trường biệt lập",
      },
      secure: {
        description:
          "Được xây dựng trên mạng biên toàn cầu của Cloudflare với tính năng bảo mật cấp doanh nghiệp.",
        title: "An toàn & đáng tin cậy",
      },
    },
    hero: {
      ctaApply: "Đăng ký ngay",
      ctaDemo: "Xem bản trình diễn →",
      subtitle: "Tự lưu trữ · Dữ liệu an toàn · Khởi chạy sau 24 giờ",
      titleLine1: "Xây dựng nhà hàng của bạn",
      titleLine2: "Hệ thống quản lý chuyên dụng",
    },
  },
  plans: {
    enterprise: "Doanh nghiệp",
    professional: "chuyên nghiệp",
    standard: "Tiêu chuẩn",
  },
  success: {
    button: {
      backHome: "Quay lại trang chủ",
      goToAdmin: "Đi tới Bảng điều khiển dành cho quản trị viên",
    },
    contact: {
      prompt: "Có câu hỏi nào không? Liên hệ",
    },
    nextSteps: {
      deploy: {
        description:
          "Hệ thống chuyên dụng của bạn đang được triển khai, thường trong vòng vài phút. Chi tiết đăng nhập sẽ được gửi khi sẵn sàng.",
        title: "Triển khai hệ thống",
      },
      email: {
        prefix: "Chúng tôi đã gửi email xác nhận tới",
        suffix: ". Vui lòng kiểm tra hộp thư đến của bạn.",
        title: "Email xác nhận",
      },
      start: {
        description:
          "Sau khi nhận được thông tin đăng nhập, bạn có thể truy cập ngay vào bảng điều khiển quản trị và bắt đầu định cấu hình nhà hàng của mình.",
        title: "Bắt đầu",
      },
      title: "Điều gì xảy ra tiếp theo?",
    },
    subtitleLine1:
      "Xin chúc mừng! Quá trình triển khai MakanMakan của bạn đã được tạo.",
    subtitleLine2: "Hệ thống đang chuẩn bị môi trường chuyên dụng của bạn.",
    summary: {
      applicationId: "ID ứng dụng",
      businessName: "Tên nhà hàng",
      cloudflare: "Lưu trữ nền tảng",
      connected: "Đã bật",
      contactEmail: "Email liên hệ",
      plan: "Kế hoạch đã chọn",
      subdomain: "URL chuyên dụng",
      tenantId: "ID người thuê",
      title: "Tóm tắt ứng dụng",
    },
    title: "Ứng dụng hoàn tất!",
  },
};

export default viVN;
