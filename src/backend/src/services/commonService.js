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
      if (expectedHarvest !== undefined) {
        const expectedD = toDateOnly(expectedHarvest)
        const startD = startDate !== undefined ? toDateOnly(startDate) : toDateOnly(season.start_date)
        if (startD && expectedD < startD) throw new Error('Ngày dự kiến thu hoạch không được nhỏ hơn ngày thả')
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
}

module.exports = { seasonService }