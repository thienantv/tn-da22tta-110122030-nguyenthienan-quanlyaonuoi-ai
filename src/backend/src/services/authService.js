const bcrypt = require('bcryptjs')
const db = require('../config/database')
const { generateToken } = require('../utils/jwtHelper')
const logger = require('../utils/logger')

const authService = {
  async register(fullName, username, email, phone, password, farmName) {
    try {
      // Collect field-level validation errors so we can return them together
      const fieldErrors = {}

      // Basic server-side validation to enforce rules
      if (typeof fullName !== 'string' || String(fullName).trim().length < 2) {
        fieldErrors.fullName = 'Họ và tên phải có ít nhất 2 ký tự'
      }

      const fullNameValid = /^[\p{L}\p{M}0-9\s'.-]{2,}$/u
      if (!fieldErrors.fullName && !fullNameValid.test(String(fullName).trim())) {
        fieldErrors.fullName = 'Họ và tên chứa ký tự không hợp lệ'
      }

      const usernameRegex = /^[A-Za-z0-9_]{4,30}$/
      if (!usernameRegex.test(username)) {
        fieldErrors.username = 'Tên tài khoản chỉ gồm chữ, số và dấu gạch dưới, độ dài 4-30'
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        fieldErrors.email = 'Email không hợp lệ'
      }

      const phoneRegex = /^0\d{9}$/
      if (!phoneRegex.test(phone)) {
        fieldErrors.phone = 'Số điện thoại phải bắt đầu bằng 0 và có đúng 10 chữ số'
      }

      const passwordStrong = /(?=.{8,})(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
      if (!passwordStrong.test(password)) {
        fieldErrors.password = 'Mật khẩu phải ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số'
      }

      // If any format validation failed, return field errors immediately
      if (Object.keys(fieldErrors).length > 0) {
        const vErr = new Error('Dữ liệu không hợp lệ')
        vErr.fieldErrors = fieldErrors
        throw vErr
      }

      // Check uniqueness: username, email, phone
      const usernameCheck = await db.query('SELECT 1 FROM users WHERE username = $1', [username])
      if (usernameCheck.rows.length > 0) {
        fieldErrors.username = 'Tên tài khoản đã tồn tại'
      }

      const emailCheck = await db.query('SELECT 1 FROM users WHERE email = $1', [email])
      if (emailCheck.rows.length > 0) {
        fieldErrors.email = 'Email đã được sử dụng'
      }

      const phoneCheck = await db.query('SELECT 1 FROM users WHERE phone = $1', [phone])
      if (phoneCheck.rows.length > 0) {
        fieldErrors.phone = 'Số điện thoại đã được đăng ký'
      }

      if (Object.keys(fieldErrors).length > 0) {
        const uErr = new Error('Dữ liệu trùng')
        uErr.fieldErrors = fieldErrors
        throw uErr
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Determine OWNER role_id from seeded roles
      const roleResult = await db.query('SELECT role_id FROM roles WHERE role_name = $1', ['OWNER'])
      if (roleResult.rows.length === 0) {
        throw new Error('Role OWNER chưa được cấu hình trong hệ thống')
      }
      const ownerRoleId = roleResult.rows[0].role_id

      const client = await db.connect()
      let user
      try {
        await client.query('BEGIN')

        // Insert user with OWNER role by default, include phone
        const userResult = await client.query(
          `INSERT INTO users (full_name, username, password_hash, email, phone, role_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING user_id, full_name, username, email, phone, role_id, farm_id, avatar_url`,
          [fullName, username, hashedPassword, email, phone, ownerRoleId, true]
        )
        user = userResult.rows[0]

        // Auto-create farm for the new OWNER and bind this OWNER to that farm
        const safeCodeBase = String(username || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 8) || 'OWNER'
        const generatedFarmCode = `FARM-${safeCodeBase}-${Date.now().toString().slice(-6)}`
        const resolvedFarmName = String(farmName || '').trim() || `Trai cua ${fullName}`

        const farmResult = await client.query(
          `INSERT INTO farms (farm_code, farm_name, owner_user_id, status)
           VALUES ($1, $2, $3, $4)
           RETURNING farm_id`,
          [generatedFarmCode, resolvedFarmName, user.user_id, 'ACTIVE']
        )

        const farmId = farmResult.rows[0].farm_id

        const updatedUserResult = await client.query(
          `UPDATE users
           SET farm_id = $1
           WHERE user_id = $2
           RETURNING user_id, full_name, username, email, phone, role_id, farm_id, avatar_url`,
          [farmId, user.user_id]
        )

        user = updatedUserResult.rows[0]
        await client.query('COMMIT')
      } catch (transactionError) {
        await client.query('ROLLBACK')
        throw transactionError
      } finally {
        client.release()
      }
      
      // Get role name
      const roleNameResult = await db.query(
        'SELECT role_name FROM roles WHERE role_id = $1',
        [user.role_id]
      )
      const roleName = roleNameResult.rows[0]?.role_name || 'WORKER'

      const token = generateToken({
        user_id: user.user_id,
        username: user.username,
        role_id: user.role_id,
        role: roleName,
        farm_id: user.farm_id,
      })

      return {
        success: true,
        user: {
          user_id: user.user_id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          role: roleName,
          farm_id: user.farm_id,
          avatar_url: user.avatar_url,
        },
        token,
      }
    } catch (error) {
      logger.error('Error in register:', error)
      throw error
    }
  },

  async login(username, password) {
    try {
      const result = await db.query(
        `SELECT u.*, r.role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.role_id
         WHERE u.username = $1`,
        [username]
      )

      if (result.rows.length === 0) {
        throw new Error('Username hoặc mật khẩu không đúng')
      }

      const user = result.rows[0]

      // Check if user is active
      if (!user.status) {
        throw new Error('Tài khoản đã bị khóa')
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password_hash)
      if (!passwordMatch) {
        throw new Error('Username hoặc mật khẩu không đúng')
      }

      const token = generateToken({
        user_id: user.user_id,
        username: user.username,
        role_id: user.role_id,
        role: user.role_name,
        farm_id: user.farm_id,
      })

      return {
        success: true,
        user: {
          user_id: user.user_id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          role: user.role_name,
          avatar_url: user.avatar_url,
          farm_id: user.farm_id,
        },
        token,
      }
    } catch (error) {
      logger.error('Error in login:', error)
      throw error
    }
  },

  async refreshToken(userId) {
    try {
      const result = await db.query(
        `SELECT u.*, r.role_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.role_id
         WHERE u.user_id = $1 AND u.status = true`,
        [userId]
      )

      if (result.rows.length === 0) {
        throw new Error('User không tồn tại hoặc đã bị khóa')
      }

      const user = result.rows[0]
      const token = generateToken({
        user_id: user.user_id,
        username: user.username,
        role_id: user.role_id,
        role: user.role_name,
        farm_id: user.farm_id,
      })

      return { token }
    } catch (error) {
      logger.error('Error in refreshToken:', error)
      throw error
    }
  },

  async changePassword(userId, oldPassword, newPassword) {
    try {
      // Get user with password hash
      const userResult = await db.query(
        'SELECT user_id, password_hash FROM users WHERE user_id = $1 AND status = true',
        [userId]
      )

      if (userResult.rows.length === 0) {
        throw new Error('User không tồn tại hoặc đã bị khóa')
      }

      const user = userResult.rows[0]

      // Verify old password
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash)
      if (!isPasswordValid) {
        throw new Error('Mật khẩu hiện tại không đúng')
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10)

      // Update password
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE user_id = $2',
        [hashedNewPassword, userId]
      )

      return {
        success: true,
        message: 'Đã đổi mật khẩu thành công'
      }
    } catch (error) {
      logger.error('Error in changePassword:', error)
      throw error
    }
  },
}

module.exports = authService
