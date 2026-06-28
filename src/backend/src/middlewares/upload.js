const path = require('path')
const fs = require('fs')
const multer = require('multer')

const uploadRoot = path.join(__dirname, '../../uploads/avatars')

const ensureUploadDir = () => {
  if (!fs.existsSync(uploadRoot)) {
    fs.mkdirSync(uploadRoot, { recursive: true })
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureUploadDir()
      cb(null, uploadRoot)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg'
    const uniqueName = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`
    cb(null, uniqueName)
  },
})

const fileFilter = (req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(new Error('Vui lòng chọn tệp hình ảnh hợp lệ'))
  }
  cb(null, true)
}

const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

module.exports = {
  avatarUpload,
  uploadRoot,
  ensureUploadDir,
}
