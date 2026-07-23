# 🦐 Smart Shrimp Farming Management (Hệ thống Quản lý Nuôi Tôm Thông minh)

![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.0.16-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-Framework-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini AI](https://img.shields.io/badge/Google_Gemini-AI_Diagnostic-4285F4?style=for-the-badge)

Một giải pháp toàn diện giúp số hóa và tự động hóa quy trình quản lý trang trại nuôi tôm quy mô lớn. Hệ thống bao quát toàn bộ chu kỳ: từ việc lên kế hoạch mùa vụ, phân công công việc (SOP), quản lý kho vật tư, đến việc ứng dụng Trí tuệ nhân tạo (AI) để chẩn đoán bệnh tôm và cảnh báo sự cố theo thời gian thực.

---

## ✨ Tính năng nổi bật

### 👥 Phân quyền chặt chẽ (RBAC)
- **Chủ trại (Owner):** Theo dõi tổng quan (Dashboard), quản lý danh mục, thiết lập Mùa vụ chung (Master Season), duyệt yêu cầu thu hoạch, phân công Kỹ sư.
- **Kỹ sư (Technician):** Lên lịch thả giống, tạo Kịch bản SOP tự động, phân công việc (Ma trận) cho Công nhân, xử lý báo động khẩn cấp, nghiệm thu công việc.
- **Công nhân (Worker):** Nhận việc qua danh sách hiển thị cá nhân, báo cáo hoàn thành, chụp ảnh và phát báo động sự cố (Incident Report).

### 🔄 Quản lý Vòng đời & Mùa vụ (Lifecycle Management)
- Thiết lập Master Seasons để quy hoạch giới hạn thời gian mở/đóng vụ toàn trại.
- Quản lý trạng thái ao nuôi (Chuẩn bị nuôi -> Đang nuôi -> Đang xử lý -> Tạm ngưng) tuân thủ tính logic về thời gian.

### 🤖 SOP Engine & Tự động hóa
- Tự động sinh hàng loạt công việc (Tasks) theo Kịch bản chuẩn (SOP Template).
- Tích hợp **Google Gemini AI** (`@google/generative-ai`) giúp phân tích hình ảnh và chẩn đoán bệnh tôm từ báo cáo khẩn cấp của công nhân.

### 📊 Ma trận Phân công (Task Matrix)
- Giao việc nhanh chóng cho nhiều công nhân trên nhiều ao cùng lúc (hệ ma trận).
- Tự động tính toán hạn chót (Due Date), chống trùng lặp lịch biểu.

### 📦 Quản lý Kho & Chi phí Tự động
- Tích hợp xuất kho vật tư ngay trong form giao việc.
- Tự động hạch toán chi phí (tính tiền) vào sổ cái khi toàn bộ nhân sự xác nhận hoàn thành công việc.

### 🔔 Cảnh báo Thời gian thực
- Ứng dụng `Socket.io` đẩy thông báo ngay lập tức khi có sự cố, quá hạn công việc hoặc yêu cầu khẩn cấp.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

### Frontend (Client)
- **Core:** React 18, React Router v6
- **Build Tool:** Vite
- **Styling:** Tailwind CSS, PostCSS, Autoprefixer
- **Charts & Dashboard:** Recharts, Chart.js (`react-chartjs-2`)
- **Icons:** React Icons
- **Validation:** Ajv

### Backend (Server)
- **Core:** Node.js, Express.js
- **Database:** PostgreSQL (`pg`)
- **Authentication & Security:** JWT (`jsonwebtoken`), Bcrypt (`bcryptjs`), Helmet, CORS, Validator.
- **File & Media:** Multer (xử lý upload ảnh), Form-Data.
- **AI Integration:** Google Generative AI (Gemini).
- **Real-time & Cron:** Socket.io, Node-cron.
- **Mailing:** Nodemailer (Gửi email báo cáo/cảnh báo).

---

## ⚙️ Hướng dẫn cài đặt (Installation)

### 1. Yêu cầu hệ thống (Prerequisites)
- Node.js (v18.x hoặc cao hơn)
- PostgreSQL (v12 hoặc cao hơn)
- Git

### 2. Cài đặt Backend
Di chuyển vào thư mục backend và cài đặt thư viện:
```bash
cd backend
npm install