const cron = require('node-cron');
const db = require('../config/database');
const logger = require('../utils/logger');
const { autoUpdateOverdueTasks } = require('../middlewares/cronTaskJob');

const startTaskCrons = () => {
    // 1. Quét công việc quá hạn (Mỗi phút)
    cron.schedule('* * * * *', async () => {
        logger.info('🕒 [CRON - TASK] Kiểm tra công việc quá hạn...');
        try {
            await autoUpdateOverdueTasks();
        } catch (err) {
            logger.error('❌ Lỗi tiến trình cập nhật quá hạn:', err);
        }
    });

    // 2. Chuyển PENDING -> IN_PROGRESS khi đến giờ (Mỗi phút)
    cron.schedule('* * * * *', async () => { 
        try {
            const updateTasksQuery = `
                UPDATE tasks SET status = 'IN_PROGRESS', updated_at = NOW()
                WHERE status = 'PENDING' AND start_date <= NOW() RETURNING task_id
            `;
            const result = await db.query(updateTasksQuery);
            if (result.rows.length > 0) {
                const taskIds = result.rows.map(r => r.task_id);
                await db.query(`UPDATE task_workers SET status = 'DOING', started_at = NOW() WHERE task_id = ANY($1) AND status = 'ASSIGNED'`, [taskIds]);
                logger.info(`🔄 [CRON - TASK] Đã tự động chuyển ${result.rowCount} công việc sang ĐANG THỰC HIỆN.`);
            }
        } catch (err) {
            logger.error('❌ Lỗi cập nhật trạng thái IN_PROGRESS:', err);
        }
    });
};

module.exports = startTaskCrons;