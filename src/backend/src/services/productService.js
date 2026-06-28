const db = require('../config/database')

const productService = {
  async getProductOverview(farmId) {
    // 1. Tổng số danh mục (Cố định toàn hệ thống)
    const catRes = await db.query('SELECT COUNT(*) FROM product_categories')
    
    // 2. Tổng số sản phẩm (Thuộc về riêng farm_id này)
    const prodRes = await db.query('SELECT COUNT(*) FROM products WHERE farm_id = $1', [farmId])
    
    // 3. Phân bố SP theo danh mục (Sử dụng farm_id ở bảng products, không dùng ở product_categories)
    const catStats = await db.query(`
      SELECT pc.category_name as label, COUNT(p.product_id) as value
      FROM product_categories pc
      LEFT JOIN products p ON pc.category_id = p.category_id AND p.farm_id = $1
      GROUP BY pc.category_id, pc.category_name
      HAVING COUNT(p.product_id) > 0
    `, [farmId])

    // 4. Phân bố Nhà cung cấp
    const supStats = await db.query(`
      SELECT COALESCE(supplier, 'Khác') as label, COUNT(product_id) as value
      FROM products 
      WHERE farm_id = $1
      GROUP BY supplier
      HAVING COUNT(product_id) > 0
    `, [farmId])

    return {
      totalCategories: parseInt(catRes.rows[0].count),
      totalProducts: parseInt(prodRes.rows[0].count),
      categoryStats: catStats.rows,
      supplierStats: supStats.rows,
      topCategory: catStats.rows.sort((a, b) => b.value - a.value)[0] || null,
      topProducts: [] 
    }
  },

  async getProductCategories(farmId) {
    // Lấy tất cả Danh mục cố định, đồng thời đếm số lượng SP thuộc Farm này đang nằm trong danh mục đó
    const { rows } = await db.query(`
      SELECT pc.*, COUNT(p.product_id) as product_count
      FROM product_categories pc
      LEFT JOIN products p ON pc.category_id = p.category_id AND p.farm_id = $1
      GROUP BY pc.category_id
      ORDER BY pc.category_id ASC
    `, [farmId])
    return rows
  },

  async getProductCategoryById(categoryId) {
    const { rows } = await db.query('SELECT * FROM product_categories WHERE category_id = $1', [categoryId])
    return rows[0]
  },

  async createProductCategory(data) {
    const { categoryName, note, createdBy } = data
    const { rows } = await db.query(`
      INSERT INTO product_categories (category_code, category_name, note, created_by)
      VALUES ('CAT-' || EXTRACT(EPOCH FROM NOW())::INT, $1, $2, $3)
      RETURNING *
    `, [categoryName, note, createdBy])
    return rows[0]
  },

  async updateProductCategory(categoryId, data) {
    const { categoryName, note, updatedBy } = data
    const { rows } = await db.query(`
      UPDATE product_categories 
      SET category_name = $1, note = $2, updated_by = $3, updated_at = NOW()
      WHERE category_id = $4
      RETURNING *
    `, [categoryName, note, updatedBy, categoryId])
    return rows[0]
  },

  async deleteProductCategory(categoryId) {
    const { rowCount } = await db.query('DELETE FROM product_categories WHERE category_id = $1', [categoryId])
    return rowCount > 0
  },

  // =======================================================
  // SQL CỦA SẢN PHẨM VẪN GIỮ ĐIỀU KIỆN FARM_ID BÌNH THƯỜNG
  // =======================================================
  async getProducts(farmId) {
    const { rows } = await db.query(`
      SELECT p.*, pc.category_name, pc.category_code
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      WHERE p.farm_id = $1
      ORDER BY p.created_at DESC
    `, [farmId])
    return rows
  },

  async getProductById(productId, farmId) {
    const { rows } = await db.query(`
      SELECT p.*, pc.category_name, pc.category_code
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.category_id
      WHERE p.product_id = $1 AND p.farm_id = $2
    `, [productId, farmId])
    return rows[0]
  },

  async createProduct(data) {
    const { farmId, categoryId, productName, unit, supplier, unitPrice, note, createdBy } = data
    
    // 🌟 ĐÃ FIX LỖI "null value in product_code":
    // Tự động sinh mã sản phẩm với tiền tố 'PRD-' ghép với chuỗi thời gian Epoch để đảm bảo luôn có mã và không bị trùng
    const { rows } = await db.query(`
      INSERT INTO products (farm_id, category_id, product_code, product_name, unit, supplier, unit_price, note, created_by)
      VALUES ($1, $2, 'PRD-' || EXTRACT(EPOCH FROM NOW())::INT || '-' || FLOOR(RANDOM() * 1000)::INT, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [farmId, categoryId, productName, unit, supplier, unitPrice, note, createdBy])
    return rows[0]
  },

  async updateProduct(productId, data) {
    const { farmId, categoryId, productName, unit, supplier, unitPrice, note, updatedBy } = data
    const { rows } = await db.query(`
      UPDATE products
      SET category_id = $1, product_name = $2, unit = $3, supplier = $4, unit_price = $5, note = $6, updated_by = $7, updated_at = NOW()
      WHERE product_id = $8 AND farm_id = $9
      RETURNING *
    `, [categoryId, productName, unit, supplier, unitPrice, note, updatedBy, productId, farmId])
    return rows[0]
  },

  async deleteProduct(productId, farmId) {
    const { rowCount } = await db.query('DELETE FROM products WHERE product_id = $1 AND farm_id = $2', [productId, farmId])
    return rowCount > 0
  }
}

module.exports = productService