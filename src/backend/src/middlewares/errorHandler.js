const logger = require('../utils/logger')

const errorHandler = (err, req, res, next) => {
  logger.error('Unexpected error:', err)
  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ',
  })
}

const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} không tồn tại`,
  })
}

module.exports = {
  errorHandler,
  notFoundHandler,
}
