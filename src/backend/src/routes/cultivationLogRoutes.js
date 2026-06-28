const express = require('express')
const router = express.Router()
const { authorize } = require('../middlewares/authorize')
const { cultivationLogController } = require('../controllers/index')


// Tất cả: Lấy nhật ký canh tác theo mùa vụ
router.get('/season/:seasonId', cultivationLogController.getCultivationLogsBySeasonId)

// Tất cả: Lấy nhật ký canh tác theo ao
router.get('/pond/:pondId', cultivationLogController.getCultivationLogsByPondId)

// Tất cả: Lấy chi tiết nhật ký canh tác
router.get('/:logId', cultivationLogController.getCultivationLogDetail)

// WORKER: Ghi nhật ký canh tác cho ao được phân công
router.post('/', authorize(['WORKER']), cultivationLogController.createCultivationLog)

// OWNER: Duyệt nhật ký canh tác
router.post('/:logId/approve', authorize(['OWNER']), cultivationLogController.approveCultivationLog)

// OWNER: Từ chối nhật ký canh tác
router.post('/:logId/reject', authorize(['OWNER']), cultivationLogController.rejectCultivationLog)

// OWNER: Khóa nhật ký theo ngày
router.post('/season/:seasonId/lock-date', authorize(['OWNER']), cultivationLogController.lockDateLogs)

module.exports = router
