const { seasonController } = require('./commonController')
const { seasonService } = require('../services/commonService')
// adminController removed
const expenseController = require('./expenseController')
const sensorController = require('./sensorController')
const diseaseController = require('./diseaseController')
const taskController = require('./taskController')
const notificationController = require('./notificationController')
const productController = require('./productController')
const pool = require('../config/database')
const environmentLogService = require('../services/environmentLogService')
const logger = require('../utils/logger')

const isAdmin = (role) => {
  const r = String(role || '').toUpperCase()
  return r === 'OWNER'
}

const ensurePondInFarm = async (pondId, req) => {
  const pondResult = await pool.query('SELECT pond_id FROM ponds WHERE pond_id = $1 AND farm_id = $2', [pondId, req.user.farm_id])
  return pondResult.rows.length > 0
}

const isTechnicianOrWorker = (role) => {
  const normalizedRole = String(role || '').toUpperCase()
  return normalizedRole === 'TECHNICIAN' || normalizedRole === 'WORKER'
}

const ensureSensorInFarm = async (sensorId, req) => {
  const result = await pool.query(
    `SELECT s.sensor_id
     FROM sensors s
     JOIN ponds p ON p.pond_id = s.pond_id
     WHERE s.sensor_id = $1 AND p.farm_id = $2`,
    [sensorId, req.user.farm_id]
  )

  return result.rows.length > 0
}

// feedLogController removed

