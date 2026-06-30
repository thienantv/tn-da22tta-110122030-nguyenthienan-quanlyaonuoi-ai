const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incidentController');
const { authenticateToken } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đảm bảo thư mục lưu ảnh tồn tại
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Cấu hình kho lưu trữ ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, 'incident_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

router.use(authenticateToken);

// 🌟 Chèn "upload.single('image')" vào giữa để bắt file ảnh trước khi nhảy vào Controller
router.post('/', upload.single('image'), incidentController.reportIncident);

router.get('/', incidentController.getIncidents);

router.put('/:incidentId/resolve', incidentController.resolveIncident);

module.exports = router;