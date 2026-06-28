const productService = require('../services/productService')
const logger = require('../utils/logger')
const auditLogService = require('../services/auditLogService')

const productController = {
  async getProductOverview(req, res) {
    try {
      // Vẫn lấy farm_id để thống kê Sản phẩm của trại
      const overview = await productService.getProductOverview(req.user.farm_id)
      res.json({ success: true, data: overview })
    } catch (error) {
      logger.error('Error in getProductOverview:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getProductCategories(req, res) {
    try {
      // Truyền farm_id để đếm xem Trại này có bao nhiêu sản phẩm trong từng danh mục
      const categories = await productService.getProductCategories(req.user.farm_id)
      res.json({ success: true, data: categories })
    } catch (error) {
      logger.error('Error in getProductCategories:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getProductCategoryById(req, res) {
    try {
      // Đã bỏ farm_id vì Danh mục là toàn cục
      const category = await productService.getProductCategoryById(req.params.categoryId)
      if (!category) {
        return res.status(404).json({ success: false, message: 'Danh mục không tồn tại' })
      }
      res.json({ success: true, data: category })
    } catch (error) {
      logger.error('Error in getProductCategoryById:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async createProductCategory(req, res) {
    try {
      const categoryName = req.body.categoryName || req.body.category_name || req.body.name
      const note = req.body.note || req.body.description || ''
      if (!categoryName || !String(categoryName).trim()) {
        return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống' })
      }

      // Đã bỏ farmId
      const category = await productService.createProductCategory({
        categoryName,
        note,
        createdBy: req.user.user_id,
      })

      await auditLogService.logActivity(req.user.user_id, 'CREATE', 'PRODUCT_CATEGORY', category?.category_id, { categoryName, note }, auditLogService.resolveEntityLabel('PRODUCT_CATEGORY'))
      res.status(201).json({ success: true, message: 'Đã tạo danh mục sản phẩm', data: category })
    } catch (error) {
      logger.error('Error in createProductCategory:', error)
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'Danh mục này đã tồn tại' })
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async updateProductCategory(req, res) {
    try {
      const categoryName = req.body.categoryName || req.body.category_name || req.body.name
      const note = req.body.note || req.body.description || ''
      if (!categoryName || !String(categoryName).trim()) return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống' })

      // Đã bỏ farmId
      const category = await productService.updateProductCategory(req.params.categoryId, {
        categoryName,
        note,
        updatedBy: req.user.user_id,
      })

      if (!category) return res.status(404).json({ success: false, message: 'Danh mục không tồn tại' })

      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'PRODUCT_CATEGORY', category.category_id, { categoryName, note }, auditLogService.resolveEntityLabel('PRODUCT_CATEGORY'))
      res.json({ success: true, message: 'Đã cập nhật danh mục', data: category })
    } catch (error) {
      logger.error('Error in updateProductCategory:', error)
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'Tên danh mục đã tồn tại' })
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async deleteProductCategory(req, res) {
    try {
      // Đã bỏ farm_id
      const deleted = await productService.deleteProductCategory(req.params.categoryId)
      if (!deleted) return res.status(404).json({ success: false, message: 'Danh mục không tồn tại' })
      res.json({ success: true, message: 'Đã xoá danh mục sản phẩm' })
    } catch (error) {
      logger.error('Error in deleteProductCategory:', error)
      res.status(400).json({ success: false, message: error.message })
    }
  },

  // CÁC HÀM SẢN PHẨM GIỮ NGUYÊN DO SẢN PHẨM THUỘC VỀ TỪNG TRẠI (CÓ FARM_ID)
  async getProducts(req, res) {
    try {
      const products = await productService.getProducts(req.user.farm_id)
      res.json({ success: true, data: products })
    } catch (error) {
      logger.error('Error in getProducts:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getProductById(req, res) {
    try {
      const product = await productService.getProductById(req.params.productId, req.user.farm_id)
      if (!product) return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' })
      res.json({ success: true, data: product })
    } catch (error) {
      logger.error('Error in getProductById:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async createProduct(req, res) {
    try {
      const categoryId = req.body.categoryId || req.body.category_id
      const productName = req.body.productName || req.body.product_name || req.body.name
      const unit = req.body.unit
      const supplier = req.body.supplier || req.body.provider || ''
      const unitPrice = req.body.unitPrice ?? req.body.unit_price ?? 0
      const note = req.body.note || req.body.description || ''

      if (!productName || !String(productName).trim()) return res.status(400).json({ success: false, message: 'Tên sản phẩm không được để trống' })
      if (!unit || !String(unit).trim()) return res.status(400).json({ success: false, message: 'Đơn vị tính không được để trống' })
      if (Number(unitPrice) < 0 || Number.isNaN(Number(unitPrice))) return res.status(400).json({ success: false, message: 'Giá đơn vị không hợp lệ' })

      const product = await productService.createProduct({
        farmId: req.user.farm_id,
        categoryId,
        productName,
        unit,
        supplier,
        unitPrice,
        note,
        createdBy: req.user.user_id,
      })

      await auditLogService.logActivity(req.user.user_id, 'CREATE', 'PRODUCT', product?.product_id, { productName, categoryId: product?.category_id, unit, supplier, unitPrice, note }, auditLogService.resolveEntityLabel('PRODUCT'))
      res.status(201).json({ success: true, message: 'Đã tạo sản phẩm', data: product })
    } catch (error) {
      logger.error('Error in createProduct:', error)
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'Sản phẩm hoặc mã sản phẩm đã tồn tại' })
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async updateProduct(req, res) {
    try {
      const categoryId = req.body.categoryId || req.body.category_id
      const productName = req.body.productName || req.body.product_name || req.body.name
      const unit = req.body.unit
      const supplier = req.body.supplier || req.body.provider || ''
      const unitPrice = req.body.unitPrice ?? req.body.unit_price ?? 0
      const note = req.body.note || req.body.description || ''

      if (!productName || !String(productName).trim()) return res.status(400).json({ success: false, message: 'Tên sản phẩm không được để trống' })
      if (!unit || !String(unit).trim()) return res.status(400).json({ success: false, message: 'Đơn vị tính không được để trống' })

      const product = await productService.updateProduct(req.params.productId, {
        farmId: req.user.farm_id, categoryId, productName, unit, supplier, unitPrice, note, updatedBy: req.user.user_id,
      })

      if (!product) return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' })

      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'PRODUCT', product.product_id, { productName, categoryId: product.category_id, unit, supplier, unitPrice, note }, auditLogService.resolveEntityLabel('PRODUCT'))
      res.json({ success: true, message: 'Đã cập nhật sản phẩm', data: product })
    } catch (error) {
      logger.error('Error in updateProduct:', error)
      if (error.code === '23505') return res.status(409).json({ success: false, message: 'Sản phẩm hoặc mã sản phẩm đã tồn tại' })
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async deleteProduct(req, res) {
    try {
      const deleted = await productService.deleteProduct(req.params.productId, req.user.farm_id)
      if (!deleted) return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' })
      res.json({ success: true, message: 'Đã xoá sản phẩm' })
    } catch (error) {
      logger.error('Error in deleteProduct:', error)
      res.status(400).json({ success: false, message: error.message })
    }
  },
}

module.exports = productController