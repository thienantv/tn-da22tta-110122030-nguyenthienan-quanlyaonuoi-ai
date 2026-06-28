const express = require('express')
const router = express.Router()
const { authorize } = require('../middlewares/authorize')
const productController = require('../controllers/productController')

router.get('/overview', authorize(['OWNER', 'TECHNICIAN']), productController.getProductOverview)

router.get('/categories', authorize(['OWNER', 'TECHNICIAN']), productController.getProductCategories)
router.get('/categories/:categoryId', authorize(['OWNER', 'TECHNICIAN']), productController.getProductCategoryById)
router.post('/categories', authorize(['OWNER', 'TECHNICIAN']), productController.createProductCategory)
router.put('/categories/:categoryId', authorize(['OWNER', 'TECHNICIAN']), productController.updateProductCategory)
router.delete('/categories/:categoryId', authorize(['OWNER', 'TECHNICIAN']), productController.deleteProductCategory)

router.get('/', authorize(['OWNER', 'TECHNICIAN']), productController.getProducts)
router.get('/:productId', authorize(['OWNER', 'TECHNICIAN']), productController.getProductById)
router.post('/', authorize(['OWNER', 'TECHNICIAN']), productController.createProduct)
router.put('/:productId', authorize(['OWNER', 'TECHNICIAN']), productController.updateProduct)
router.delete('/:productId', authorize(['OWNER', 'TECHNICIAN']), productController.deleteProduct)

module.exports = router