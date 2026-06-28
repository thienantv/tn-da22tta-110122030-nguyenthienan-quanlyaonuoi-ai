const cron = require('node-cron');
const logger = require('../utils/logger');
const userService = require('../services/userService');

const startUserCrons = () => {
    // Gỡ nhân sự bị khóa quá 30 ngày (00:00 hàng ngày)
    cron.schedule('0 0 * * *', async () => {
        logger.info('🕒 [CRON - USER] Dọn dẹp nhân sự bị khóa...');
        try {
            const result = await userService.autoKickLockedUsers(30); 
            if (result.kickedCount > 0) {
                logger.info(`✅ Đã gỡ ${result.kickedCount} nhân sự khỏi trại vì khóa quá hạn.`);
            }
        } catch (err) {
            logger.error('❌ Lỗi dọn dẹp nhân sự:', err);
        }
    });
};

module.exports = startUserCrons;