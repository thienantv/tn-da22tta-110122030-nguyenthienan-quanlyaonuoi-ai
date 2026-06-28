const logger = require('../utils/logger');

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  OWNER: 'Chủ trại',
  TECHNICIAN: 'Kỹ thuật viên',
  WORKER: 'Công nhân',
  ACCOUNTANT: 'Kế toán',
};

const ENTITY_LABELS = {
  USER: 'Người dùng',
  USERS: 'Người dùng',
  USER_ROLE: 'Vai trò',
  POND: 'Ao',
  PONDS: 'Ao',
  SEASON: 'Mùa vụ',
  SEASONS: 'Mùa vụ',
  PRODUCT: 'Sản phẩm',
  PRODUCTS: 'Sản phẩm',
  PRODUCT_CATEGORY: 'Danh mục sản phẩm',
  PRODUCT_CATEGORIES: 'Danh mục sản phẩm',
  DISEASE: 'Bệnh tôm',
  DISEASES: 'Bệnh tôm',
  SENSOR: 'Cảm biến',
  SENSORS: 'Cảm biến',
  TASK: 'Công việc',
  TASKS: 'Công việc',
  ENVIRONMENT: 'Môi trường',
  ENVIRONMENT_LOG: 'Nhật ký môi trường',
  ENVIRONMENT_LOGS: 'Nhật ký môi trường',
  CULTIVATION_LOG: 'Nhật ký canh tác',
  CULTIVATION_LOGS: 'Nhật ký canh tác',
  NOTIFICATION: 'Thông báo',
  NOTIFICATIONS: 'Thông báo',
  AI_MODEL: 'AI',
  AUDIT_LOG: 'Nhật ký hoạt động',
  AUDIT_LOGS: 'Nhật ký hoạt động',
};

function normalizeEntityType(entityType) {
  if (!entityType) return '';

  return String(entityType)
    .trim()
    .replace(/[-\s]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function resolveRoleLabel(role) {
  if (!role) return '';

  const normalizedRole = String(role).trim().toUpperCase();
  return ROLE_LABELS[normalizedRole] || role;
}

function resolveEntityLabel(entityType, details = null) {
  let normalizedType = normalizeEntityType(entityType);

  if (!normalizedType && details && typeof details === 'object' && details.path) {
    const inferredSegments = String(details.path)
      .split('?')[0]
      .split('/')
      .filter((segment) => segment && segment !== 'api');

    normalizedType = normalizeEntityType(inferredSegments[0] || '');
  }

  if (normalizedType === 'USER_ROLE') {
    const roleValue = details && typeof details === 'object'
      ? details.newRole || details.role || details.roleName || details.targetRole
      : null;

    return roleValue ? resolveRoleLabel(roleValue) : 'Vai trò';
  }

  if (normalizedType === 'USER') {
    const roleValue = details && typeof details === 'object'
      ? details.newRole || details.role || details.roleName
      : null;

    return roleValue ? resolveRoleLabel(roleValue) : 'Người dùng';
  }

  return ENTITY_LABELS[normalizedType] || entityType || 'Không xác định';
}

function normalizeDetails(details) {
  if (details === null || details === undefined) {
    return null;
  }

  if (typeof details === 'string') {
    return details;
  }

  return JSON.stringify(details);
}

const auditLogService = {
  resolveRoleLabel,

  resolveEntityLabel,

  async logActivity(userId, action, entityType, entityId, details = null, entityLabel = null, requestMeta = {}) {
    const resolvedLabel = entityLabel || resolveEntityLabel(entityType, details);
    logger.info(`Audit log disabled: User ${userId} - ${action} ${resolvedLabel} ${entityId || ''}`.trim());
    return null;
  },

  async getAllActivityLogs(filters = {}, limit = 100, offset = 0) {
    logger.info('Activity log retrieval disabled');
    return [];
  },
};

module.exports = auditLogService;
