const db = require('../config/database')
const logger = require('../utils/logger')

// 🌟 ĐÃ CẬP NHẬT TRẠNG THÁI THEO LOGIC MỚI
const POND_STATUS = {
  TAM_NGUNG: 'TAM_NGUNG',
  CHUAN_BI_NUOI: 'CHUAN_BI_NUOI',
  DANG_NUOI: 'DANG_NUOI',
  DANG_XU_LY: 'DANG_XU_LY', // Thay thế DANG_CAI_TAO
}

const USAGE_STATUS = {
  HOAT_DONG: 'HOAT_DONG',
  NGUNG_SU_DUNG: 'NGUNG_SU_DUNG',
}

const isPositiveNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0
}

const normalizeUpper = (value) => String(value || '').trim().toUpperCase()

const normalizePondCodeNumber = (pondCode) => {
  const match = String(pondCode || '').toUpperCase().match(/^AO(\d+)$/)
  return match ? Number(match[1]) : null
}

const pondService = {
  async getAllPonds(userId, role, farmId = null) {
    try {
      let query = `
        SELECT 
          p.*,
          u.full_name AS technician_name,
          u.status AS technician_active
        FROM ponds p
        LEFT JOIN users u ON u.user_id = p.assigned_staff
      `
      const params = []
      const normalizedRole = normalizeUpper(role)

      if (normalizedRole === 'TECHNICIAN') {
        query += ` WHERE p.assigned_staff = $1`
        params.push(userId)
      } else if (normalizedRole === 'WORKER') {
        query += `
          INNER JOIN technician_workers tw ON tw.technician_id = p.assigned_staff
          WHERE tw.worker_id = $1
        `
        params.push(userId)
      } else if (farmId) {
        query += ` WHERE p.farm_id = $1`
        params.push(farmId)
      } else {
        query += ` WHERE p.farm_id = (SELECT farm_id FROM users WHERE user_id = $1)`
        params.push(userId)
      }

      query += ` ORDER BY p.created_at ASC`
      const result = await db.query(query, params)
      return result.rows
    } catch (error) {
      logger.error('Error in getAllPonds:', error)
      throw error
    }
  },

  async getPondById(pondId) {
    try {
      const result = await db.query(
        `SELECT p.*, u.full_name AS technician_name, u.status AS technician_active
         FROM ponds p LEFT JOIN users u ON u.user_id = p.assigned_staff
         WHERE p.pond_id = $1`, [pondId]
      )
      const pond = result.rows[0]
      if (!pond) return null

      try {
        const workersRes = await db.query(
          `SELECT u.user_id, u.full_name, u.username
           FROM pond_workers pw JOIN users u ON u.user_id = pw.user_id
           WHERE pw.pond_id = $1 ORDER BY u.full_name NULLS LAST, u.username`, [pondId]
        )
        pond.workers = workersRes.rows
      } catch (err) {
        pond.workers = []
      }
      return pond
    } catch (error) {
      throw error
    }
  },

  async createPond({ pondName, areaMeter, depthMeter, assignedStaff = null, farmId }) {
    try {
      if (!farmId) throw new Error('Không tìm thấy thông tin trại nuôi')
      if (!String(pondName || '').trim()) throw new Error('Tên ao không được để trống')
      if (!isPositiveNumber(areaMeter) || !isPositiveNumber(depthMeter)) throw new Error('Diện tích và độ sâu phải lớn hơn 0')

      const duplicateNameCheck = await db.query(`SELECT 1 FROM ponds WHERE farm_id = $1 AND LOWER(pond_name) = LOWER($2) LIMIT 1`, [farmId, String(pondName).trim()])
      if (duplicateNameCheck.rowCount > 0) throw new Error('Tên ao đã tồn tại trong trại nuôi')

      const idResult = await db.query(`SELECT pond_id FROM ponds ORDER BY pond_id ASC`)
      let nextPondId = 1
      const existingIds = idResult.rows.map(row => Number(row.pond_id))
      for (let i = 1; i <= existingIds.length + 1; i++) {
        if (!existingIds.includes(i)) { nextPondId = i; break; }
      }

      const codeResult = await db.query(`SELECT pond_code FROM ponds WHERE farm_id = $1 ORDER BY pond_code ASC`, [farmId])
      const usedNumbers = codeResult.rows.map(row => normalizePondCodeNumber(row.pond_code)).filter(num => Number.isInteger(num) && num > 0).sort((a, b) => a - b)
      let nextNum = 1
      for (const num of usedNumbers) {
        if (num !== nextNum) break;
        nextNum += 1
      }

      const finalPondCode = `AO${String(nextNum).padStart(3, '0')}`
      const insertResult = await db.query(
        `INSERT INTO ponds (pond_id, pond_code, pond_name, area_m2, depth_m, status, usage_status, assigned_staff, farm_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [nextPondId, finalPondCode, String(pondName).trim(), Number(areaMeter), Number(depthMeter), POND_STATUS.TAM_NGUNG, USAGE_STATUS.HOAT_DONG, assignedStaff, farmId]
      )
      return insertResult.rows[0]
    } catch (error) {
      throw error
    }
  },

  async updatePond(pondId, data, farmId = null) {
    try {
      const pondCode = data.pond_code || data.pondCode
      const pondName = data.pond_name || data.pondName
      const areaMeter = data.area_m2 || data.areaMeter
      const depthMeter = data.depth_m || data.depthMeter
      const assignedStaff = data.assigned_staff || data.assignedStaff

      if (!String(pondName || '').trim()) throw new Error('Tên ao không được để trống')
      if (!isPositiveNumber(areaMeter) || !isPositiveNumber(depthMeter)) throw new Error('Diện tích và độ sâu phải lớn hơn 0')

      if (farmId) {
        const duplicateNameCheck = await db.query(
          `SELECT 1 FROM ponds WHERE farm_id = $1 AND LOWER(pond_name) = LOWER($2) AND pond_id <> $3 LIMIT 1`,
          [farmId, String(pondName).trim(), pondId]
        )
        if (duplicateNameCheck.rowCount > 0) throw new Error('Tên ao đã tồn tại trong trại nuôi')
      }

      const result = await db.query(
        `UPDATE ponds SET pond_code = $1, pond_name = $2, area_m2 = $3, depth_m = $4, assigned_staff = $5 WHERE pond_id = $6 RETURNING *`,
        [pondCode, String(pondName).trim(), Number(areaMeter), Number(depthMeter), assignedStaff || null, pondId]
      )
      return result.rows[0]
    } catch (error) {
      throw error
    }
  },

  async getAssignmentMatrixByFarm(farmId) {
    try {
      const techniciansResult = await db.query(
        `SELECT u.user_id, u.full_name, u.username, u.status, r.role_name FROM users u INNER JOIN roles r ON r.role_id = u.role_id WHERE u.farm_id = $1 AND UPPER(r.role_name) = 'TECHNICIAN' ORDER BY u.full_name NULLS LAST, u.username`, [farmId]
      )
      const pondsResult = await db.query(
        `SELECT pond_id, pond_code, pond_name, assigned_staff, status, usage_status FROM ponds WHERE farm_id = $1 ORDER BY created_at ASC`, [farmId]
      )
      return { technicians: techniciansResult.rows, ponds: pondsResult.rows }
    } catch (error) {
      throw error
    }
  },

  async updatePondAssignment(pondId, technicianId = null) {
    try {
      const result = await db.query(`UPDATE ponds SET assigned_staff = $1 WHERE pond_id = $2 RETURNING *`, [technicianId || null, pondId])
      return result.rows[0]
    } catch (error) {
      throw error
    }
  },

  async updateUsageStatus(pondId, usageStatus) {
    try {
      const normalized = normalizeUpper(usageStatus)
      if (![USAGE_STATUS.HOAT_DONG, USAGE_STATUS.NGUNG_SU_DUNG].includes(normalized)) {
        throw new Error('Trạng thái sử dụng không hợp lệ')
      }

      // 🌟 MỞ RỘNG ĐIỀU KIỆN CHẶN CẬP NHẬT Ở BACKEND
      if (normalized === USAGE_STATUS.NGUNG_SU_DUNG) {
        const pondCheck = await db.query(`SELECT status FROM ponds WHERE pond_id = $1`, [pondId]);
        if (pondCheck.rows.length > 0) {
          const currentStatus = normalizeUpper(pondCheck.rows[0].status);
          if (['DANG_NUOI', 'CHUAN_BI_NUOI', 'DANG_XU_LY', 'DANG_CAI_TAO'].includes(currentStatus)) {
            throw new Error('Chỉ có thể ngưng sử dụng khi ao đang ở trạng thái Tạm Ngưng (Không vướng mùa vụ)');
          }
        }
      }

      const result = await db.query(`UPDATE ponds SET usage_status = $1 WHERE pond_id = $2 RETURNING *`, [normalized, pondId])
      return result.rows[0]
    } catch (error) {
      throw error
    }
  },

  // 🌟 NÂNG CẤP: Chuyển ao về TẠM NGƯNG sau khi xử lý xong
  async completeRenovation(pondId) {
    try {
      const pond = await this.getPondById(pondId)
      if (!pond) throw new Error('Ao không tồn tại')
      if (normalizeUpper(pond.status) !== POND_STATUS.DANG_XU_LY) throw new Error('Ao không ở trạng thái đang xử lý')

      const result = await db.query(
        `UPDATE ponds SET status = $1, renovation_completed_at = NOW() WHERE pond_id = $2 RETURNING *`,
        [POND_STATUS.TAM_NGUNG, pondId]
      )
      return result.rows[0]
    } catch (error) {
      logger.error('Error in completeRenovation:', error)
      throw error
    }
  },

  POND_STATUS,
  USAGE_STATUS,

  async hasTechnicianWorkerAccess(pondId, workerId) {
    const result = await db.query(
      `SELECT 1 FROM ponds p JOIN technician_workers tw ON tw.technician_id = p.assigned_staff WHERE p.pond_id = $1 AND tw.worker_id = $2 LIMIT 1`, [pondId, workerId]
    )
    return result.rowCount > 0
  },

  async deletePond(pondId) {
    try {
      const checkResult = await db.query('SELECT 1 FROM ponds WHERE pond_id = $1', [pondId])
      if (checkResult.rowCount === 0) throw new Error('Ao nuôi không tồn tại hoặc đã bị xóa')
      const result = await db.query(`DELETE FROM ponds WHERE pond_id = $1 RETURNING *`, [pondId])
      return result.rows[0]
    } catch (error) {
      if (error.code === '23503') throw new Error('Không thể xóa ao này vì đang có dữ liệu liên quan (công việc, môi trường, mùa vụ...)')
      throw error
    }
  },
}

module.exports = pondService