const logger = require('../utils/logger');

const auditLogMiddleware = async (req, res, next) => {
  next();
};

module.exports = auditLogMiddleware;
