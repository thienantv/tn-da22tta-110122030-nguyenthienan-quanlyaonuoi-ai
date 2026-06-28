const logger = require('../utils/logger');
const startTaskCrons = require('./taskCron');
const startUserCrons = require('./userCron');
const startSystemCrons = require('./systemCron');
const notificationCron = require('../services/notificationCron'); // Trỏ đến đường dẫn đúng của bạn

const startAllCronJobs = () => {
    try {
        logger.info('🚀 Đang khởi động hệ thống Cron Jobs...');
        
        startTaskCrons();
        startUserCrons();
        startSystemCrons();
        notificationCron.startAllNotificationJobs();

        logger.info('✅ Tất cả Cron Jobs đã được khởi động thành công!');
    } catch (error) {
        logger.error('❌ Lỗi khi khởi động hệ thống Cron:', error);
    }
};

module.exports = startAllCronJobs;