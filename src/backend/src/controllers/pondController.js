const db = require('../config/database')
const pondService = require('../services/pondService')
const auditLogService = require('../services/auditLogService')
const logger = require('../utils/logger')
const userService = require('../services/userService')

const normalizeUpper = (value) => String(value || '').trim().toUpperCase()

const ensureOwner = (req, res) => {
  if (normalizeUpper(req.user?.role) !== 'OWNER') {
    res.status(403).json({ success: false, message: 'Chỉ chủ trại (Owner) mới có quyền thực hiện thao tác này' })
    return false
  }
  return true
}

const ensureFarmPondAccess = async (req, res, pondId) => {
  const role = String(req.user.role || '').toUpperCase()
  const pond = await pondService.getPondById(pondId)
  if (!pond) {
    res.status(404).json({ success: false, message: 'Ao không tồn tại' })
    return false
  }

  if (role === 'OWNER') {
    const ownerFarmId = String(req.user.farm_id || '')
    if (!ownerFarmId || String(pond.farm_id || '') !== ownerFarmId) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác với ao này' })
      return false
    }
    return true
  }

  if (role === 'WORKER') {
    const hasAccess = await pondService.hasTechnicianWorkerAccess(pondId, req.user.user_id)
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác với ao này' })
      return false
    }
    return true
  }

  const ownerFarmId = String(req.user.farm_id || '')
  const pondFarmId = String(pond.farm_id || '')
  if (!ownerFarmId || ownerFarmId !== pondFarmId) {
    res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác với ao này' })
    return false
  }
  return true
}

