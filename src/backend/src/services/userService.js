const db = require('../config/database')
const logger = require('../utils/logger')

const userService = {
  async getAllUsers() {
    try {
      const result = await db.query(`
        SELECT u.user_id, u.full_name, u.username, u.email, u.phone, u.avatar_url,
               r.role_name as role, u.status, u.created_at, u.farm_id
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.role_id
        ORDER BY u.created_at DESC
      `)
      return result.rows
    } catch (error) {
      logger.error('Error in getAllUsers:', error)
      throw error
    }
  },

  async getUserById(userId) {
    try {
      const result = await db.query(`
        SELECT u.user_id, u.full_name, u.username, u.email, u.phone, u.avatar_url,
               r.role_name as role, u.status, u.created_at, u.farm_id,
               COALESCE(f.farm_name, '') as farm_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.role_id
        LEFT JOIN farms f ON u.farm_id = f.farm_id
        WHERE u.user_id = $1
      `, [userId])
      return result.rows[0]
    } catch (error) {
      logger.error('Error in getUserById:', error)
      throw error
    }
  },

  async createUser(fullName, username, email, password, roleId) {
    try {
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash(password, 10)

      const result = await db.query(`
        INSERT INTO users (full_name, username, email, password_hash, role_id, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id, full_name, username, email, role_id
      `, [fullName, username, email, hashedPassword, roleId, true])

      return result.rows[0]
    } catch (error) {
      logger.error('Error in createUser:', error)
      throw error
    }
  },

  async createUserWithDetails({ fullName, username, email, phone, password, roleId, farmId }) {
    try {
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash(password, 10)

      const result = await db.query(
        `INSERT INTO users (full_name, username, email, phone, password_hash, role_id, farm_id, status, locked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NULL)
         RETURNING user_id, full_name, username, email, phone, role_id, farm_id, status, created_at`,
        [fullName, username, email, phone || null, hashedPassword, roleId, farmId]
      )

      return result.rows[0]
    } catch (error) {
      logger.error('Error in createUserWithDetails:', error)
      throw error
    }
  },

  async lockUser(userId) {
    try {
      await db.query('UPDATE users SET status = $1, locked_at = NOW() WHERE user_id = $2', [false, userId])
      return { success: true, message: 'Đã khóa tài khoản' }
    } catch (error) {
      logger.error('Error in lockUser:', error)
      throw error
    }
  },

  async unlockUser(userId) {
    try {
      await db.query('UPDATE users SET status = $1, locked_at = NULL WHERE user_id = $2', [true, userId])
      return { success: true, message: 'Đã mở khóa tài khoản' }
    } catch (error) {
      logger.error('Error in unlockUser:', error)
      throw error
    }
  },

  // ===================================================================
  // ĐÁ KHỎI TRẠI TỰ ĐỘNG: Gỡ farm_id về NULL cho tài khoản bị khóa lâu
  // ===================================================================
  async autoKickLockedUsers(days = 30) {
    try {
      const query = `
        UPDATE users 
        SET farm_id = NULL 
        WHERE status = FALSE 
          AND locked_at IS NOT NULL 
          AND locked_at < NOW() - INTERVAL '${days} days'
          AND farm_id IS NOT NULL
        RETURNING user_id, username, full_name
      `;
      const result = await db.query(query);
      return { success: true, kickedCount: result.rowCount, users: result.rows };
    } catch (error) {
      logger.error('Error in autoKickLockedUsers:', error);
      throw error;
    }
  },

  async resetPassword(userId) {
    try {
      const tempPassword = Math.random().toString(36).slice(-8)
      const bcrypt = require('bcryptjs')
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      await db.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hashedPassword, userId])
      return { success: true, tempPassword }
    } catch (error) {
      logger.error('Error in resetPassword:', error)
      throw error
    }
  },

  async changePassword(userId, oldPassword, newPassword) {
    try {
      const bcrypt = require('bcryptjs')
      const result = await db.query('SELECT password_hash FROM users WHERE user_id = $1', [userId])

      if (result.rows.length === 0) {
        throw new Error('User không tồn tại')
      }

      const user = result.rows[0]
      const validPassword = await bcrypt.compare(oldPassword, user.password_hash)

      if (!validPassword) {
        throw new Error('Mật khẩu cũ không đúng')
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10)
      await db.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hashedPassword, userId])

      return { success: true, message: 'Đã đổi mật khẩu' }
    } catch (error) {
      logger.error('Error in changePassword:', error)
      throw error
    }
  },

  // ===================================================================
  // XÓA AN TOÀN: Chỉ cho phép xóa khi tài khoản "trắng" 100%
  // ===================================================================
  async deleteUser(userId) {
    try {
      // Quét các bảng xem nhân viên này đã chạm vào dữ liệu nào chưa
      const checkQuery = `
        SELECT 
          (SELECT EXISTS(SELECT 1 FROM tasks WHERE assigned_by = $1)) AS has_tasks,
          (SELECT EXISTS(SELECT 1 FROM task_workers WHERE worker_id = $1)) AS has_task_workers,
          (SELECT EXISTS(SELECT 1 FROM technician_workers WHERE technician_id = $1 OR worker_id = $1)) AS has_tech_workers,
          (SELECT EXISTS(SELECT 1 FROM ponds WHERE assigned_staff = $1)) AS has_ponds,
          (SELECT EXISTS(SELECT 1 FROM product_usage_logs WHERE created_by = $1)) AS has_product_logs,
          (SELECT EXISTS(SELECT 1 FROM manual_environment_logs WHERE created_by = $1)) AS has_env_logs,
          (SELECT EXISTS(SELECT 1 FROM uploaded_images WHERE uploaded_by = $1)) AS has_images,
          (SELECT EXISTS(SELECT 1 FROM products WHERE created_by = $1 OR updated_by = $1)) AS has_products,
          (SELECT EXISTS(SELECT 1 FROM product_categories WHERE created_by = $1 OR updated_by = $1)) AS has_categories
      `;
      
      const { rows } = await db.query(checkQuery, [userId]);
      const hasData = Object.values(rows[0]).some(val => val === true);

      // Nếu đã có vết -> Chặn xóa
      if (hasData) {
        throw new Error('Nhân sự này đã phát sinh dữ liệu hệ thống (Công việc, chi phí, ao...). Để đảm bảo an toàn dữ liệu, KHÔNG THỂ XÓA. Vui lòng sử dụng tính năng KHÓA tài khoản.');
      }

      await db.query('DELETE FROM users WHERE user_id = $1', [userId])
      return { success: true, message: 'Đã xóa nhân sự vĩnh viễn khỏi hệ thống' }
    } catch (error) {
      logger.error('Error in deleteUser:', error)
      throw error
    }
  },

  async updateUser(userId, { full_name, email, phone, avatar_url, farm_id }) {
    try {
      const updates = []
      const values = []
      let paramCount = 1

      if (full_name) {
        updates.push(`full_name = $${paramCount++}`)
        values.push(full_name)
      }

      if (email) {
        updates.push(`email = $${paramCount++}`)
        values.push(email)
      }

      if (phone) {
        updates.push(`phone = $${paramCount++}`)
        values.push(phone)
      }

      if (avatar_url !== undefined) {
        updates.push(`avatar_url = $${paramCount++}`)
        values.push(avatar_url)
      }

      if (farm_id !== undefined) {
        updates.push(`farm_id = $${paramCount++}`)
        values.push(farm_id)
      }

      if (updates.length === 0) {
        throw new Error('Không có dữ liệu cập nhật')
      }

      values.push(userId)
      const query = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramCount} RETURNING user_id, full_name, username, email, phone, avatar_url, farm_id`

      const result = await db.query(query, values)
      return { success: true, data: result.rows[0], message: 'Đã cập nhật thông tin user' }
    } catch (error) {
      logger.error('Error in updateUser:', error)
      throw error
    }
  },

  async removeUserFromFarm(userId) {
    try {
      const result = await db.query('UPDATE users SET farm_id = NULL, status = FALSE WHERE user_id = $1 RETURNING user_id, full_name, username, email, phone, avatar_url, farm_id, status', [userId])
      return { success: true, data: result.rows[0], message: 'Đã gỡ người dùng khỏi trại và khoá tài khoản' }
    } catch (error) {
      logger.error('Error in removeUserFromFarm:', error)
      throw error
    }
  },

  async updateUserRole(userId, role) {
    try {
      const roleResult = await db.query('SELECT role_id FROM roles WHERE role_name = $1', [role])

      if (roleResult.rows.length === 0) {
        throw new Error('Role không tồn tại')
      }

      const roleId = roleResult.rows[0].role_id
      const result = await db.query(
        'UPDATE users SET role_id = $1 WHERE user_id = $2 RETURNING user_id, full_name, username, email, phone, role_id, status, farm_id',
        [roleId, userId]
      )

      return { success: true, data: result.rows[0], message: `Đã phân quyền role ${role}` }
    } catch (error) {
      logger.error('Error in updateUserRole:', error)
      throw error
    }
  },

  async getUsersByFarm(farmId) {
    try {
      const result = await db.query(
        `SELECT u.user_id, u.full_name, u.username, u.email, u.phone, u.avatar_url,
                r.role_name as role, u.status, u.created_at, u.farm_id
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.role_id
         WHERE u.farm_id = $1
         ORDER BY u.created_at DESC`,
        [farmId]
      )
      return result.rows
    } catch (error) {
      logger.error('Error in getUsersByFarm:', error)
      throw error
    }
  },

  async assignWorkerToTechnician(
    technicianId,
    workerId
  ) {
    try {
      await db.query(
        `
      INSERT INTO technician_workers (
        technician_id,
        worker_id
      )
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
        [technicianId, workerId]
      )

      return {
        technician_id: technicianId,
        worker_id: workerId,
      }
    } catch (error) {
      logger.error(
        'Error in assignWorkerToTechnician:',
        error
      )
      throw error
    }
  },

  async removeWorkerFromTechnician(
    technicianId,
    workerId
  ) {
    try {
      await db.query(
        `
      DELETE
      FROM technician_workers
      WHERE technician_id = $1
      AND worker_id = $2
      `,
        [technicianId, workerId]
      )

      return {
        technician_id: technicianId,
        worker_id: workerId,
      }
    } catch (error) {
      logger.error(
        'Error in removeWorkerFromTechnician:',
        error
      )
      throw error
    }
  },

  async hasWorkerUnderTechnician(
    technicianId,
    workerId
  ) {
    try {
      const result = await db.query(
        `
      SELECT 1
      FROM technician_workers
      WHERE technician_id = $1
      AND worker_id = $2
      LIMIT 1
      `,
        [technicianId, workerId]
      )

      return result.rowCount > 0
    } catch (error) {
      logger.error(
        'Error in hasWorkerUnderTechnician:',
        error
      )
      throw error
    }
  },

  async getTechnicianWorkerMatrixByFarm(farmId) {
    try {
      const farmIdNum = Number(farmId)

      if (!farmIdNum) {
        throw new Error('Invalid farmId')
      }

      const techniciansResult = await db.query(
        `
        SELECT
          u.user_id,
          u.full_name,
          u.username,
          u.status,
          r.role_name
        FROM users u
        INNER JOIN roles r ON r.role_id = u.role_id
        WHERE u.farm_id = $1
        AND UPPER(r.role_name) = 'TECHNICIAN'
        ORDER BY u.full_name NULLS LAST, u.username
        `,
        [farmIdNum]
      )

      const workersResult = await db.query(
        `
        SELECT
          u.user_id,
          u.full_name,
          u.username,
          u.status,
          r.role_name
        FROM users u
        INNER JOIN roles r ON r.role_id = u.role_id
        WHERE u.farm_id = $1
        AND UPPER(r.role_name) = 'WORKER'
        ORDER BY u.full_name NULLS LAST, u.username
        `,
        [farmIdNum]
      )

      const assignmentsResult = await db.query(
        `
        SELECT
          technician_id,
          worker_id
        FROM technician_workers tw
        `,
        []
      )

      return {
        technicians: techniciansResult.rows,
        workers: workersResult.rows,
        assignments: assignmentsResult.rows,
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  },

  async updateTechnicianWorkerAssignment(technicianId, workerIds) {
    const techId = Number(technicianId)

    if (!techId) throw new Error('Invalid technicianId')
    if (!Array.isArray(workerIds)) throw new Error('workerIds must be array')

    try {
      await db.query(
        `DELETE FROM technician_workers WHERE technician_id = $1`,
        [techId]
      )

      for (const workerId of workerIds) {
        if (!workerId) continue

        await db.query(
          `INSERT INTO technician_workers (technician_id, worker_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [techId, workerId]
        )
      }

      return true
    } catch (error) {
      console.error('UPDATE TECH WORKER ERROR:', error)
      throw error
    }
  },
}

module.exports = userService