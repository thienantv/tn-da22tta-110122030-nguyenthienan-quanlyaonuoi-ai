const logger = require('../utils/logger')

const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.warn('No user in request')
      return res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập',
      })
    }

    // Nếu không chỉ định vai trò, cho phép tất cả
    if (allowedRoles.length === 0) {
      return next()
    }

    // Kiểm tra vai trò (treat OWNER as equivalent to ADMIN)
    const userRole = String(req.user.role || '').toUpperCase()
    const allowedUpper = allowedRoles.map((r) => String(r || '').toUpperCase())

    const isAllowedDirect = allowedUpper.includes(userRole)

    // Allow if role directly allowed
    if (isAllowedDirect) return next()

    logger.warn(`User ${req.user.user_id} không có quyền truy cập: ${req.originalUrl}`)
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền truy cập',
    })
  }
}

module.exports = {
  authorize,
}
