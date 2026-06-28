const userService = require('../services/userService')
const logger = require('../utils/logger')
const auditLogService = require('../services/auditLogService')
const fs = require('fs')
const path = require('path')

const userController = {
  async getCurrentUser(req, res) {
    try {
      const user = await userService.getUserById(req.user.user_id)
      res.json({ success: true, data: user })
    } catch (error) {
      logger.error('Error in getCurrentUser:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getUserById(req, res) {
    try {
      const user = await userService.getUserById(req.params.userId)
      if (!user) {
        return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' })
      }

      const currentRole = String(req.user.role || '').toUpperCase()
      if (currentRole === 'OWNER' && String(user.farm_id || '') !== String(req.user.farm_id || '')) {
        return res.status(403).json({ success: false, message: 'Không có quyền xem người dùng này' })
      }

      res.json({ success: true, data: user })
    } catch (error) {
      logger.error('Error in getUserById:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async createUser(req, res) {
    try {
      const { username, email, fullName, role, password, phone } = req.body

      // Owner may create a user with minimal fields: username, password and role.
      // Other fields (fullName, email, phone) are optional. If fullName is not
      // provided, default it based on selected role.
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp tên tài khoản và mật khẩu khởi tạo',
          errors: {
            username: !username ? 'Tên tài khoản là bắt buộc' : undefined,
            password: !password ? 'Mật khẩu khởi tạo là bắt buộc' : undefined,
          },
        })
      }

      const creatorRole = String(req.user.role || '').toUpperCase()
      const targetRole = String(role || 'WORKER').toUpperCase()

      if (creatorRole !== 'OWNER') {
        return res.status(403).json({ success: false, message: 'Chỉ Owner mới được tạo tài khoản nhân viên' })
      }

      const allowedRoles = ['TECHNICIAN', 'WORKER']
      if (!allowedRoles.includes(targetRole)) {
        return res.status(400).json({
          success: false,
          message: 'Owner chỉ có thể tạo tài khoản Technician hoặc Worker',
          errors: { role: 'Vai trò không hợp lệ' },
        })
      }

      const pool = require('../config/database')

      const fieldErrors = {}
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const usernameRegex = /^[A-Za-z0-9_]{4,30}$/
      const phoneRegex = /^0\d{9}$/

      if (!usernameRegex.test(username)) fieldErrors.username = 'Tên tài khoản chỉ gồm chữ, số và dấu gạch dưới, độ dài 4-30'
      if (email && !emailRegex.test(email)) fieldErrors.email = 'Email không hợp lệ'
      if (phone && !phoneRegex.test(phone)) fieldErrors.phone = 'Số điện thoại phải bắt đầu bằng 0 và có đúng 10 chữ số'

      const nameRegex = /^[\p{L}\p{M}0-9\s'.-]{2,}$/u
      if (fullName && !nameRegex.test(String(fullName).trim())) fieldErrors.fullName = 'Họ và tên không hợp lệ'
      if (String(password || '').length < 8) fieldErrors.password = 'Mật khẩu khởi tạo phải có ít nhất 8 ký tự'

      const duplicateChecks = await Promise.all([
        pool.query('SELECT user_id FROM users WHERE username = $1', [username]),
        email ? pool.query('SELECT user_id FROM users WHERE email = $1', [email]) : Promise.resolve({ rows: [] }),
        phone ? pool.query('SELECT user_id FROM users WHERE phone = $1', [phone]) : Promise.resolve({ rows: [] }),
      ])
      if (duplicateChecks[0].rows.length > 0) fieldErrors.username = 'Tên đăng nhập đã tồn tại'
      if (duplicateChecks[1].rows.length > 0) fieldErrors.email = 'Email đã tồn tại'
      if (duplicateChecks[2].rows.length > 0) fieldErrors.phone = 'Số điện thoại đã tồn tại'

      if (Object.keys(fieldErrors).length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu tài khoản nhân viên không hợp lệ',
          errors: fieldErrors,
        })
      }

      const roleRes = await pool.query('SELECT role_id FROM roles WHERE role_name = $1', [targetRole])
      if (roleRes.rows.length === 0) return res.status(400).json({ success: false, message: 'Role không tồn tại' })
      const roleId = roleRes.rows[0].role_id

      const farmId = req.user.farm_id
      const finalFullName = fullName && String(fullName).trim()
        ? fullName.trim()
        : (targetRole === 'TECHNICIAN' ? 'Kỹ sư' : 'Nhân viên')

      const created = await userService.createUserWithDetails({
        fullName: finalFullName,
        username,
        email: email || null,
        phone: phone || null,
        password,
        roleId,
        farmId,
      })

      res.status(201).json({ success: true, data: created, message: 'Đã tạo tài khoản nhân viên' })
    } catch (error) {
      logger.error('Error in createUser:', error)
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async getAllUsers(req, res) {
    try {
      const currentRole = String(req.user.role || '').toUpperCase()
      const farmId = req.user.farm_id
      let users = []

      // Nếu là OWNER hoặc TECHNICIAN, chỉ lấy user thuộc đúng Farm đó
      if (['OWNER', 'TECHNICIAN'].includes(currentRole)) {
        if (!farmId) {
          return res.json({ success: true, data: [] }) // Trại chưa có ID thì trả về rỗng
        }
        users = await userService.getUsersByFarm(farmId)
      } else {
        // Trừ khi là ADMIN tổng (nếu có) mới được quét toàn bộ
        users = await userService.getAllUsers()
      }

      res.json({ success: true, data: users })
    } catch (error) {
      logger.error('Error in getAllUsers:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getWorkerUsers(req, res) {
    try {
      const users = req.user?.farm_id
        ? await userService.getUsersByFarm(req.user.farm_id)
        : await userService.getAllUsers()
      const currentRole = String(req.user.role || '').toUpperCase()
      const currentFarmId = req.user.farm_id || null

      let staff = users.filter(u => ['WORKER', 'TECHNICIAN'].includes(String(u.role).toUpperCase()))

      if (currentRole === 'OWNER') {
        staff = staff.filter(u => String(u.farm_id || '') === String(currentFarmId || ''))
      }

      res.json({ success: true, data: staff })
    } catch (error) {
      logger.error('Error in getWorkerUsers:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async lockUser(req, res) {
    try {
      const targetUser = await userService.getUserById(req.params.userId)

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'Người dùng không tồn tại'
        })
      }

      if (String(req.user.user_id) === String(req.params.userId)) {
        return res.status(403).json({
          success: false,
          message: 'Không thể tự khóa tài khoản của chính mình'
        })
      }

      if (String(targetUser.role || '').toUpperCase() === 'OWNER') {
        return res.status(403).json({
          success: false,
          message: 'Không thể khóa tài khoản có vai trò Owner'
        })
      }

      if (String(targetUser.farm_id || '') !== String(req.user.farm_id || '')) {
        return res.status(403).json({ success: false, message: 'Không có quyền thao tác với người dùng này' })
      }

      const result = await userService.lockUser(req.params.userId)

      // Log user lock action
      await auditLogService.logActivity(
        req.user.user_id,
        'LOCK',
        'USER',
        req.params.userId,
        { action: 'Khóa tài khoản' },
        auditLogService.resolveEntityLabel('USER')
      );

      res.json(result)
    } catch (error) {
      logger.error('Error in lockUser:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async unlockUser(req, res) {
    try {
      const targetUser = await userService.getUserById(req.params.userId)
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' })
      }

      if (String(targetUser.farm_id || '') !== String(req.user.farm_id || '')) {
        return res.status(403).json({ success: false, message: 'Không có quyền thao tác với người dùng này' })
      }

      const result = await userService.unlockUser(req.params.userId)

      // Log user unlock action
      await auditLogService.logActivity(
        req.user.user_id,
        'UNLOCK',
        'USER',
        req.params.userId,
        { action: 'Mở khóa tài khoản' },
        auditLogService.resolveEntityLabel('USER')
      );

      res.json(result)
    } catch (error) {
      logger.error('Error in unlockUser:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async changePassword(req, res) {
    try {
      const { oldPassword, newPassword, passwordConfirm } = req.body

      if (!oldPassword || !newPassword || !passwordConfirm) {
        return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin' })
      }

      if (newPassword !== passwordConfirm) {
        return res.status(400).json({ success: false, message: 'Mật khẩu không khớp' })
      }

      const result = await userService.changePassword(req.user.user_id, oldPassword, newPassword)
      res.json(result)
    } catch (error) {
      logger.error('Error in changePassword:', error)
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async deleteUser(req, res) {
    try {
      const targetUser = await userService.getUserById(req.params.userId)
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' })
      }

      if (String(targetUser.farm_id || '') !== String(req.user.farm_id || '')) {
        return res.status(403).json({ success: false, message: 'Không có quyền xóa người dùng này' })
      }

      if (String(targetUser.role || '').toUpperCase() === 'OWNER') {
        return res.status(403).json({ success: false, message: 'Không thể xóa tài khoản Owner' })
      }

      const result = await userService.deleteUser(req.params.userId)
      res.json(result)
    } catch (error) {
      logger.error('Error in deleteUser:', error)
      // 🌟 Đổi thành 400 để Frontend bắt đúng message lỗi gửi lên màn hình
      res.status(400).json({ success: false, message: error.message }) 
    }
  },

  async updateUser(req, res) {
    try {
      const { full_name, email, phone, avatar_url } = req.body
      const userId = req.params.userId

      if (!full_name && !email && !phone && avatar_url === undefined) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp dữ liệu cập nhật' })
      }

      const updateData = {}
      if (full_name) updateData.full_name = full_name
      if (email) updateData.email = email
      if (phone) updateData.phone = phone
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url

      const result = await userService.updateUser(userId, updateData)
      res.json(result)
    } catch (error) {
      logger.error('Error in updateUser:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async updateCurrentUserProfile(req, res) {
    try {
      const { full_name, email, phone, avatar_url } = req.body
      const userId = req.user.user_id

      if (!full_name && !email && !phone && avatar_url === undefined) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp dữ liệu cập nhật' })
      }

      const updateData = {}
      if (full_name) updateData.full_name = full_name
      if (email) updateData.email = email
      if (phone) updateData.phone = phone
      if (avatar_url !== undefined) updateData.avatar_url = avatar_url

      const result = await userService.updateUser(userId, updateData)
      res.json(result)
    } catch (error) {
      logger.error('Error in updateCurrentUserProfile:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async uploadCurrentUserAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn một file ảnh hợp lệ' })
      }

      const userId = req.user.user_id
      const currentUser = await userService.getUserById(userId)
      const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`

      if (currentUser?.avatar_url && currentUser.avatar_url.includes('/uploads/avatars/')) {
        try {
          const oldFileName = path.basename(currentUser.avatar_url.split('?')[0])
          const oldFilePath = path.join(__dirname, '../../uploads/avatars', oldFileName)
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath)
          }
        } catch (cleanupError) {
          logger.warn('Could not remove old avatar file:', cleanupError)
        }
      }

      const result = await userService.updateUser(userId, { avatar_url: avatarUrl })
      return res.json({
        success: true,
        message: 'Đã cập nhật ảnh đại diện',
        data: result.data,
      })
    } catch (error) {
      logger.error('Error in uploadCurrentUserAvatar:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async updateUserRole(req, res) {
    try {
      const { role } = req.body
      const userId = req.params.userId

      if (!role || !['TECHNICIAN', 'WORKER'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Owner chỉ được đổi vai trò giữa Technician và Worker' })
      }

      const targetUser = await userService.getUserById(userId)
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' })
      }

      const currentRole = String(req.user.role || '').toUpperCase()
      if (currentRole === 'OWNER') {
        if (String(targetUser.farm_id || '') !== String(req.user.farm_id || '')) {
          return res.status(403).json({ success: false, message: 'Không có quyền thay đổi vai trò cho người dùng này' })
        }
      }

      if (String(targetUser.role || '').toUpperCase() === 'OWNER') {
        return res.status(403).json({ success: false, message: 'Không thể thay đổi vai trò của tài khoản Owner' })
      }

      const result = await userService.updateUserRole(userId, role)

      // Log role change
      await auditLogService.logActivity(
        req.user.user_id,
        'UPDATE',
        'USER_ROLE',
        userId,
        { newRole: role },
        auditLogService.resolveRoleLabel(role)
      );

      res.json(result)
    } catch (error) {
      logger.error('Error in updateUserRole:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async removeUserFromFarm(req, res) {
    try {
      const userId = req.params.userId
      const targetUser = await userService.getUserById(userId)
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' })
      }

      const currentRole = String(req.user.role || '').toUpperCase()
      if (currentRole === 'OWNER') {
        if (String(targetUser.farm_id || '') !== String(req.user.farm_id || '')) {
          return res.status(403).json({ success: false, message: 'Không có quyền thao tác với người dùng này' })
        }
      }

      const result = await userService.removeUserFromFarm(userId)

      // Log removal
      await auditLogService.logActivity(
        req.user.user_id,
        'UPDATE',
        'USER',
        userId,
        { action: 'Gỡ khỏi trại và khoá tài khoản' },
        auditLogService.resolveEntityLabel('USER')
      );

      res.json(result)
    } catch (error) {
      logger.error('Error in removeUserFromFarm:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async assignUserToFarm(req, res) {
    try {
      const userId = req.params.userId
      const { farm_id } = req.body

      if (!farm_id) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp farm_id' })
      }

      const targetUser = await userService.getUserById(userId)
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' })
      }

      const result = await userService.updateUser(userId, { farm_id })

      // Log assignment
      await auditLogService.logActivity(
        req.user.user_id,
        'UPDATE',
        'USER',
        userId,
        { action: `Gán vào trại: ${farm_id}` },
        auditLogService.resolveEntityLabel('USER')
      )

      res.json({ success: true, data: result.data, message: 'Đã gán người dùng vào trại' })
    } catch (error) {
      logger.error('Error in assignUserToFarm:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getTechnicianWorkerMatrix(req, res) {
    try {
      console.log('USER:', req.user)

      const farmId = req.user?.farm_id

      if (!farmId) {
        return res.status(400).json({
          success: false,
          message: 'Owner chưa được gán trại nuôi',
        })
      }

      const data = await userService.getTechnicianWorkerMatrixByFarm(farmId)

      return res.json({
        success: true,
        data,
      })
    } catch (error) {
      console.error('TECH MATRIX ERROR STACK:', error)
      console.log('req.user =', req.user)
      console.log('farmId =', req.user?.farm_id)
      console.log('type farmId =', typeof req.user?.farm_id)
      return res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  },

  async updateTechnicianWorkerAssignment(req, res) {
    try {
      const { technicianId } = req.params
      const { workerIds } = req.body

      if (!Array.isArray(workerIds)) {
        return res.status(400).json({
          success: false,
          message: 'workerIds must be array',
        })
      }

      await userService.updateTechnicianWorkerAssignment(
        technicianId,
        workerIds
      )

      res.json({
        success: true,
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  },
}

module.exports = userController
