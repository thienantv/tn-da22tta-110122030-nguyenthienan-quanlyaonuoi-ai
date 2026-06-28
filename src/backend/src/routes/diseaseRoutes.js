const express = require('express');
const router = express.Router();
const diseaseController = require('../controllers/diseaseController');
const { authorize } = require('../middlewares/authorize')
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Kiểm tra và tạo thư mục uploads nếu chưa có
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Cấu hình Multer để nhận và lưu ảnh từ React gửi lên
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Lưu vào thư mục uploads ở gốc backend
  },
  filename: function (req, file, cb) {
    // Đổi tên file để không bị trùng (thêm timestamp)
    cb(null, 'shrimp_' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn ảnh 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ cho phép tải lên định dạng hình ảnh!'));
        }
    }
});

// ==========================================
// ĐỊNH NGHĨA CÁC ROUTE API CHO AI
// ==========================================

// Gắn thêm camera kiểm tra ngay trước khi nhận ảnh
router.post('/predict', 
    (req, res, next) => {
        console.log("👉 Đã tìm đúng Route /predict, chuẩn bị cho Multer nhận ảnh...");
        next();
    },
    upload.single('image'), 
    diseaseController.predictDisease
);

router.get('/history', diseaseController.getPredictionHistory);

module.exports = router;