const db = require('../config/database');
const notificationService = require('../services/notificationService');

const incidentController = {
    async reportIncident(req, res) {
        try {
            const { pondId, description } = req.body;
            const workerId = req.user.user_id;
            const farmId = req.user.farm_id;
            const workerName = req.user.full_name;

            // 🌟 Tự động lấy tên file ảnh do Multer vừa lưu
            const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

            // 1. Lưu vào Database
            const result = await db.query(
                `INSERT INTO incident_reports (farm_id, pond_id, reported_by, description, image_url) 
         VALUES ($1, $2, $3, $4, $5) RETURNING incident_id`,
                [farmId, pondId, workerId, description, imageUrl]
            );
            const incidentId = result.rows[0].incident_id;

            // 2. Lấy thông tin Ao & Kỹ sư
            const pondRes = await db.query('SELECT pond_name, assigned_staff FROM ponds WHERE pond_id = $1', [pondId]);
            const pondName = pondRes.rows[0]?.pond_name || 'Ao không xác định';
            const technicianId = pondRes.rows[0]?.assigned_staff;

            // 3. Bắn thông báo Alert
            const alertTitle = `🚨 BÁO ĐỘNG KHẨN: Sự cố tại ${pondName}`;
            const alertContent = `Công nhân ${workerName} báo cáo: "${description}". Vui lòng kiểm tra ngay!`;

            if (technicianId) {
                await notificationService.createNotification(technicianId, alertTitle, alertContent, 'ESCALATION_ALERT', incidentId);
            }
            await notificationService.notifyOwnersOfFarm(farmId, alertTitle, alertContent, 'ESCALATION_ALERT');

            res.status(201).json({ success: true, message: 'Đã gửi báo cáo khẩn cấp!' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Lấy danh sách báo cáo sự cố (Kỹ sư & Chủ trại)
    async getIncidents(req, res) {
        try {
            const role = String(req.user.role || req.user.role_name).toUpperCase();
            let query = `
        SELECT i.*, p.pond_name, u.full_name as reporter_name
        FROM incident_reports i
        JOIN ponds p ON i.pond_id = p.pond_id
        JOIN users u ON i.reported_by = u.user_id
        WHERE i.farm_id = $1
      `;
            const params = [req.user.farm_id];

            // Nếu là Kỹ sư, chỉ xem báo cáo của những ao mình quản lý
            if (role === 'TECHNICIAN') {
                query += ` AND p.assigned_staff = $2`;
                params.push(req.user.user_id);
            }

            query += ` ORDER BY i.created_at DESC`;

            const { rows } = await db.query(query, params);
            res.json({ success: true, data: rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // Kỹ sư đánh dấu sự cố đã được giải quyết
    async resolveIncident(req, res) {
        try {
            const { incidentId } = req.params;
            const userId = req.user.user_id;

            const result = await db.query(
                `UPDATE incident_reports 
         SET status = 'RESOLVED', resolved_by = $1, resolved_at = NOW() 
         WHERE incident_id = $2 RETURNING *`,
                [userId, incidentId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy sự cố' });
            }

            res.json({ success: true, message: 'Đã đánh dấu xử lý sự cố thành công' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
};
module.exports = incidentController;