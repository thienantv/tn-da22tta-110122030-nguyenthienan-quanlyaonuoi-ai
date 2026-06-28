const fs = require('fs')
const path = require('path')

const logsDir = path.join(__dirname, '../../logs')

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

const logger = {
  info: (message) => {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] INFO: ${message}`)
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString()
    console.error(`[${timestamp}] ERROR: ${message}`, error || '')
  },
  warn: (message) => {
    const timestamp = new Date().toISOString()
    console.warn(`[${timestamp}] WARN: ${message}`)
  },
  debug: (message) => {
    const timestamp = new Date().toISOString()
    console.debug(`[${timestamp}] DEBUG: ${message}`)
  },
}

module.exports = logger
