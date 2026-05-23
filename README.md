# 🌐 TransTTS - Chrome & Cốc Cốc Translation & TTS Extension

> Tiện ích mở rộng chuyên nghiệp dịch thuật thông minh và phát âm AI Neural chất lượng cao trực tiếp trên mọi trang web. Thiết kế giao diện hiện đại, bo góc mềm mại, hỗ trợ Dark/Light mode và cấu hình dịch thuật AI (Gemini).

---

## ✨ Tính năng nổi bật (Key Features)

*   **🔍 Dịch thuật bôi đen (Highlight Translation):** Chỉ cần bôi đen một đoạn văn bản bất kỳ trên website, một nút bấm thông minh sẽ xuất hiện ngay cạnh con trỏ để dịch nhanh. Có thể bật chế độ tự động hiện cửa sổ dịch.
*   **🎙️ Phát âm AI Neural cao cấp (Google Neural TTS):** Tích hợp công nghệ phát âm tự nhiên của Google Translate, đọc chuẩn từ ngữ, không bị dính chữ hay phát âm robot như các giọng đọc mặc định của hệ điều hành.
*   **🔄 Trình nghe nhạc điều khiển giọng đọc:** Hỗ trợ Play, Pause, Resume, Stop, điều chỉnh tốc độ phát âm (Speed), âm lượng (Volume) theo thời gian thực cùng với hiệu ứng sóng âm động (Waveform Animation).
*   **🤖 Bộ máy dịch thuật kép (Dual Engine):** 
    *   *Google Translate*: Dịch tự động, hoàn toàn miễn phí, tự nhận diện ngôn ngữ nguồn.
    *   *Gemini AI (Gemini 2.5 Flash)*: Dịch thuật ngữ cảnh thông minh và tự nhiên bằng mô hình AI nếu cấu hình API Key.
*   **📜 Lịch sử dịch thuật (Translation History):** Tự động lưu trữ lịch sử các đoạn văn bản đã dịch, hỗ trợ tìm kiếm, sao chép nhanh và xóa lịch sử.
*   **🌓 Giao diện SaaS Glassmorphism:** Thiết kế tối giản, hỗ trợ chế độ Thu nhỏ (Mini mode), Ghim cố định vị trí (Pin), và chuyển đổi chế độ sáng tối (Dark/Light mode) đồng bộ.
*   **🛡️ Cách ly mã nguồn (Shadow DOM):** Bảo vệ giao diện của Extension khỏi bị ảnh hưởng bởi CSS của trang web đích, tránh xung đột hiển thị.

---

## 🛠️ Hướng dẫn cài đặt vào trình duyệt (Installation Guide)

1.  **Tải mã nguồn:** Tải toàn bộ thư mục tiện ích mở rộng về máy tính của bạn.
2.  **Mở trang quản lý Tiện ích:**
    *   Trên **Chrome**: Nhập đường dẫn `chrome://extensions/` vào thanh địa chỉ.
    *   Trên **Cốc Cốc**: Nhập đường dẫn `coccoc://extensions/` vào thanh địa chỉ.
3.  **Bật chế độ nhà phát triển:** Gạt thanh **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải trang sang trạng thái **Bật**.
4.  **Tải tiện ích lên:** Nhấp vào nút **Load unpacked (Tải tiện ích đã giải nén)** ở góc trên bên trái, sau đó chọn thư mục chứa mã nguồn của dự án này.
5.  **Ghim tiện ích:** Nhấp vào biểu tượng mảnh ghép trên thanh công cụ của trình duyệt và chọn ghim **TransTTS** để tiện sử dụng.

---

## 📁 Cấu trúc thư mục dự án (Project Directory)

```
chrome-coccoc-extension/
├── manifest.json       # Manifest V3 cấu hình Extension
├── background.js      # Service Worker xử lý trung gian API dịch/TTS & cache
├── content.js         # Script tạo giao diện Shadow DOM trên trang web & xử lý TTS
├── content.css        # CSS giao diện popup Shadow DOM dịch thuật
├── popup.html         # Bảng điều khiển khi click icon ở thanh công cụ
├── popup.js           # Xử lý sự kiện và đồng bộ cài đặt của bảng điều khiển
├── popup.css          # CSS của bảng điều khiển chính
├── icons/             # Thư mục chứa các icon tiêu chuẩn (16x16, 48x48, 128x128)
└── scripts/           # Công cụ hỗ trợ tạo icon và giải nén
```

---

## 🚀 Hướng dẫn đẩy dự án lên GitHub / Git (Git Publishing Guide)

Hãy thực hiện theo các bước sau để lưu trữ và chia sẻ mã nguồn tiện ích mở rộng lên kho chứa Git của bạn (ví dụ: GitHub):

### Bước 1: Khởi tạo Git trong thư mục dự án
Mở terminal (PowerShell hoặc CMD) tại thư mục `chrome-coccoc-extension` và chạy lệnh sau để khởi tạo kho chứa Git cục bộ:
```bash
git init
```

### Bước 2: Tạo tệp `.gitignore` (Không đẩy tệp cấu hình API key cá nhân)
Tạo một tệp có tên `.gitignore` trong thư mục gốc của dự án và dán nội dung sau để tránh vô tình đẩy tệp rác lên Git:
```text
# Folder chứa script phụ trợ
scripts/icon_b64.txt
scripts/*.ps1

# Hệ thống và trình duyệt
.DS_Store
Thumbs.db
```

### Bước 3: Đưa toàn bộ tệp tin vào khu vực chuẩn bị (Staging)
```bash
git add .
```

### Bước 4: Tạo phiên bản cam kết đầu tiên (Commit)
```bash
git commit -m "Initial commit - Hoàn thành TransTTS Extension dịch thuật và phát âm AI"
```

### Bước 5: Liên kết với kho chứa từ xa trên GitHub
1.  Truy cập vào trang [GitHub](https://github.com/) của bạn và tạo một Repository mới (ví dụ đặt tên là `trans-tts-extension`).
2.  Sau khi tạo, copy đường dẫn Git của kho chứa đó (ví dụ: `https://github.com/username/trans-tts-extension.git`).
3.  Liên kết Git cục bộ với GitHub bằng lệnh:
    ```bash
    git remote add origin https://github.com/username/trans-tts-extension.git
    ```

### Bước 6: Đẩy mã nguồn lên nhánh chính (Main)
```bash
# Đổi tên nhánh mặc định thành main (nếu chưa có)
git branch -M main

# Đẩy code lên nhánh main
git push -u origin main
```

---

## 📝 Thông tin tác giả & Bản quyền

Dự án được lên ý tưởng và thiết kế bởi **Antigravity AI**.
Được phân phối theo giấy phép MIT. Xem tệp `LICENSE` để biết thêm thông tin.
