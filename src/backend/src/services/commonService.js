const db = require('../config/database')
const logger = require('../utils/logger')

const seasonService = {
  async getAllSeasons({ pondId = null, userId, role, farmId = null }) {
    try {
      let query = `
        SELECT s.*, p.pond_name, p.pond_code, p.assigned_staff, u.full_name AS technician_name,
          CASE WHEN s.actual_harvest IS NOT NULL THEN GREATEST((s.actual_harvest::date - s.start_date::date), 0)
               ELSE GREATEST((CURRENT_DATE - s.start_date::date), 0) END AS total_days,
          (SELECT COUNT(task_id) FROM tasks t WHERE t.season_id = s.season_id) AS task_count
        FROM seasons s INNER JOIN ponds p ON p.pond_id = s.pond_id LEFT JOIN users u ON u.user_id = p.assigned_staff
      `
      const params = []
      let paramCount = 0

      if (role === 'OWNER' && farmId) {
        query += ' WHERE p.farm_id = $' + (++paramCount); params.push(farmId)
        if (pondId) { query += ' AND s.pond_id = $' + (++paramCount); params.push(pondId) }
      } else if (role === 'TECHNICIAN') {
        query += ' WHERE p.farm_id = $' + (++paramCount); params.push(farmId)
        query += ' AND p.assigned_staff = $' + (++paramCount); params.push(userId)
        if (pondId) { query += ' AND s.pond_id = $' + (++paramCount); params.push(pondId) }
      } else if (role === 'WORKER') {
        query += ' WHERE p.farm_id = $' + (++paramCount); params.push(farmId)
        query += ' AND (p.assigned_staff = $' + (++paramCount) + ' OR EXISTS (SELECT 1 FROM technician_workers tw WHERE tw.technician_id = p.assigned_staff AND tw.worker_id = $' + paramCount + '))'
        params.push(userId)
        if (pondId) { query += ' AND s.pond_id = $' + (++paramCount); params.push(pondId) }
      } else if (pondId) {
        query += ' WHERE s.pond_id = $' + (++paramCount); params.push(pondId)
      }

      query += ' ORDER BY s.start_date DESC'
      const result = await db.query(query, params)
      return result.rows
    } catch (error) {
      throw error
    }
  },

  async getSeasonById(seasonId, userId, role, farmId = null) {
    try {
      let query = `
        SELECT s.*, p.pond_name, p.pond_code, p.assigned_staff, u.full_name AS technician_name,
          CASE WHEN s.actual_harvest IS NOT NULL THEN GREATEST((s.actual_harvest::date - s.start_date::date), 0)
               ELSE GREATEST((CURRENT_DATE - s.start_date::date), 0) END AS total_days,
          (SELECT COUNT(task_id) FROM tasks t WHERE t.season_id = s.season_id) AS task_count
        FROM seasons s INNER JOIN ponds p ON p.pond_id = s.pond_id LEFT JOIN users u ON u.user_id = p.assigned_staff
      `
      const params = [seasonId]
      let paramCount = 1

      if (role === 'OWNER' && farmId) {
        query += ' WHERE s.season_id = $1 AND p.farm_id = $' + (++paramCount); params.push(farmId)
      } else if (role === 'WORKER') {
        query += ' WHERE s.season_id = $1 AND p.farm_id = $' + (++paramCount); params.push(farmId)
        query += ' AND (p.assigned_staff = $' + (++paramCount) + ' OR EXISTS (SELECT 1 FROM technician_workers tw WHERE tw.technician_id = p.assigned_staff AND tw.worker_id = $' + paramCount + '))'
        params.push(userId)
      } else if (role === 'TECHNICIAN') {
        query += ' WHERE s.season_id = $1 AND p.farm_id = $' + (++paramCount); params.push(farmId)
        query += ' AND p.assigned_staff = $' + (++paramCount); params.push(userId)
      } else {
        query += ' WHERE s.season_id = $1'
      }

      const result = await db.query(query, params)
      return result.rows[0]
    } catch (error) {
      throw error
    }
  },

  async createSeason(targetPondIds, seasonName, startDate, expectedHarvestDate, shrimpType, quantitySeed, density, note) {
    try {
      const toDateOnly = (v) => {
        if (!v) return null;
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
      };

      const startD = toDateOnly(startDate);
      const today = toDateOnly(new Date());
      if (startD && startD <= today) {
        throw new Error('Ngày thả giống phải từ ngày mai trở đi. Không thể lên kế hoạch cho quá khứ hoặc ngay hôm nay.');
      }

      if (startDate && expectedHarvestDate) {
        const expectedD = toDateOnly(expectedHarvestDate);
        const diffTime = Math.abs(expectedD - startD);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 90) {
          throw new Error('Chu kỳ nuôi của tôm sú tối thiểu phải là 90 ngày để đảm bảo tôm đạt kích cỡ thương phẩm.');
        }
      }

      const createdSeasons = [];
      for (const pondId of targetPondIds) {
        const result = await db.query(
          `INSERT INTO seasons (pond_id, season_name, start_date, expected_harvest, shrimp_type, quantity_seed, density, note, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CHUAN_BI_NUOI') RETURNING *`,
          [pondId, seasonName, startDate, expectedHarvestDate, shrimpType, quantitySeed, density, note]
        );
        createdSeasons.push(result.rows[0]);

        await db.query(`UPDATE ponds SET status = 'CHUAN_BI_NUOI' WHERE pond_id = $1`, [pondId]);
      }
      return createdSeasons;
    } catch (error) {
      throw error;
    }
  },

  async startSeason(seasonId) {
    const seasonRes = await db.query('SELECT pond_id, status FROM seasons WHERE season_id = $1', [seasonId]);
    if (seasonRes.rows.length === 0) throw new Error('Không tìm thấy mùa vụ');
    if (seasonRes.rows[0].status !== 'CHUAN_BI_NUOI') throw new Error('Mùa vụ không ở trạng thái Chuẩn bị nuôi');

    const pondId = seasonRes.rows[0].pond_id;

    await db.query(`UPDATE seasons SET status = 'DANG_NUOI' WHERE season_id = $1`, [seasonId]);
    await db.query(`UPDATE ponds SET status = 'DANG_NUOI' WHERE pond_id = $1`, [pondId]);

    return { success: true };
  },

  async updateSeason(seasonId, data) {
    try {
      const seasonName = data.season_name || data.seasonName
      const startDate = data.start_date || data.startDate
      const expectedHarvest = data.expected_harvest || data.expectedHarvestDate || data.expectedHarvest
      const shrimpType = data.shrimp_type || data.shrimpType
      const quantitySeed = data.quantity_seed || data.quantitySeed
      const density = data.density
      const note = data.note

      const sRes = await db.query('SELECT * FROM seasons WHERE season_id = $1', [seasonId])
      if (sRes.rows.length === 0) throw new Error('Mùa vụ không tồn tại')
      const season = sRes.rows[0]
      if (String(season.status || '').toUpperCase() !== 'CHUAN_BI_NUOI') throw new Error('Chỉ có thể chỉnh sửa mùa vụ khi ở trạng thái Chuẩn bị nuôi')

      const toDateOnly = (v) => {
        if (!v) return null
        const d = new Date(v)
        if (Number.isNaN(d.getTime())) return null
        return new Date(d.getFullYear(), d.getMonth(), d.getDate())
      }
      const today = toDateOnly(new Date())

      if (seasonName !== undefined && (!seasonName || !String(seasonName).trim())) throw new Error('Tên mùa vụ là bắt buộc')

      if (startDate !== undefined && startD <= today) {
        throw new Error('Ngày thả giống phải được dời sang ít nhất là ngày mai.');
      }

      if (expectedHarvest !== undefined) {
        const expectedD = toDateOnly(expectedHarvest)
        const startD = startDate !== undefined ? toDateOnly(startDate) : toDateOnly(season.start_date)
        if (startD && expectedD < startD) throw new Error('Ngày dự kiến thu hoạch không được nhỏ hơn ngày thả')

        if (startD && expectedD) {
          const diffDays = Math.ceil(Math.abs(expectedD - startD) / (1000 * 60 * 60 * 24));
          if (diffDays < 90) {
            throw new Error('Thời gian nuôi dự kiến mới không được ít hơn 90 ngày.');
          }
        }
      }

      const dep = await db.query(`
        SELECT (SELECT COUNT(*) FROM cultivation_logs WHERE season_id = $1) AS logs_count,
               (SELECT COUNT(*) FROM expense_details WHERE season_id = $1) AS expense_count,
               (SELECT COUNT(*) FROM tasks WHERE season_id = $1 AND status != 'PENDING') AS tasks_count
      `, [seasonId])
      const d = dep.rows[0]
      if (Number(d.logs_count) > 0 || Number(d.expense_count) > 0 || Number(d.tasks_count) > 0) {
        throw new Error('Không thể chỉnh sửa vì đã phát sinh dữ liệu (Công việc đã chạy, chi phí, nhật ký...)')
      }

      const result = await db.query(`
        UPDATE seasons 
        SET season_name = $1, start_date = COALESCE($2, start_date), expected_harvest = $3, shrimp_type = $4, quantity_seed = $5, density = $6, note = $7
        WHERE season_id = $8 RETURNING *
      `, [seasonName, startDate, expectedHarvest, shrimpType, quantitySeed, density, note, seasonId])
      return result.rows[0]
    } catch (error) {
      throw error
    }
  },

  async harvestSeason(seasonId, actualHarvestDate, harvestNote, harvestWeightKg) {
    const seasonRes = await db.query('SELECT pond_id FROM seasons WHERE season_id = $1', [seasonId])
    if (seasonRes.rows.length === 0) throw new Error('Không tìm thấy mùa vụ')
    const pondId = seasonRes.rows[0].pond_id

    await db.query(`UPDATE seasons SET status = 'DA_THU_HOACH', actual_harvest = $1, note = $2, harvest_weight_kg = $3 WHERE season_id = $4`, [actualHarvestDate, harvestNote, harvestWeightKg, seasonId])
    await db.query(`UPDATE ponds SET status = 'DANG_XU_LY' WHERE pond_id = $1`, [pondId])

    await db.query(`DELETE FROM task_workers WHERE task_id IN (SELECT task_id FROM tasks WHERE season_id = $1 AND status = 'PENDING')`, [seasonId]);
    await db.query(`DELETE FROM tasks WHERE season_id = $1 AND status = 'PENDING'`, [seasonId]);

    return { seasonId, status: 'DA_THU_HOACH' }
  },

  async deleteSeason(seasonId) {
    const seasonRes = await db.query('SELECT pond_id FROM seasons WHERE season_id = $1', [seasonId])
    if (seasonRes.rows.length === 0) throw new Error('Không tìm thấy mùa vụ')
    const pondId = seasonRes.rows[0].pond_id

    const checkTask = await db.query(`SELECT COUNT(*) FROM tasks WHERE season_id = $1 AND status = 'IN_PROGRESS'`, [seasonId]);
    if (Number(checkTask.rows[0].count) > 0) throw new Error('Đang có công việc thực địa Đang thực hiện. Vui lòng hoàn tất hoặc hủy công việc trước.');

    await db.query(`DELETE FROM task_workers WHERE task_id IN (SELECT task_id FROM tasks WHERE season_id = $1 AND status != 'COMPLETED')`, [seasonId]);
    try { await db.query(`DELETE FROM task_product_usage WHERE task_id IN (SELECT task_id FROM tasks WHERE season_id = $1 AND status != 'COMPLETED')`, [seasonId]); } catch (e) { }
    await db.query(`DELETE FROM tasks WHERE season_id = $1 AND status != 'COMPLETED'`, [seasonId]);
    await db.query(`UPDATE tasks SET season_id = NULL WHERE season_id = $1`, [seasonId]);
    try { await db.query('DELETE FROM expense_details WHERE season_id = $1', [seasonId]); } catch (e) { }

    await db.query('DELETE FROM seasons WHERE season_id = $1', [seasonId])
    await db.query('UPDATE ponds SET status = $1 WHERE pond_id = $2', ['TAM_NGUNG', pondId])

    return { success: true, message: 'Đã xóa mùa vụ và dọn dẹp các lịch trình liên quan.' }
  },

  // 1. Kỹ sư gửi yêu cầu thu hoạch
  async requestHarvest(seasonId, requestDate, note) {
    const sRes = await db.query('SELECT status, start_date FROM seasons WHERE season_id = $1', [seasonId]);
    if (sRes.rows.length === 0) throw new Error('Mùa vụ không tồn tại');
    if (sRes.rows[0].status !== 'DANG_NUOI') throw new Error('Chỉ có thể xin thu hoạch khi ao Đang nuôi');

    // 🌟 SỬA TẠI ĐÂY: Lấy chuỗi ngày hôm nay theo múi giờ Việt Nam (bỏ qua giờ phút giây)
    const tzOffset = 7 * 60 * 60 * 1000; // Múi giờ Việt Nam GMT+7
    const todayVn = new Date(Date.now() + tzOffset);
    const todayStr = todayVn.toISOString().split('T')[0]; // Định dạng chuẩn 'YYYY-MM-DD'

    // So sánh trực tiếp chuỗi ngày 'YYYY-MM-DD' công bằng, không sợ lệch múi giờ
    if (requestDate <= todayStr) {
        throw new Error('Ngày đề xuất thu hoạch phải từ ngày mai trở đi để trang trại kịp chuẩn bị nhân sự và dụng cụ.');
    }

    // Không được thu hoạch trước ngày thả giống
    const startD = new Date(sRes.rows[0].start_date);
    const startStr = startD.toISOString().split('T')[0];
    if (requestDate < startStr) {
        throw new Error('Lỗi phi logic: Ngày thu hoạch không thể diễn ra trước ngày thả giống.');
    }

    await db.query(`
      UPDATE seasons 
      SET harvest_request_status = 'PENDING', harvest_request_date = $1, harvest_request_note = $2 
      WHERE season_id = $3
    `, [requestDate, note, seasonId]);
    
    return { success: true };
  },
  
  // 2. Chủ trại duyệt yêu cầu
  async reviewHarvestRequest(seasonId, isApproved) {
    const status = isApproved ? 'APPROVED' : 'REJECTED';
    await db.query(`
      UPDATE seasons 
      SET harvest_request_status = $1 
      WHERE season_id = $2
    `, [status, seasonId]);
    return { success: true, status };
  },

  // 3. Cập nhật hàm harvestSeason để KHÓA KỸ SƯ nếu chưa được duyệt
  async harvestSeason(seasonId, actualHarvestDate, harvestNote, harvestWeightKg, role) {
    const seasonRes = await db.query('SELECT pond_id, harvest_request_status FROM seasons WHERE season_id = $1', [seasonId])
    if (seasonRes.rows.length === 0) throw new Error('Không tìm thấy mùa vụ')
    
    // KHÓA CHẶN: Kỹ sư bắt buộc phải được APPROVED mới được thu hoạch
    if (role === 'TECHNICIAN' && seasonRes.rows[0].harvest_request_status !== 'APPROVED') {
        throw new Error('Bạn chưa được Chủ trại phê duyệt yêu cầu thu hoạch!');
    }

    const pondId = seasonRes.rows[0].pond_id
    await db.query(`UPDATE seasons SET status = 'DA_THU_HOACH', actual_harvest = $1, note = $2, harvest_weight_kg = $3 WHERE season_id = $4`, [actualHarvestDate, harvestNote, harvestWeightKg, seasonId])
    await db.query(`UPDATE ponds SET status = 'DANG_XU_LY' WHERE pond_id = $1`, [pondId])
    await db.query(`DELETE FROM task_workers WHERE task_id IN (SELECT task_id FROM tasks WHERE season_id = $1 AND status = 'PENDING')`, [seasonId]);
    await db.query(`DELETE FROM tasks WHERE season_id = $1 AND status = 'PENDING'`, [seasonId]);
    return { seasonId, status: 'DA_THU_HOACH' }
  },
}

module.exports = { seasonService }