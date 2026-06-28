const pool = require('../config/database');

// Hàm này có thể setup chạy bằng node-cron mỗi 10 phút hoặc gọi mỗi khi tải trang danh sách việc
const autoUpdateOverdueTasks = async () => {
  try {
    // Quét những việc trạng thái PENDING hoặc IN_PROGRESS mà đã qua ngày due_date
    const updateQuery = `
      UPDATE tasks 
      SET status = 'OVERDUE', updated_at = NOW() 
      WHERE status IN ('PENDING', 'IN_PROGRESS') 
        AND due_date < NOW()::date
    `;
    await pool.query(updateQuery);
  } catch (error) {
    console.error("Lỗi cập nhật tự động công việc quá hạn:", error.message);
  }
};

module.exports = { autoUpdateOverdueTasks };