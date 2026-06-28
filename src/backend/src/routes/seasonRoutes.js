const express = require('express');
const router = express.Router();
const { authorize } = require('../middlewares/authorize');
const { seasonController } = require('../controllers/index'); // Hoặc '../controllers/commonController' tùy kiến trúc thư mục của bạn

// Tất cả người dùng: Lấy danh sách & chi tiết mùa vụ
router.get('/', seasonController.getAllSeasons);
router.get('/:seasonId', seasonController.getSeasonDetail);

// QUẢN LÝ: Tạo và Chỉnh sửa mùa vụ
router.post('/', authorize(['TECHNICIAN', 'OWNER']), seasonController.createSeason);
router.put('/:seasonId', authorize(['TECHNICIAN', 'OWNER']), seasonController.updateSeason);

// 🌟 ĐÂY CHÍNH LÀ 2 API BỊ THIẾU GÂY RA LỖI "TỪ CHỐI TRUY CẬP"
router.patch('/:seasonId/start', authorize(['TECHNICIAN', 'OWNER']), seasonController.startSeason);
router.post('/:seasonId/generate-sop', authorize(['TECHNICIAN', 'OWNER']), seasonController.generateSOP);

// Thu hoạch và Xóa
router.post('/:seasonId/harvest', authorize(['TECHNICIAN', 'OWNER']), seasonController.harvestSeason);
router.delete('/:seasonId', authorize(['TECHNICIAN', 'OWNER']), seasonController.deleteSeason);

module.exports = router;