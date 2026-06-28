export const SENSOR_ORDER = ['ph', 'temperature', 'oxygen', 'salinity', 'turbidity']

export const SENSOR_PROFILES = {
  ph: {
    label: 'pH',
    unit: '',
    icon: '🔬',
    normalRange: [6.8, 8.5],
    precision: 2,
  },
  temperature: {
    label: 'Nhiệt độ',
    unit: '°C',
    icon: '🌡️',
    normalRange: [26, 32],
    precision: 2,
  },
  oxygen: {
    label: 'Oxy hòa tan',
    unit: 'mg/l',
    icon: '💨',
    normalRange: [4.5, 8],
    precision: 2,
  },
  salinity: {
    label: 'Độ mặn',
    unit: 'ppt',
    icon: '🧂',
    normalRange: [12, 25],
    precision: 2,
  },
  turbidity: {
    label: 'Độ đục',
    unit: 'NTU',
    icon: '🌫️',
    normalRange: [0, 10],
    precision: 2,
  },
}

export const getSensorTypeKey = (sensorType) => {
  if (!sensorType) return null

  const normalized = String(sensorType).trim().toLowerCase()

  if (normalized.includes('ph')) return 'ph'
  if (normalized.includes('temp') || normalized.includes('nhiệt')) return 'temperature'
  if (normalized.includes('oxy') || normalized.includes('o2') || normalized.includes('dissolved')) return 'oxygen'
  if (normalized.includes('salin') || normalized.includes('mặn')) return 'salinity'
  if (
    normalized.includes('turb') ||
    normalized.includes('đục') ||
    normalized.includes('ntu') ||
    normalized.includes('level') ||
    normalized.includes('water') ||
    normalized.includes('mực') ||
    normalized.includes('muc nuoc')
  ) {
    return 'turbidity'
  }

  return null
}

export const getSensorProfile = (sensorType) => {
  const typeKey = getSensorTypeKey(sensorType)
  return typeKey ? SENSOR_PROFILES[typeKey] : null
}

export const getSensorStatus = (value, sensorType) => {
  const profile = getSensorProfile(sensorType)
  if (value === null || value === undefined || value === '') return 'normal'
  if (!profile) return 'normal'

  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return 'normal'

  const [min, max] = profile.normalRange
  if (numericValue < min) return 'low'
  if (numericValue > max) return 'high'
  return 'normal'
}

export const getSensorStatusLabel = (status) => {
  switch (status) {
    case 'low':
      return '⚠️ Thấp hơn bình thường'
    case 'high':
      return '⚠️ Cao hơn bình thường'
    default:
      return '✓ Bình thường'
  }
}

export const getSensorStatusConfig = (status) => {
  switch (status) {
    case 'low':
      return {
        label: 'Thấp',
        className: 'status-low',
        color: '#92400e',
        bgColor: '#fef3c7',
        borderColor: '#f59e0b',
      }
    case 'high':
      return {
        label: 'Cao',
        className: 'status-high',
        color: '#991b1b',
        bgColor: '#fee2e2',
        borderColor: '#ef4444',
      }
    default:
      return {
        label: 'Bình thường',
        className: 'status-normal',
        color: '#065f46',
        bgColor: '#d1fae5',
        borderColor: '#10b981',
      }
  }
}
