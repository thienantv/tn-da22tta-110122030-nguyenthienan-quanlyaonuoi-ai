const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authorize } = require('../middlewares/authorize'); // Đây là đường dẫn đúng 100% của bạn

// Chỉ OWNER (hoặc ADMIN) mới được quyền quản lý dòng tiền
router.get('/', authorize(['OWNER', 'ADMIN']), expenseController.getAllExpenses);
router.post('/', authorize(['OWNER', 'ADMIN']), expenseController.addExpense);

module.exports = router;