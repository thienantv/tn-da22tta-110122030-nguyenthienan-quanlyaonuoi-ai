const express = require('express')
const router = express.Router()
const { authorize } = require('../middlewares/authorize')
const pondController = require('../controllers/pondController')

// Tất cả user: Lấy danh sách ao
router.get('/', pondController.getAllPonds)

// OWNER: Lấy ma trận phân công kỹ sư - ao
router.get('/owner/assignment-matrix', authorize(['OWNER']), pondController.getAssignmentMatrix)

// Tất cả user: Lấy chi tiết ao
router.get('/:pondId', pondController.getPondDetail)

// OWNER: Tạo ao mới trong phạm vi trang trại của mình
router.post('/', authorize(['OWNER']), pondController.createPond)

// OWNER: Sửa thông tin ao
router.put('/:pondId', authorize(['OWNER']), pondController.updatePond)

// OWNER: Phân công/hủy phân công kỹ sư phụ trách
router.put('/:pondId/assignment', authorize(['OWNER']), pondController.updateAssignment)

// OWNER: Cập nhật trạng thái sử dụng ao (HOAT_DONG/NGUNG_SU_DUNG)
router.patch('/:pondId/usage-status', authorize(['OWNER']), pondController.updateUsageStatus)

// TECHNICIAN/OWNER: Xác nhận hoàn tất cải tạo ao
router.patch('/:pondId/renovation-complete', authorize(['TECHNICIAN', 'OWNER']), pondController.completeRenovation)

// OWNER: Xóa ao
router.delete('/:pondId', authorize(['OWNER']), pondController.deletePond)

// Trạng thái ao được cập nhật tự động theo nghiệp vụ (không cho chỉnh tay)
router.patch('/:pondId/status', authorize(['OWNER']), pondController.updatePondStatus)

module.exports = router
