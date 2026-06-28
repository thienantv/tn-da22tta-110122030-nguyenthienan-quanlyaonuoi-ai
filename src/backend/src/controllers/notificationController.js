const pool = require('../config/database');

const notificationController = {
  // Lấy thông báo của user đang đăng nhập
  getMyNotifications: async (req, res) => {
    try {
      const userId = req.user.user_id;
      const { rows } = await pool.query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 
         ORDER BY is_read ASC, created_at DESC 
         LIMIT 50`,
        [userId]
      );
      return res.status(200).json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi tải thông báo", error: error.message });
    }
  },

  // Đánh dấu đã đọc
  markAsRead: async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.user_id;
      
      await pool.query(
        `UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND user_id = $2`,
        [notificationId, userId]
      );
      return res.status(200).json({ success: true, message: "Đã đọc" });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi cập nhật", error: error.message });
    }
  }
};

module.exports = notificationController;