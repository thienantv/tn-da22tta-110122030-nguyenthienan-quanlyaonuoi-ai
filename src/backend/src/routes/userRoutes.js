const express = require('express')
const router = express.Router()

const { authorize } = require('../middlewares/authorize')
const userController = require('../controllers/userController')
const { avatarUpload } = require('../middlewares/upload')

/**
 * =========================
 * MATRIX / ASSIGNMENT (PUT ON TOP)
 * =========================
 */
router.get(
  '/technician-worker-matrix', // Không cần chữ /matrix/ ở đây nữa
  authorize(['OWNER']),
  userController.getTechnicianWorkerMatrix
)

router.put(
  '/technicians/:technicianId/worker-assignment', // Không cần chữ /matrix/ ở đây nữa
  authorize(['OWNER']),
  userController.updateTechnicianWorkerAssignment
)

/**
 * =========================
 * CURRENT USER
 * =========================
 */
router.get('/me', userController.getCurrentUser)
router.put('/me', userController.updateCurrentUserProfile)
router.post('/me/avatar', avatarUpload.single('avatar'), userController.uploadCurrentUserAvatar)
router.post('/change-password', userController.changePassword)

/**
 * =========================
 * ADMIN / OWNER USERS
 * =========================
 */
router.get('/', authorize(['OWNER']), userController.getAllUsers)
router.post('/', authorize(['OWNER']), userController.createUser)
router.get('/workers', authorize(['OWNER','TECHNICIAN']), userController.getWorkerUsers)

/**
 * =========================
 * USER DETAIL (MUST BE AFTER STATIC ROUTES)
 * =========================
 */
router.get('/:userId', authorize(['OWNER']), userController.getUserById)
router.put('/:userId', authorize(['OWNER']), userController.updateUser)
router.put('/:userId/role', authorize(['OWNER']), userController.updateUserRole)
router.put('/:userId/lock', authorize(['OWNER']), userController.lockUser)
router.put('/:userId/unlock', authorize(['OWNER']), userController.unlockUser)
router.delete('/:userId', authorize(['OWNER']), userController.deleteUser)

router.put('/:userId/remove-from-farm', authorize(['OWNER']), userController.removeUserFromFarm)
router.put('/:userId/assign-to-farm', authorize(['OWNER']), userController.assignUserToFarm)

module.exports = router