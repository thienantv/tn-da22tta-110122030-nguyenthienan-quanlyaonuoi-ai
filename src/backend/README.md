# Backend - Hệ Thống Quản Lý Ao Tôm Thông Minh

## Cấu trúc dự án

```
backend/
├── src/
│   ├── config/        # Cấu hình database
│   ├── controllers/   # Business logic - xử lý request
│   ├── middlewares/   # Authentication, Authorization, Error handling
│   ├── routes/        # API endpoints
│   ├── services/      # Database queries, business logic
│   ├── utils/         # Helper functions
│   ├── app.js         # Express app configuration
│   └── server.js      # Server entry point
├── package.json
├── .env.example       # Environment variables template
└── README.md
```

## Cài đặt

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Tạo file `.env`:**
   ```bash
   cp .env.example .env
   ```
   
   Chỉnh sửa `.env` với các thông số của bạn:
   ```
   PORT=3000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=shrimp_db
   DB_USER=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your_secret_key
   ```

3. **Khởi tạo database:**
   ```bash
   psql -U postgres -f ../shrimp_db.sql
   ```

## Chạy server

**Development (với hot reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server sẽ chạy trên `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/refresh-token` - Làm mới token

### User Management (Admin)
- `GET /api/users` - Lấy danh sách users
- `GET /api/users/me` - Lấy thông tin user hiện tại
- `PUT /api/users/:userId/lock` - Khóa tài khoản
- `PUT /api/users/:userId/unlock` - Mở khóa tài khoản
- `POST /api/users/:userId/reset-password` - Reset mật khẩu
- `POST /api/users/change-password` - Đổi mật khẩu

### Pond Management
- `GET /api/ponds` - Lấy danh sách ao
- `GET /api/ponds/:pondId` - Lấy chi tiết ao
- `POST /api/ponds` - Tạo ao mới
- `PUT /api/ponds/:pondId` - Sửa ao
- `PATCH /api/ponds/:pondId/status` - Cập nhật trạng thái ao
- `DELETE /api/ponds/:pondId` - Xóa ao

### Season Management
- `GET /api/seasons` - Lấy danh sách mùa vụ
- `GET /api/seasons/:seasonId` - Lấy chi tiết mùa vụ
- `POST /api/seasons` - Tạo mùa vụ
- `PUT /api/seasons/:seasonId` - Sửa mùa vụ
- `POST /api/seasons/:seasonId/harvest` - Kết thúc mùa vụ

### Product Management
- `GET /api/inventory/products` - Lấy danh sách sản phẩm
- `GET /api/inventory/products/:productId` - Lấy chi tiết sản phẩm
- `POST /api/inventory/products` - Tạo sản phẩm (Storekeeper/Admin)
- `PUT /api/inventory/products/:productId` - Sửa sản phẩm (Storekeeper/Admin)
- `DELETE /api/inventory/products/:productId` - Xóa sản phẩm (Storekeeper/Admin)

### Feed Logs
- `POST /api/feed-logs` - Ghi nhật ký cho ăn
- `GET /api/feed-logs/season/:seasonId` - Lấy nhật ký theo mùa vụ
- `PUT /api/feed-logs/:feedLogId` - Sửa nhật ký cho ăn

### Cultivation Logs
- `POST /api/cultivation-logs` - Ghi nhật ký canh tác
- `GET /api/cultivation-logs/season/:seasonId` - Lấy nhật ký canh tác

### Environment Logs
- `POST /api/environment-logs` - Nhập chỉ số môi trường
- `GET /api/environment-logs/season/:seasonId` - Lấy chỉ số môi trường
- `GET /api/environment-logs/season/:seasonId/latest` - Lấy chỉ số mới nhất

### Tasks
- `GET /api/tasks` - Lấy danh sách công việc
- `POST /api/tasks` - Tạo công việc (Owner/Admin)
- `GET /api/tasks/assigned-to-me` - Lấy công việc được giao
- `PATCH /api/tasks/:taskId/status` - Cập nhật trạng thái công việc
- `POST /api/tasks/:taskId/upload-image` - Upload hình ảnh hoàn thành

### Expenses
- `POST /api/expenses` - Ghi nhận chi phí
- `GET /api/expenses/season/:seasonId` - Lấy chi phí theo mùa vụ
- `GET /api/expenses/season/:seasonId/category/:categoryId` - Lấy chi phí theo hạng mục
- `GET /api/expenses/season/:seasonId/stats` - Thống kê chi phí
- `PUT /api/expenses/:expenseId` - Sửa chi phí
- `DELETE /api/expenses/:expenseId` - Xóa chi phí

### Sensors
- `GET /api/sensors/pond/:pondId` - Lấy cảm biến theo ao
- `GET /api/sensors/:sensorId/readings` - Lấy dữ liệu cảm biến
- `GET /api/sensors/:sensorId/readings/range` - Lấy dữ liệu theo thời gian
- `POST /api/sensors` - Tạo cảm biến (Admin)
- `PUT /api/sensors/:sensorId` - Sửa cảm biến (Admin)
- `POST /api/sensors/:sensorId/readings` - Tạo dữ liệu cảm biến

### Notifications
- `GET /api/notifications` - Lấy thông báo của user
- `PUT /api/notifications/:notificationId/read` - Đánh dấu đã đọc
- `DELETE /api/notifications/:notificationId` - Xóa thông báo
- `DELETE /api/notifications` - Xóa tất cả thông báo

### Diseases
- `GET /api/diseases` - Lấy danh sách bệnh
- `GET /api/diseases/:diseaseId` - Lấy chi tiết bệnh
- `POST /api/diseases/upload-image` - Upload hình ảnh tôm bệnh (Worker)
- `GET /api/diseases/predictions/:imageId` - Lấy kết quả dự đoán
- `POST /api/diseases` - Tạo loại bệnh (Admin)
- `PUT /api/diseases/:diseaseId` - Sửa loại bệnh (Admin)

### Admin Reports
- `GET /api/admin/users` - Lấy danh sách users
- `GET /api/admin/users/:userId/login-logs` - Xem lịch sử đăng nhập
- `GET /api/admin/stats/overview` - Thống kê hệ thống
- `GET /api/admin/stats/users` - Thống kê users
- `GET /api/admin/stats/ponds` - Thống kê ao
- `GET /api/admin/stats/seasons` - Thống kê mùa vụ
- `GET /api/admin/reports/production` - Báo cáo sản xuất
- `GET /api/admin/reports/financial` - Báo cáo tài chính
- `GET /api/admin/reports/health` - Báo cáo sức khỏe
- `POST /api/admin/backup` - Tạo backup

## Role-based Access Control

**ADMIN (Quản trị hệ thống):**
- Quản lý user, cấp quyền
- Quản lý danh mục hệ thống
- Xem toàn bộ dữ liệu
- Tạo backup, thống kê toàn hệ

**OWNER (Chủ trại):**
- Quản lý ao, mùa vụ
- Ghi chi phí, công việc
- Xem dữ liệu ao trong quản lý

**WORKER (Công nhân):**
- Ghi nhật ký canh tác
- Cập nhật chỉ số môi trường
- Thực hiện công việc được giao
- Xem dữ liệu ao được phân công

## Authentication

Tất cả API (ngoại trừ `/api/auth/*`) yêu cầu JWT token:

```
Authorization: Bearer <token>
```

Token được lấy từ login endpoint và có hiệu lực 7 ngày (có thể thay đổi qua `.env`).

## WebSocket Events

Server hỗ trợ real-time updates qua Socket.IO:

- `join_pond` - Tham gia một ao (nhận update realtime)
- `leave_pond` - Rời khỏi ao
- `subscribe_alerts` - Đăng ký nhận cảnh báo

## Notes

- Database schema tại: `../shrimp_db.sql`
- Tất cả endpoints trả về JSON response có cấu trúc:
  ```json
  {
    "success": true/false,
    "data": {},
    "message": "..."
  }
  ```
- Error handling tập trung tại middleware `errorHandler`
- Logging tất cả activities qua `logger` utility

## Development

- Sử dụng nodemon để auto-reload khi có thay đổi file
- Debug bằng `console.log()` hoặc logger utility
- Kiểm tra lỗi database connection tại `src/config/database.js`

## TODO - Features cần implement

1. Upload file (feed logs, task images, disease images)
2. AI Disease prediction integration
3. Email notifications
4. Backup/Restore functionality
5. Advanced filtering và pagination
6. Report generation (PDF export)
7. Charts & Visualization APIs
8. Data validation schemas
9. Rate limiting
10. Request logging & analytics
