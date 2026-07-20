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

// Bơm dữ liệu & Bắt đầu vụ
router.patch('/:seasonId/start', authorize(['TECHNICIAN', 'OWNER']), seasonController.startSeason);
router.post('/:seasonId/generate-sop', authorize(['TECHNICIAN', 'OWNER']), seasonController.generateSOP);

// =========================================================================
// 2 API MỚI VỪA ĐƯỢC BỔ SUNG (XIN PHÉP VÀ DUYỆT THU HOẠCH)
// =========================================================================
router.post('/:seasonId/request-harvest', authorize(['TECHNICIAN', 'OWNER']), seasonController.requestHarvest);
router.post('/:seasonId/review-harvest', authorize(['OWNER']), seasonController.reviewHarvestRequest);

// Thu hoạch và Xóa
router.post('/:seasonId/harvest', authorize(['TECHNICIAN', 'OWNER']), seasonController.harvestSeason);
router.delete('/:seasonId', authorize(['TECHNICIAN', 'OWNER']), seasonController.deleteSeason);

router.get('/master/all', authorize(['OWNER', 'TECHNICIAN']), seasonController.getAllMasterSeasons);
router.post('/master', authorize(['OWNER']), seasonController.createMasterSeason);
router.put('/master/:id', authorize(['OWNER']), seasonController.updateMasterSeason);
router.delete('/master/:id', authorize(['OWNER']), seasonController.deleteMasterSeason);

module.exports = router;