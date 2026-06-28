const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken } = require('../middlewares/auth');

// Tất cả các route dưới đây đều yêu cầu Kỹ sư đăng nhập
router.use(authenticateToken);

router.get('/', taskController.getAllTasks);

// 1. Lấy danh sách ao lọc thông minh theo loại công việc
router.get('/ponds-by-type', taskController.getPondsForTask);

// 2. Lấy danh sách Worker thuộc quyền quản lý và kiểm tra trạng thái bận/rảnh
router.get('/workers-status', taskController.getWorkersStatus);

// 3. Tạo mới và phân công công việc
router.post('/create', taskController.createTask);

// 4. Xác nhận hoàn thành công việc (Cập nhật trạng thái + Hạch toán chi phí kho)
router.post('/:taskId/complete', taskController.completeTask);

// 5. Hủy công việc
router.put('/:taskId/cancel', taskController.cancelTask);

// 6. Chỉnh sửa công việc
router.put('/:taskId', taskController.updateTask);

// 7. Xóa công việc
router.delete('/:taskId', taskController.deleteTask);

module.exports = router;