// Environment Log Controller
const environmentLogController = {
  async createEnvironmentLog(req, res) {
    try {
      const { pondId, ph, temperature, salinity, oxygen, turbidity } = req.body

      if (!pondId || ph === undefined || temperature === undefined || salinity === undefined || oxygen === undefined || turbidity === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập đầy đủ ao, pH, nhiệt độ, oxy hòa tan, độ mặn và độ đục',
        })
      }

      const pond = await pool.query('SELECT * FROM ponds WHERE pond_id = $1', [pondId])
      if (!pond.rows.length) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ được nhập dữ liệu cho ao được phân công',
        })
      }

      const canAccessPond = await ensurePondInFarm(pondId, req)
      if (!canAccessPond) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ được nhập dữ liệu cho ao thuộc trại của mình',
        })
      }

      const log = await environmentLogService.createEnvironmentLog(pondId, ph, temperature, salinity, oxygen, turbidity, req.user.user_id)

      try {
        const pondResult = await pool.query(
          `SELECT p.pond_code, p.pond_name, p.farm_id
           FROM ponds p
           WHERE p.pond_id = $1`,
          [pondId]
        )
        const pondInfo = pondResult.rows[0] || {}
        const thresholds = await environmentLogService.getEnvironmentThresholds(pondId)

        if (thresholds) {
          const alerts = []
          const pondLabel = pondInfo.pond_code || pondInfo.pond_name || `ao ${pondId}`
          const toNumber = (value) => {
            if (value === null || value === undefined || value === '') return null
            const parsed = Number(value)
            return Number.isNaN(parsed) ? null : parsed
          }

          const phValue = toNumber(ph)
          const tempValue = toNumber(temperature)
          const salinityValue = toNumber(salinity)
          const oxygenValue = toNumber(oxygen)
          const turbidityValue = toNumber(turbidity)
          const minPh = toNumber(thresholds.min_ph)
          const maxPh = toNumber(thresholds.max_ph)
          const minTemp = toNumber(thresholds.min_temp)
          const maxTemp = toNumber(thresholds.max_temp)
          const minSalinity = toNumber(thresholds.min_salinity)
          const maxSalinity = toNumber(thresholds.max_salinity)
          const minOxygen = toNumber(thresholds.min_oxygen)
          const maxOxygen = toNumber(thresholds.max_oxygen)
          const minTurbidity = toNumber(thresholds.min_turbidity)
          const maxTurbidity = toNumber(thresholds.max_turbidity)

          if (phValue !== null && minPh !== null && phValue < minPh) alerts.push(`pH thấp ở ${pondLabel}`)
          if (phValue !== null && maxPh !== null && phValue > maxPh) alerts.push(`pH cao ở ${pondLabel}`)
          if (tempValue !== null && minTemp !== null && tempValue < minTemp) alerts.push(`Nhiệt độ thấp ở ${pondLabel}`)
          if (tempValue !== null && maxTemp !== null && tempValue > maxTemp) alerts.push(`Nhiệt độ cao ở ${pondLabel}`)
          if (salinityValue !== null && minSalinity !== null && salinityValue < minSalinity) alerts.push(`Độ mặn thấp ở ${pondLabel}`)
          if (salinityValue !== null && maxSalinity !== null && salinityValue > maxSalinity) alerts.push(`Độ mặn cao ở ${pondLabel}`)
          if (oxygenValue !== null && minOxygen !== null && oxygenValue < minOxygen) alerts.push(`Oxy thấp ở ${pondLabel}`)
          if (oxygenValue !== null && maxOxygen !== null && oxygenValue > maxOxygen) alerts.push(`Oxy cao ở ${pondLabel}`)
          if (turbidityValue !== null && minTurbidity !== null && turbidityValue < minTurbidity) alerts.push(`Độ đục thấp ở ${pondLabel}`)
          if (turbidityValue !== null && maxTurbidity !== null && turbidityValue > maxTurbidity) alerts.push(`Độ đục cao ở ${pondLabel}`)

          if (alerts.length > 0) {
            // Notify owners (existing behaviour)
            await notificationController.notifyOwners('Cảnh báo môi trường', alerts.join(' | '))
            // Also notify technicians assigned to the same farm so on-duty techs receive realtime/manual alerts
            try {
              await notificationController.notifyTechnicians('Cảnh báo môi trường', alerts.join(' | '), pondInfo.farm_id)
            } catch (techNotifyErr) {
              logger.error('Error notifying technicians for manual entry:', techNotifyErr)
            }
          }
        }
      } catch (notificationError) {
        logger.error('Error creating environment notifications:', notificationError)
      }

      res.status(201).json({ success: true, message: 'Đã ghi chỉ số môi trường', data: log })
    } catch (error) {
      logger.error('Error in createEnvironmentLog:', error)
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async getEnvironmentLogsBySeasonId(req, res) {
    try {
      const { seasonId } = req.params

      if (!isAdmin(req.user.role)) {
        const season = await seasonService.getSeasonById(seasonId, req.user.user_id, req.user.role, req.user.farm_id)
        if (!season) {
          return res.status(403).json({ success: false, message: 'Bạn không có quyền xem dữ liệu môi trường của mùa vụ này' })
        }
      }

      const logs = await environmentLogService.getEnvironmentLogsBySeasonId(seasonId)
      res.json({ success: true, data: logs })
    } catch (error) {
      logger.error('Error in getEnvironmentLogsBySeasonId:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getEnvironmentLogsByPondId(req, res) {
    try {
      const { pondId } = req.params

      const canAccessPond = await ensurePondInFarm(pondId, req)
      if (!canAccessPond) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem dữ liệu ao thuộc trại khác' })
      }

      const logs = await environmentLogService.getEnvironmentLogsByPondId(pondId)
      res.json({ success: true, data: logs })
    } catch (error) {
      logger.error('Error in getEnvironmentLogsByPondId:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getLatestEnvironmentLog(req, res) {
    try {
      const { seasonId } = req.params

      if (!isAdmin(req.user.role)) {
        const season = await seasonService.getSeasonById(seasonId, req.user.user_id, req.user.role, req.user.farm_id)
        if (!season) {
          return res.status(403).json({ success: false, message: 'Bạn không có quyền xem dữ liệu môi trường của mùa vụ này' })
        }
      }

      const log = await environmentLogService.getLatestEnvironmentLog(seasonId)
      res.json({ success: true, data: log || {} })
    } catch (error) {
      logger.error('Error in getLatestEnvironmentLog:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async setEnvironmentThresholds(req, res) {
    try {
      const { seasonId, pondId } = req.params
      const targetPondId = pondId || seasonId

      const canAccessPond = await ensurePondInFarm(targetPondId, req)
      if (!canAccessPond) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thiết lập ngưỡng cho ao thuộc trại khác' })
      }

      const thresholds = req.body
      const result = await environmentLogService.setEnvironmentThresholds(targetPondId, thresholds)
      res.status(201).json({ success: true, message: 'Đã thiết lập ngưỡng cảnh báo', data: result })
    } catch (error) {
      logger.error('Error in setEnvironmentThresholds:', error)
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async getEnvironmentThresholds(req, res) {
    try {
      const { seasonId, pondId } = req.params
      const targetPondId = pondId || seasonId

      const canAccessPond = await ensurePondInFarm(targetPondId, req)
      if (!canAccessPond) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem ngưỡng của ao thuộc trại khác' })
      }

      const thresholds = await environmentLogService.getEnvironmentThresholds(targetPondId)
      res.json({ success: true, data: thresholds || {} })
    } catch (error) {
      logger.error('Error in getEnvironmentThresholds:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getSensorThresholds(req, res) {
    try {
      const { sensorId } = req.params

      const canAccessSensor = await ensureSensorInFarm(sensorId, req)
      if (!canAccessSensor) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền xem ngưỡng của cảm biến này' })
      }

      const thresholds = await environmentLogService.getSensorThresholds(sensorId)
      res.json({ success: true, data: thresholds || {} })
    } catch (error) {
      logger.error('Error in getSensorThresholds:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async setSensorThresholds(req, res) {
    try {
      const { sensorId } = req.params

      const canAccessSensor = await ensureSensorInFarm(sensorId, req)
      if (!canAccessSensor) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thiết lập ngưỡng cho cảm biến này' })
      }

      const thresholds = req.body
      const result = await environmentLogService.setSensorThresholds(sensorId, thresholds)
      res.status(201).json({ success: true, message: 'Đã thiết lập ngưỡng cảnh báo', data: result })
    } catch (error) {
      logger.error('Error in setSensorThresholds:', error)
      res.status(400).json({ success: false, message: error.message })
    }
  },
}


module.exports = {
  environmentLogController,
  taskController,
  expenseController,
  sensorController,
  notificationController,
  productController,
  diseaseController,
  seasonController,
}
