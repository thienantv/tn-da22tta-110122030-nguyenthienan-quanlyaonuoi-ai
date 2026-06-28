const db = require('../config/database')
const logger = require('../utils/logger')

const expenseService = {
  async getExpenseCategories() {
    try {
      const result = await db.query(`
        SELECT category_id, category_name
        FROM expense_categories
        ORDER BY category_id ASC
      `)
      return result.rows || []
    } catch (error) {
      logger.error('Error in getExpenseCategories:', error)
      return []
    }
  },

  async updateExpenseCategory(categoryId, categoryName) {
    try {
      const result = await db.query(`
        UPDATE expense_categories
        SET category_name = $1
        WHERE category_id = $2
        RETURNING category_id, category_name
      `, [String(categoryName).trim(), categoryId])

      return result.rows[0] || null
    } catch (error) {
      logger.error('Error in updateExpenseCategory:', error)
      throw error
    }
  },

  async deleteExpenseCategory(categoryId) {
    try {
      const countRes = await db.query('SELECT COUNT(*) AS c FROM expense_details WHERE category_id = $1', [categoryId])
      const cnt = Number(countRes.rows[0]?.c || 0)
      if (cnt > 0) {
        throw new Error('Không thể xóa: danh mục đang được sử dụng bởi các khoản chi')
      }

      const delRes = await db.query('DELETE FROM expense_categories WHERE category_id = $1 RETURNING category_id', [categoryId])
      if (!delRes.rows[0]) {
        throw new Error('Danh mục không tồn tại')
      }

      return true
    } catch (error) {
      logger.error('Error in deleteExpenseCategory:', error)
      throw error
    }
  },

  async createExpenseCategory(categoryName) {
    try {
      const normalizedName = String(categoryName || '').trim()
      if (!normalizedName) {
        throw new Error('Tên danh mục không được để trống')
      }

      const result = await db.query(
        `INSERT INTO expense_categories (category_name)
         VALUES ($1)
         RETURNING category_id, category_name`,
        [normalizedName]
      )

      return result.rows[0]
    } catch (error) {
      logger.error('Error in createExpenseCategory:', error)
      throw error
    }
  },

  async createExpense({ seasonId, categoryId, note, amount, expenseDate, createdBy }) {
    try {
      const result = await db.query(`
        INSERT INTO expense_details (season_id, category_id, note, amount, expense_date, created_by)
        VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6)
        RETURNING *
      `, [seasonId, categoryId, note, amount, expenseDate || null, createdBy])
      return result.rows[0]
    } catch (error) {
      logger.error('Error in createExpense:', error)
      throw error
    }
  },

  async getExpensesBySeasonId(seasonId, farmId = null, role = 'OWNER') {
    try {
      let query = `
        SELECT
          ed.expense_id,
          ed.season_id,
          s.season_name,
          ed.category_id,
          COALESCE(ec.category_name, 'Khác') as category_name,
          ed.amount,
          ed.expense_date,
          ed.note,
          ed.created_by,
          u.full_name as created_by_name,
          u.username as created_by_username
        FROM expense_details ed
        LEFT JOIN seasons s ON s.season_id = ed.season_id
        LEFT JOIN expense_categories ec ON ed.category_id = ec.category_id
        LEFT JOIN users u ON u.user_id = ed.created_by
        WHERE ed.season_id = $1
      `
      const params = [seasonId]

      // Any non-owner user is scoped to their farm
      if (role !== 'OWNER' && farmId) {
        query += ` AND s.pond_id IN (SELECT pond_id FROM ponds WHERE farm_id = $2)`
        params.push(farmId)
      }

      query += ' ORDER BY ed.expense_date DESC, ed.expense_id DESC'
      const result = await db.query(query, params)
      return result.rows || []
    } catch (error) {
      logger.error('Error in getExpensesBySeasonId:', error)
      // Return empty array instead of throwing to prevent 500 error
      return []
    }
  },

  async getExpensesByCategory(seasonId, categoryId, farmId = null, role = 'OWNER') {
    try {
      let query = `
        SELECT ed.* FROM expense_details ed
        LEFT JOIN seasons s ON s.season_id = ed.season_id
        WHERE ed.season_id = $1 AND ed.category_id = $2
      `
      const params = [seasonId, categoryId]

      // Any non-owner user is scoped to their farm
      if (role !== 'OWNER' && farmId) {
        query += ` AND s.pond_id IN (SELECT pond_id FROM ponds WHERE farm_id = $3)`
        params.push(farmId)
      }

      query += ' ORDER BY ed.created_at DESC'
      const result = await db.query(query, params)
      return result.rows || []
    } catch (error) {
      logger.error('Error in getExpensesByCategory:', error)
      return []
    }
  },

  async getExpenseStats(seasonId, farmId = null, role = 'OWNER') {
    try {
      let query = `
        SELECT 
          COALESCE(SUM(ed.amount), 0) as total_amount,
          COALESCE(COUNT(*), 0) as total_expenses,
          COALESCE(AVG(ed.amount), 0) as avg_amount
        FROM expense_details ed
        LEFT JOIN seasons s ON s.season_id = ed.season_id
        WHERE ed.season_id = $1
      `
      const params = [seasonId]

      // Any non-owner user is scoped to their farm
      if (role !== 'OWNER' && farmId) {
        query += ` AND s.pond_id IN (SELECT pond_id FROM ponds WHERE farm_id = $2)`
        params.push(farmId)
      }

      const result = await db.query(query, params)
      return result.rows[0] || { total_amount: 0, total_expenses: 0, avg_amount: 0 }
    } catch (error) {
      logger.error('Error in getExpenseStats:', error)
      return { total_amount: 0, total_expenses: 0, avg_amount: 0 }
    }
  },

  async getTotalExpenseBySeason(seasonId) {
    try {
      const result = await db.query(`
        SELECT season_id, season_name, COALESCE(total_expense, 0) AS total_expense
        FROM vw_total_expense_by_season
        WHERE season_id = $1
      `, [seasonId])
      return result.rows[0] || { season_id: seasonId, season_name: null, total_expense: 0 }
    } catch (error) {
      logger.error('Error in getTotalExpenseBySeason:', error)
      return { season_id: seasonId, season_name: null, total_expense: 0 }
    }
  },

  async getExpenseById(expenseId) {
    try {
      const result = await db.query(`
        SELECT * FROM expense_details WHERE expense_id = $1
      `, [expenseId])
      return result.rows[0]
    } catch (error) {
      logger.error('Error in getExpenseById:', error)
      throw error
    }
  },

  async updateExpense(expenseId, { categoryId, note, amount, expenseDate }) {
    try {
      const expense = await this.getExpenseById(expenseId)
      if (!expense) {
        throw new Error('Chi phí không tồn tại')
      }

      const result = await db.query(`
        UPDATE expense_details 
        SET category_id = $1, note = $2, amount = $3, expense_date = COALESCE($4::date, expense_date)
        WHERE expense_id = $5
        RETURNING *
      `, [
        categoryId || expense.category_id,
        note || expense.note,
        amount || expense.amount,
        expenseDate || null,
        expenseId
      ])
      return result.rows[0]
    } catch (error) {
      logger.error('Error in updateExpense:', error)
      throw error
    }
  },

  async approveExpense(expenseId, ownerId) {
    try {
      const expense = await this.getExpenseById(expenseId)
      return expense || null
    } catch (error) {
      logger.error('Error in approveExpense:', error)
      throw error
    }
  },

  async rejectExpense(expenseId, reason, ownerId) {
    try {
      const expense = await this.getExpenseById(expenseId)
      return expense || null
    } catch (error) {
      logger.error('Error in rejectExpense:', error)
      throw error
    }
  },

  async deleteExpense(expenseId) {
    try {
      const expense = await this.getExpenseById(expenseId)
      if (!expense) {
        throw new Error('Chi phí không tồn tại')
      }

      await db.query('DELETE FROM expense_details WHERE expense_id = $1', [expenseId])
      return { success: true, message: 'Đã xóa chi phí' }
    } catch (error) {
      logger.error('Error in deleteExpense:', error)
      throw error
    }
  },
}

module.exports = expenseService
