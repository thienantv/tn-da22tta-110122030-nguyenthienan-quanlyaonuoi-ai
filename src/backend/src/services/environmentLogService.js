const db = require('../config/database')
const logger = require('../utils/logger')
const { getSensorTypeCode } = require('../utils/sensorMetrics')

const SENSOR_TYPE_THRESHOLD_FIELDS = {
  PH: { min: 'min_ph', max: 'max_ph' },
  TEMP: { min: 'min_temp', max: 'max_temp' },
  SAL: { min: 'min_salinity', max: 'max_salinity' },
  DO: { min: 'min_oxygen', max: 'max_oxygen' },
  TURB: { min: 'min_turbidity', max: 'max_turbidity' },
}

const SENSOR_THRESHOLD_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS sensor_thresholds (
    threshold_id BIGSERIAL PRIMARY KEY,
    sensor_id BIGINT UNIQUE REFERENCES sensors(sensor_id) ON DELETE CASCADE,
    min_ph NUMERIC(4,2),
    max_ph NUMERIC(4,2),
    min_temp NUMERIC(5,2),
    max_temp NUMERIC(5,2),
    min_salinity NUMERIC(5,2),
    max_salinity NUMERIC(5,2),
    min_oxygen NUMERIC(5,2),
    max_oxygen NUMERIC(5,2),
    min_turbidity NUMERIC(5,2),
    max_turbidity NUMERIC(5,2),
    alert_level VARCHAR(20) DEFAULT 'WARNING',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`

const ensureSensorThresholdTable = async () => {
  try {
    await db.query(SENSOR_THRESHOLD_TABLE_SQL)

    // Define expected columns and their definitions
    const expectedColumns = {
      min_ph: 'NUMERIC(4,2)',
      max_ph: 'NUMERIC(4,2)',
      min_temp: 'NUMERIC(5,2)',
      max_temp: 'NUMERIC(5,2)',
      min_salinity: 'NUMERIC(5,2)',
      max_salinity: 'NUMERIC(5,2)',
      min_oxygen: 'NUMERIC(5,2)',
      max_oxygen: 'NUMERIC(5,2)',
      min_turbidity: 'NUMERIC(5,2)',
      max_turbidity: 'NUMERIC(5,2)',
      alert_level: "VARCHAR(20) DEFAULT 'WARNING'",
      notes: 'TEXT',
      created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    }

    // Query existing columns for sensor_thresholds
    const existingColsRes = await db.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'sensor_thresholds'`)
    const existingCols = new Set(existingColsRes.rows.map((r) => r.column_name))

    for (const [col, def] of Object.entries(expectedColumns)) {
      if (!existingCols.has(col)) {
        try {
          await db.query(`ALTER TABLE sensor_thresholds ADD COLUMN ${col} ${def}`)
          logger.info(`Added missing column to sensor_thresholds: ${col}`)
        } catch (alterErr) {
          logger.error(`Failed to add column ${col} to sensor_thresholds:`, alterErr)
        }
      }
    }
  } catch (err) {
    logger.error('Error ensuring sensor_thresholds table exists:', err)
  }
}

const normalizeThresholdPayload = (thresholds = {}) => ({
  minPh: thresholds.minPh ?? thresholds.min_ph ?? null,
  maxPh: thresholds.maxPh ?? thresholds.max_ph ?? null,
  minTemp: thresholds.minTemp ?? thresholds.min_temp ?? null,
  maxTemp: thresholds.maxTemp ?? thresholds.max_temp ?? null,
  minSalinity: thresholds.minSalinity ?? thresholds.min_salinity ?? null,
  maxSalinity: thresholds.maxSalinity ?? thresholds.max_salinity ?? null,
  minOxygen: thresholds.minOxygen ?? thresholds.min_oxygen ?? null,
  maxOxygen: thresholds.maxOxygen ?? thresholds.max_oxygen ?? null,
  minTurbidity: thresholds.minTurbidity ?? thresholds.min_turbidity ?? null,
  maxTurbidity: thresholds.maxTurbidity ?? thresholds.max_turbidity ?? null,
  alertLevel: thresholds.alertLevel ?? thresholds.alert_level ?? 'WARNING',
  notes: thresholds.notes ?? null,
})

