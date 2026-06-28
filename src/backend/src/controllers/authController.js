const authService = require('../services/authService')
const logger = require('../utils/logger')
const auditLogService = require('../services/auditLogService')
const { buildRequestMeta } = require('../utils/requestMeta')
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const emailService = require('../services/emailService');

const authController = {
  async register(req, res) {
    try {
      const { fullName, username, email, password, passwordConfirm, farmName, phone } = req.body

      if (!fullName || !username || !email || !password || !passwordConfirm || !phone) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng điền đầy đủ thông tin',
        })
      }

      if (password !== passwordConfirm) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu không khớp',
        })
      }

      const result = await authService.register(fullName, username, email, phone, password, farmName)

      // Per UX spec: after successful registration, prompt user to login.
      res.status(201).json(result)
    } catch (error) {
      logger.error('Register error:', error)
      if (error && error.fieldErrors) {
        return res.status(400).json({
          success: false,
          message: error.message || 'Dữ liệu không hợp lệ',
          errors: error.fieldErrors,
        })
      }
      res.status(400).json({
        success: false,
        message: error.message || 'Lỗi đăng ký',
      })
    }
  },

  async login(req, res) {
    const { username, password } = req.body
    const requestMeta = buildRequestMeta(req)

    try {
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập username và mật khẩu',
        })
      }

      const result = await authService.login(username, password)
      
      // Log successful login
      if (result.success && result.user) {
        await auditLogService.logActivity(
          result.user.user_id,
          'LOGIN',
          'USER',
          result.user.user_id,
          { username, timestamp: new Date().toISOString() },
          auditLogService.resolveEntityLabel('USER'),
          requestMeta
        )
      }
      
      res.json(result)
    } catch (error) {
      logger.error('Login error:', error)
      
      // Log failed login attempt
      try {
        const pool = require('../config/database')
        const userResult = await pool.query('SELECT user_id FROM users WHERE username = $1', [username])
        if (userResult.rows.length > 0) {
          await auditLogService.logActivity(
            userResult.rows[0].user_id,
            'LOGIN_FAILED',
            'USER',
            userResult.rows[0].user_id,
            { username, reason: error.message, timestamp: new Date().toISOString() },
            auditLogService.resolveEntityLabel('USER'),
            requestMeta
          )
        }
      } catch (auditError) {
        logger.error('Error logging failed login:', auditError)
      }
      
      res.status(401).json({
        success: false,
        message: error.message || 'Lỗi đăng nhập',
      })
    }
  },

  async refreshToken(req, res) {
    try {
      const userId = req.user.user_id
      const result = await authService.refreshToken(userId)
      res.json({
        success: true,
        ...result,
      })
    } catch (error) {
      logger.error('Refresh token error:', error)
      res.status(401).json({
        success: false,
        message: error.message || 'Lỗi làm mới token',
      })
    }
  },

  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword } = req.body
      const userId = req.user.user_id

      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới',
        })
      }

      const result = await authService.changePassword(userId, oldPassword, newPassword)
      res.json(result)
    } catch (error) {
      logger.error('Change password error:', error)
      res.status(400).json({
        success: false,
        message: error.message || 'Lỗi đổi mật khẩu',
      })
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ email' });
      }

      // 1. Tìm user theo email
      const userRes = await db.query('SELECT user_id, email FROM users WHERE email = $1', [email]);
      if (userRes.rows.length === 0) {
        // Trả về chung chung để bảo mật (không tiết lộ email có tồn tại hay không)
        return res.status(200).json({ success: true, message: 'Nếu email hợp lệ, một mật khẩu mới đã được gửi đến bạn.' });
      }

      const user = userRes.rows[0];

      // 2. Tạo mật khẩu ngẫu nhiên 8 ký tự
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // 3. Cập nhật mật khẩu mới vào Database
      await db.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hashedPassword, user.user_id]);

      // 4. Gửi email cho người dùng
      await emailService.sendResetPasswordEmail(user.email, tempPassword);

      res.status(200).json({ success: true, message: 'Nếu email hợp lệ, một mật khẩu mới đã được gửi đến bạn.' });

    } catch (error) {
      console.error('Error in forgotPassword:', error);
      res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống' });
    }
  },
}

module.exports = authController
