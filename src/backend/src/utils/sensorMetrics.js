const SENSOR_TYPE_ALIASES = {
  ph: 'PH',
  pH: 'PH',
  temp: 'TEMP',
  temperature: 'TEMP',
  'nhiệt độ': 'TEMP',
  'nhiệt_độ': 'TEMP',
  do: 'DO',
  'dissolved oxygen': 'DO',
  dissolved_oxygen: 'DO',
  'oxy hoà tan': 'DO',
  'oxy hòa tan': 'DO',
  sal: 'SAL',
  salinity: 'SAL',
  'độ mặn': 'SAL',
  'độ_mặn': 'SAL',
  turbidity: 'TURBIDITY',
  'water level': 'TURBIDITY',
  level: 'TURBIDITY',
  'mực nước': 'TURBIDITY',
  'mực_nước': 'TURBIDITY',
  'muc nuoc': 'TURBIDITY',
  'độ đục': 'TURBIDITY',
  'độ_đục': 'TURBIDITY',
  ntu: 'TURBIDITY',
}

const SENSOR_PROFILES = {
  PH: {
    label: 'pH',
    unit: '',
    target: 7.4,
    normalRange: [6.8, 8.5],
    min: 6.2,
    max: 9,
    precision: 2,
    step: 0.03,
    waveStrength: 0.015,
    cycleStrength: 0.045,
      jitterStrength: 0.02,
    maxDelta: 0.12,
  },
  TEMP: {
    label: 'Nhiệt độ',
    unit: '°C',
    target: 29,
    normalRange: [26, 32],
    min: 24,
    max: 34,
    precision: 2,
      step: 0.1,
      waveStrength: 0.045,
      cycleStrength: 1.15,
      jitterStrength: 0.05,
      maxDelta: 0.95,
  },
  DO: {
    label: 'Oxy hòa tan',
    unit: 'mg/l',
    target: 6.1,
    normalRange: [4.5, 8],
    min: 3.5,
    max: 8.8,
    precision: 2,
      step: 0.1,
      waveStrength: 0.04,
      cycleStrength: 0.55,
      jitterStrength: 0.04,
      maxDelta: 0.42,
  },
  SAL: {
    label: 'Độ mặn',
    unit: 'ppt',
    target: 18,
    normalRange: [12, 25],
    min: 8,
    max: 30,
    precision: 2,
      step: 0.11,
      waveStrength: 0.035,
      cycleStrength: 0.2,
      jitterStrength: 0.03,
      maxDelta: 0.22,
  },
  TURBIDITY: {
    label: 'Độ đục',
    unit: 'NTU',
    target: 7,
    normalRange: [0, 15],
    min: 0,
    max: 25,
    precision: 2,
      step: 0.18,
      waveStrength: 0.06,
      cycleStrength: 0.28,
      jitterStrength: 0.08,
      feedPulseStrength: 0.9,
      maxDelta: 0.9,
  },
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const seededUnit = (seed) => {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const normalizeSensorTypeCode = (sensorType) => {
  const normalizedType = (sensorType || '').toString().trim().toLowerCase()

  for (const [key, value] of Object.entries(SENSOR_TYPE_ALIASES)) {
    if (key.toLowerCase() === normalizedType) {
      return value
    }
  }

  return null
}

const getSensorProfile = (sensorTypeCode) => SENSOR_PROFILES[sensorTypeCode] || null

const getDailyPhase = (timestamp, sensorId, offset = 0) => {
  const dayPhase = ((timestamp % 86400000) / 86400000) * Math.PI * 2
  return dayPhase + sensorId * 0.19 + offset
}

const getDiurnalCycle = (profile, timestamp, sensorId) => {
  const cycleStrength = Number(profile.cycleStrength || 0)
  if (cycleStrength === 0) return 0

  return Math.sin(getDailyPhase(timestamp, sensorId)) * cycleStrength
}

const getFeedPulse = (timestamp, sensorId) => {
  const phase = getDailyPhase(timestamp, sensorId, Math.PI / 6)
  const windows = [
    { center: 7.25, width: 0.45 },
    { center: 11.5, width: 0.5 },
    { center: 16.75, width: 0.55 },
  ]

  const hour = ((timestamp % 86400000) / 3600000)

  const pulse = windows.reduce((sum, window) => {
    const distance = Math.abs(hour - window.center)
    const distanceWrapped = Math.min(distance, 24 - distance)
    if (distanceWrapped > window.width) return sum
    const intensity = 1 - distanceWrapped / window.width
    return sum + intensity * intensity
  }, 0)

  const microVariation = (Math.sin(phase * 3.2) + 1) * 0.12
  return pulse + microVariation
}

const getRandomJitter = (seedBase, strength) => (seededUnit(seedBase + 31) * 2 - 1) * strength

const generateRealtimeSensorValue = (sensorType, previousValue, sensorId, timestamp = Date.now()) => {
  const typeCode = normalizeSensorTypeCode(sensorType)
  const profile = getSensorProfile(typeCode)

  if (!profile) return null

  const currentValue = Number(previousValue)
  const seedBase = Math.floor(timestamp / 30000) + sensorId * 997 + typeCode.charCodeAt(0) * 37
  const anchor = Number.isFinite(currentValue)
    ? currentValue
    : profile.target + (seededUnit(seedBase + 11) * 2 - 1) * profile.step * 4
  const meanReversion = (profile.target - anchor) * 0.1
  const wave = Math.sin(timestamp / 3600000 + sensorId * 0.4) * profile.waveStrength
  const drift = getDiurnalCycle(profile, timestamp, sensorId)
  const jitter = getRandomJitter(seedBase, profile.jitterStrength || profile.step * 0.5)
  const lowFrequency = Math.sin(timestamp / 21600000 + sensorId * 0.13) * profile.step * 0.6

  let contextualBoost = 0
  if (typeCode === 'TURBIDITY') {
    const inverseDoPressure = Math.max(0, 1 - ((Math.sin(getDailyPhase(timestamp, sensorId, -Math.PI / 3)) + 1) / 2))
    const feedingPulse = getFeedPulse(timestamp, sensorId) * Number(profile.feedPulseStrength || 0)
    contextualBoost = inverseDoPressure * 0.22 + feedingPulse
  }

  let delta = meanReversion + wave + drift + jitter + lowFrequency + contextualBoost
  const maxDelta = Number.isFinite(Number(profile.maxDelta)) ? Number(profile.maxDelta) : Math.max(profile.step * 2.2, 0.08)
  delta = clamp(delta, -maxDelta, maxDelta)

  let value = anchor + delta

  value = clamp(value, profile.min, profile.max)

  return Number(value.toFixed(profile.precision))
}

module.exports = {
  getSensorTypeCode: normalizeSensorTypeCode,
  getSensorProfile,
  generateRealtimeSensorValue,
}
