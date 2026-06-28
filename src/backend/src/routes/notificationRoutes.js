const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middlewares/auth');

router.use(authenticateToken);
router.get('/', notificationController.getMyNotifications);
router.put('/:notificationId/read', notificationController.markAsRead);

module.exports = router;