const environmentLogService = {
  
  // =================================================================
  // TẠO NHẬT KÝ MỚI KÈM LOGIC CHẶN SPAM 30 PHÚT
  // =================================================================
  async createEnvironmentLog(pondId, ph, temperature, salinity, oxygen, turbidity, createdBy) {
    try {
      const COOLDOWN_MINUTES = 30; // Chỉnh thời gian chờ ở đây (15 hoặc 30 tùy bạn)

      // 1. Lấy thời gian ghi nhận gần nhất của ao này
      const lastLogRes = await db.query(`
        SELECT recorded_at 
        FROM manual_environment_logs 
        WHERE pond_id = $1 
        ORDER BY recorded_at DESC 
        LIMIT 1
      `, [pondId]);

      // 2. Kiểm tra khoảng cách thời gian
      if (lastLogRes.rows.length > 0) {
        const lastTime = new Date(lastLogRes.rows[0].recorded_at).getTime();
        const currentTime = new Date().getTime();
        const diffMinutes = (currentTime - lastTime) / (1000 * 60);

        if (diffMinutes < COOLDOWN_MINUTES) {
          const waitTime = Math.ceil(COOLDOWN_MINUTES - diffMinutes);
          throw new Error(`Hệ thống đang khóa chống spam. Vui lòng đợi thêm ${waitTime} phút nữa để nhập chỉ số mới cho ao này.`);
        }
      }

      // 3. Nếu hợp lệ -> Ghi vào CSDL
      const result = await db.query(`
        INSERT INTO manual_environment_logs (pond_id, ph, temperature, salinity, oxygen, turbidity, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [pondId, ph, temperature, salinity, oxygen, turbidity, createdBy])
      
      return result.rows[0]
    } catch (error) {
      logger.error('Error in createEnvironmentLog:', error)
      throw error // Controller sẽ bắt lỗi này và trả về Frontend!
    }
  },

  async getEnvironmentLogsBySeasonId(seasonId) {
    try {
      const result = await db.query(`
        SELECT mel.*, u.full_name AS created_by_name, u.username AS created_by_username
        FROM manual_environment_logs mel
        LEFT JOIN users u ON mel.created_by = u.user_id
        WHERE mel.season_id = $1
        ORDER BY mel.recorded_at DESC
      `, [seasonId])
      return result.rows || []
    } catch (error) {
      logger.error('Error in getEnvironmentLogsBySeasonId:', error)
      return []
    }
  },

  async getEnvironmentLogsByPondId(pondId) {
    try {
      const result = await db.query(`
        SELECT mel.*, p.pond_name, p.pond_code, u.full_name AS created_by_name, u.username AS created_by_username
        FROM manual_environment_logs mel
        JOIN ponds p ON mel.pond_id = p.pond_id
        LEFT JOIN users u ON mel.created_by = u.user_id
        WHERE p.pond_id = $1
        ORDER BY mel.recorded_at DESC
      `, [pondId])
      return result.rows || []
    } catch (error) {
      logger.error('Error in getEnvironmentLogsByPondId:', error)
      return []
    }
  },

  async getLatestEnvironmentLog(seasonId) {
    try {
      const result = await db.query(`
        SELECT * FROM manual_environment_logs
        WHERE season_id = $1
        ORDER BY recorded_at DESC
        LIMIT 1
      `, [seasonId])
      return result.rows[0] || null
    } catch (error) {
      logger.error('Error in getLatestEnvironmentLog:', error)
      return null
    }
  },

  async getEnvironmentThresholds(pondId) {
    try {
      await ensureSensorThresholdTable()

      const result = await db.query(`
        SELECT st.*, s.sensor_type
        FROM sensor_thresholds st
        JOIN sensors s ON s.sensor_id = st.sensor_id
        WHERE s.pond_id = $1
      `, [pondId])

      if (!result.rows.length) return null

      const aggregated = {
        min_ph: null,
        max_ph: null,
        min_temp: null,
        max_temp: null,
        min_salinity: null,
        max_salinity: null,
        min_oxygen: null,
        max_oxygen: null,
        min_turbidity: null,
        max_turbidity: null,
        alert_level: 'WARNING',
        notes: null,
      }

      result.rows.forEach((row) => {
        const typeCode = getSensorTypeCode(row.sensor_type)
        const fields = SENSOR_TYPE_THRESHOLD_FIELDS[typeCode]
        if (!fields) return

        aggregated[fields.min] = row[fields.min]
        aggregated[fields.max] = row[fields.max]

        if (!aggregated.notes && row.notes) {
          aggregated.notes = row.notes
        }
        if (String(row.alert_level || '').toUpperCase() === 'DANGER') {
          aggregated.alert_level = 'DANGER'
        }
      })

      return aggregated
    } catch (error) {
      logger.error('Error in getEnvironmentThresholds:', error)
      return null
    }
  },

  async setEnvironmentThresholds(pondId, thresholds) {
    try {
      await ensureSensorThresholdTable()
      const payload = normalizeThresholdPayload(thresholds)

      const sensorsResult = await db.query(
        'SELECT sensor_id, sensor_type FROM sensors WHERE pond_id = $1 ORDER BY sensor_id ASC',
        [pondId]
      )

      const sensors = sensorsResult.rows || []
      if (!sensors.length) {
        throw new Error('Ao chưa có cảm biến để thiết lập ngưỡng')
      }

      await db.query('BEGIN')
      try {
        for (const sensor of sensors) {
          const typeCode = getSensorTypeCode(sensor.sensor_type)
          const fields = SENSOR_TYPE_THRESHOLD_FIELDS[typeCode]
          if (!fields) continue

          const values = {
            minPh: null,
            maxPh: null,
            minTemp: null,
            maxTemp: null,
            minSalinity: null,
            maxSalinity: null,
            minOxygen: null,
            maxOxygen: null,
            minTurbidity: null,
            maxTurbidity: null,
            alertLevel: payload.alertLevel,
            notes: payload.notes,
          }

          if (fields.min === 'min_ph') {
            values.minPh = payload.minPh
            values.maxPh = payload.maxPh
          } else if (fields.min === 'min_temp') {
            values.minTemp = payload.minTemp
            values.maxTemp = payload.maxTemp
          } else if (fields.min === 'min_salinity') {
            values.minSalinity = payload.minSalinity
            values.maxSalinity = payload.maxSalinity
          } else if (fields.min === 'min_oxygen') {
            values.minOxygen = payload.minOxygen
            values.maxOxygen = payload.maxOxygen
          } else if (fields.min === 'min_turbidity') {
            values.minTurbidity = payload.minTurbidity
            values.maxTurbidity = payload.maxTurbidity
          }

          await db.query(`
            INSERT INTO sensor_thresholds (
              sensor_id, min_ph, max_ph, min_temp, max_temp,
              min_salinity, max_salinity, min_oxygen, max_oxygen,
              min_turbidity, max_turbidity, alert_level, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (sensor_id)
            DO UPDATE SET
              min_ph = EXCLUDED.min_ph,
              max_ph = EXCLUDED.max_ph,
              min_temp = EXCLUDED.min_temp,
              max_temp = EXCLUDED.max_temp,
              min_salinity = EXCLUDED.min_salinity,
              max_salinity = EXCLUDED.max_salinity,
              min_oxygen = EXCLUDED.min_oxygen,
              max_oxygen = EXCLUDED.max_oxygen,
              min_turbidity = EXCLUDED.min_turbidity,
              max_turbidity = EXCLUDED.max_turbidity,
              alert_level = EXCLUDED.alert_level,
              notes = EXCLUDED.notes,
              updated_at = CURRENT_TIMESTAMP
          `, [
            sensor.sensor_id,
            values.minPh,
            values.maxPh,
            values.minTemp,
            values.maxTemp,
            values.minSalinity,
            values.maxSalinity,
            values.minOxygen,
            values.maxOxygen,
            values.minTurbidity,
            values.maxTurbidity,
            values.alertLevel,
            values.notes,
          ])
        }

        await db.query('COMMIT')
      } catch (innerError) {
        await db.query('ROLLBACK')
        throw innerError
      }

      return this.getEnvironmentThresholds(pondId)
    } catch (error) {
      logger.error('Error in setEnvironmentThresholds:', error)
      throw error
    }
  },

  async getSensorThresholds(sensorId) {
    try {
      await ensureSensorThresholdTable()
      const result = await db.query(`
        SELECT st.*, s.sensor_id, s.pond_id, s.sensor_type, s.serial_number
        FROM sensor_thresholds st
        JOIN sensors s ON s.sensor_id = st.sensor_id
        WHERE st.sensor_id = $1
      `, [sensorId])
      return result.rows[0] || null
    } catch (error) {
      logger.error('Error in getSensorThresholds:', error)
      return null
    }
  },

  async setSensorThresholds(sensorId, thresholds) {
    try {
      await ensureSensorThresholdTable()
      const {
        minPh,
        maxPh,
        minTemp,
        maxTemp,
        minSalinity,
        maxSalinity,
        minOxygen,
        maxOxygen,
        minTurbidity,
        maxTurbidity,
        alertLevel,
        notes,
      } = normalizeThresholdPayload(thresholds)

      const existing = await db.query(`
        SELECT threshold_id FROM sensor_thresholds WHERE sensor_id = $1
      `, [sensorId])

      if (existing.rows.length > 0) {
        const result = await db.query(`
          UPDATE sensor_thresholds
          SET min_ph = $1, max_ph = $2, min_temp = $3, max_temp = $4,
              min_salinity = $5, max_salinity = $6, min_oxygen = $7, max_oxygen = $8, min_turbidity = $9, max_turbidity = $10,
              alert_level = $11, notes = $12, updated_at = CURRENT_TIMESTAMP
          WHERE sensor_id = $13
          RETURNING *
        `, [minPh, maxPh, minTemp, maxTemp, minSalinity, maxSalinity, minOxygen, maxOxygen, minTurbidity, maxTurbidity, alertLevel || 'WARNING', notes || null, sensorId])
        return result.rows[0]
      }

      const result = await db.query(`
        INSERT INTO sensor_thresholds (
          sensor_id, min_ph, max_ph, min_temp, max_temp,
          min_salinity, max_salinity, min_oxygen, max_oxygen,
          min_turbidity, max_turbidity, alert_level, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [sensorId, minPh, maxPh, minTemp, maxTemp, minSalinity, maxSalinity, minOxygen, maxOxygen, minTurbidity, maxTurbidity, alertLevel || 'WARNING', notes || null])
      return result.rows[0]
    } catch (error) {
      logger.error('Error in setSensorThresholds:', error)
      throw error
    }
  },
}

module.exports = environmentLogService