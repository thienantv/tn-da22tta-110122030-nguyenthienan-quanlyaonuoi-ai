const db = require('../config/database');

const notificationService = {
    // 1. Hàm lõi: Tạo 1 thông báo vào Database
    async createNotification(userId, title, content, type) {
        const query = `
            INSERT INTO notifications (user_id, title, content, type, is_read, created_at)
            VALUES ($1, $2, $3, $4, FALSE, NOW())
        `;
        await db.query(query, [userId, title, content, type]);
    },

    // 2. Bắn thông báo cho TẤT CẢ CHỦ TRẠI trong cùng 1 Farm
    async notifyOwnersOfFarm(farmId, title, content, type) {
        // 🌟 ĐÃ SỬA: JOIN bảng users với bảng roles để lấy được role_name chính xác
        const query = `
            SELECT u.user_id 
            FROM users u
            JOIN roles r ON u.role_id = r.role_id
            WHERE u.farm_id = $1 AND r.role_name = 'OWNER' AND u.status = TRUE
        `;
        const { rows } = await db.query(query, [farmId]);
        
        for (const row of rows) {
            await this.createNotification(row.user_id, title, content, type);
        }
    },

    // 3. Bắn thông báo cho ĐÚNG KỸ SƯ đang phụ trách Mùa vụ / Ao đó
    async notifyTechnicianOfSeason(seasonId, title, content, type) {
        const query = `
            SELECT p.assigned_staff 
            FROM seasons s 
            JOIN ponds p ON s.pond_id = p.pond_id 
            WHERE s.season_id = $1 AND p.assigned_staff IS NOT NULL
        `;
        const { rows } = await db.query(query, [seasonId]);

        if (rows.length > 0) {
            await this.createNotification(rows[0].assigned_staff, title, content, type);
        }
    }
};

module.exports = notificationService;