const cron = require('node-cron');
const logger = require('../utils/logger');
const db = require('../config/database'); // 👈 THÊM DÒNG NÀY: Kết nối Database
const { run: syncSeasonsAndPonds } = require('../../scripts/sync_seasons_and_ponds');

const startSystemCrons = () => {
    // 1. Đồng bộ hệ thống (Script đã có sẵn của bạn)
    const cronExpr = process.env.SYNC_CRON === 'disabled' ? null : (process.env.SYNC_CRON || '*/1 * * * *');
    if (cronExpr) {
        cron.schedule(cronExpr, async () => {
            try {
                await syncSeasonsAndPonds();
            } catch (err) {
                logger.error('❌ Lỗi đồng bộ Mùa vụ & Ao:', err);
            }
        });
        logger.info(`📅 [CRON - SYSTEM] Đồng bộ hệ thống chạy mỗi: ${cronExpr}`);
    }

    // 2. 🌟 THÊM MỚI: Tự động Bắt đầu Mùa vụ khi đến ngày thả tôm
    // Chạy mỗi phút (quét liên tục để nếu người dùng tạo vụ cho ngày hôm nay, nó sẽ kích hoạt ngay)
    cron.schedule('* * * * *', async () => {
        try {
            // Dùng CTE (WITH) để Update Mùa vụ thành ĐANG NUÔI, đồng thời Update luôn Ao tương ứng
            const query = `
                WITH updated_seasons AS (
                    UPDATE seasons 
                    SET status = 'DANG_NUOI'
                    WHERE status = 'CHUAN_BI_NUOI' AND start_date <= NOW() 
                    RETURNING season_id, pond_id
                )
                UPDATE ponds 
                SET status = 'DANG_NUOI' 
                FROM updated_seasons 
                WHERE ponds.pond_id = updated_seasons.pond_id
                RETURNING updated_seasons.season_id;
            `;
            
            const result = await db.query(query);
            
            if (result.rows.length > 0) {
                logger.info(`🚀 [CRON - SYSTEM] Đã tự động chuyển ${result.rows.length} mùa vụ sang ĐANG NUÔI.`);
            }
        } catch (err) {
            logger.error('❌ Lỗi tự động kích hoạt mùa vụ:', err);
        }
    });
};

module.exports = startSystemCrons;