const pondController = {
  async getAllPonds(req, res) {
    try {
      const ponds = await pondService.getAllPonds(req.user.user_id, req.user.role, req.user.farm_id || null)
      res.json({ success: true, data: ponds })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getPondDetail(req, res) {
    try {
      const pond = await pondService.getPondById(req.params.pondId)
      if (!pond) return res.status(404).json({ success: false, message: 'Ao không tồn tại' })
      const hasAccess = await ensureFarmPondAccess(req, res, req.params.pondId)
      if (!hasAccess) return
      res.json({ success: true, data: pond })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async createPond(req, res) {
    try {
      if (!ensureOwner(req, res)) return
      const { pond_name, pondName, area_m2, areaMeter, depth_m, depthMeter, assigned_staff, assignedStaff } = req.body
      const finalPondName = pond_name || pondName
      const finalAreaMeter = area_m2 || areaMeter
      const finalDepthMeter = depth_m || depthMeter
      const finalAssignedStaff = assigned_staff || assignedStaff

      if (!String(finalPondName || '').trim()) return res.status(400).json({ success: false, message: 'Tên ao không được để trống' })
      if (!(Number(finalAreaMeter) > 0) || !(Number(finalDepthMeter) > 0)) return res.status(400).json({ success: false, message: 'Diện tích và độ sâu phải lớn hơn 0' })

      if (finalAssignedStaff) {
        const user = await userService.getUserById(finalAssignedStaff)
        if (!user) return res.status(400).json({ success: false, message: 'Người phụ trách không tồn tại' })
        if (normalizeUpper(user.role) !== 'TECHNICIAN') return res.status(403).json({ success: false, message: 'Người phụ trách phải là Kỹ sư (TECHNICIAN)' })
        if (!Boolean(user.status)) return res.status(400).json({ success: false, message: 'Kỹ sư phụ trách phải ở trạng thái hoạt động' })
        if (String(user.farm_id || '') !== String(req.user.farm_id || '')) return res.status(403).json({ success: false, message: 'Không thể gán người phụ trách thuộc trại khác' })
      }

      const pond = await pondService.createPond({
        pondName: finalPondName, areaMeter: finalAreaMeter, depthMeter: finalDepthMeter, assignedStaff: finalAssignedStaff || null, farmId: req.user.farm_id || null,
      })

      await auditLogService.logActivity(req.user.user_id, 'CREATE', 'POND', pond.pond_id, { pondCode: pond.pond_code, pondName: finalPondName }, auditLogService.resolveEntityLabel('POND'));
      res.status(201).json({ success: true, data: pond })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async updatePond(req, res) {
    try {
      if (!ensureOwner(req, res)) return
      const hasAccess = await ensureFarmPondAccess(req, res, req.params.pondId)
      if (!hasAccess) return

      const assignedStaff = req.body.assigned_staff || req.body.assignedStaff
      if (assignedStaff) {
        const user = await userService.getUserById(assignedStaff)
        if (!user) return res.status(400).json({ success: false, message: 'Người phụ trách không tồn tại' })
        if (normalizeUpper(user.role) !== 'TECHNICIAN') return res.status(403).json({ success: false, message: 'Người phụ trách phải là Kỹ sư' })
        if (!Boolean(user.status)) return res.status(400).json({ success: false, message: 'Kỹ sư phụ trách phải ở trạng thái hoạt động' })
        if (String(user.farm_id || '') !== String(req.user.farm_id || '')) return res.status(403).json({ success: false, message: 'Không thể gán người phụ trách thuộc trại khác' })
      }

      const pond = await pondService.updatePond(req.params.pondId, req.body, req.user.farm_id || null)

      const newStatus = req.body.status ? String(req.body.status).toUpperCase() : null;
      if (newStatus === 'TAM_NGUNG') {
        await db.query(`UPDATE tasks SET status = 'CANCELLED', updated_at = NOW(), description = description || E'\n[HỆ THỐNG TỰ ĐỘNG HỦY: Ao nuôi đã bị đóng hoặc tạm ngưng]' WHERE pond_id = $1 AND status IN ('PENDING', 'IN_PROGRESS')`, [req.params.pondId]);
        await db.query(`UPDATE task_workers SET status = 'CANCELLED' WHERE task_id IN (SELECT task_id FROM tasks WHERE pond_id = $1 AND status = 'CANCELLED') AND status IN ('ASSIGNED', 'DOING')`, [req.params.pondId]);
      }

      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'POND', req.params.pondId, req.body, auditLogService.resolveEntityLabel('POND'));
      res.json({ success: true, data: pond })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async updatePondStatus(req, res) {
    try {
      res.status(400).json({ success: false, message: 'Trạng thái ao được cập nhật tự động theo nghiệp vụ, không chỉnh sửa trực tiếp' })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async deletePond(req, res) {
    try {
      if (!ensureOwner(req, res)) return
      const hasAccess = await ensureFarmPondAccess(req, res, req.params.pondId)
      if (!hasAccess) return

      const result = await pondService.deletePond(req.params.pondId)
      await auditLogService.logActivity(req.user.user_id, 'DELETE', 'POND', req.params.pondId, { action: 'Xóa ao' }, auditLogService.resolveEntityLabel('POND'));
      res.json(result)
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async getAssignmentMatrix(req, res) {
    try {
      if (!ensureOwner(req, res)) return
      if (!req.user.farm_id) return res.status(400).json({ success: false, message: 'Owner chưa được gán trại nuôi' })
      const data = await pondService.getAssignmentMatrixByFarm(req.user.farm_id)
      res.json({ success: true, data })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async updateAssignment(req, res) {
    try {
      if (!ensureOwner(req, res)) return
      const hasAccess = await ensureFarmPondAccess(req, res, req.params.pondId)
      if (!hasAccess) return

      const { technicianId } = req.body
      const pond = await pondService.getPondById(req.params.pondId)
      if (!pond) return res.status(404).json({ success: false, message: 'Ao không tồn tại' })

      let nextTechnicianId = null
      if (technicianId) {
        const technician = await userService.getUserById(technicianId)
        if (!technician) return res.status(400).json({ success: false, message: 'Kỹ sư phụ trách không tồn tại' })
        if (normalizeUpper(technician.role) !== 'TECHNICIAN') return res.status(400).json({ success: false, message: 'Người được phân công phải là kỹ sư' })
        if (!Boolean(technician.status)) return res.status(400).json({ success: false, message: 'Kỹ sư không ở trạng thái hoạt động' })
        if (String(technician.farm_id || '') !== String(req.user.farm_id || '')) return res.status(403).json({ success: false, message: 'Không thể phân công kỹ sư thuộc trại khác' })
        if (pond.assigned_staff && Number(pond.assigned_staff) !== Number(technicianId)) return res.status(400).json({ success: false, message: 'Ao đã có kỹ sư phụ trách. Hãy hủy phân công hiện tại trước.' })
        nextTechnicianId = Number(technicianId)
      }

      const updated = await pondService.updatePondAssignment(req.params.pondId, nextTechnicianId)
      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'POND', req.params.pondId, { action: 'Phân công kỹ sư phụ trách', technicianId: nextTechnicianId }, auditLogService.resolveEntityLabel('POND'))
      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async updateUsageStatus(req, res) {
    try {
      if (!ensureOwner(req, res)) return
      const hasAccess = await ensureFarmPondAccess(req, res, req.params.pondId)
      if (!hasAccess) return

      const { usageStatus, usage_status } = req.body
      const updated = await pondService.updateUsageStatus(req.params.pondId, usageStatus || usage_status)
      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'POND', req.params.pondId, { action: 'Cập nhật trạng thái sử dụng ao', usageStatus: usageStatus || usage_status }, auditLogService.resolveEntityLabel('POND'))
      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  // 🌟 NÂNG CẤP: Kỹ sư xác nhận Xử lý xong (Từ Đang xử lý -> Tạm ngưng)
  async completeRenovation(req, res) {
    try {
      const hasAccess = await ensureFarmPondAccess(req, res, req.params.pondId)
      if (!hasAccess) return

      const role = normalizeUpper(req.user?.role)
      if (!['TECHNICIAN', 'OWNER'].includes(role)) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xác nhận hoàn tất xử lý ao' })
      }

      const pond = await pondService.getPondById(req.params.pondId)
      if (role === 'TECHNICIAN' && Number(pond.assigned_staff) !== Number(req.user.user_id)) {
        return res.status(403).json({ success: false, message: 'Bạn chỉ có thể xác nhận ao được phân công cho mình' })
      }

      const updated = await pondService.completeRenovation(req.params.pondId)

      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'POND', req.params.pondId, { action: 'Xác nhận xử lý vệ sinh ao xong (Trả về Tạm Ngưng)' }, auditLogService.resolveEntityLabel('POND'))
      res.json({ success: true, data: updated })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },
}

module.exports = pondController