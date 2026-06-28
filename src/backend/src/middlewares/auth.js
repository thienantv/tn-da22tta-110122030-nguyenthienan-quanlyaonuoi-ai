const { verifyToken } = require('../utils/jwtHelper')
const logger = require('../utils/logger')

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    logger.warn('No token provided')
    return res.status(401).json({
      success: false,
      message: 'Không có token xác thực',
    })
  }

  const decoded = verifyToken(token)
  if (!decoded) {
    logger.warn('Invalid token')
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn',
    })
  }

  req.user = decoded
  next()
}

module.exports = {
  authenticateToken,
}
