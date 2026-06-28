const pool = require('../config/database');

const sopService = {
  /**
   * Động cơ sinh Lịch trình (SOP) dựa trên Cấu hình Mẫu (Template)
   */
  generateSOPFromTemplate: async (seasonId, pondId, startDate, expectedHarvestDate, technicianId, templateConfig) => {
    console.time('⏱️ [PERFORMANCE] Tổng thời gian chạy SOP Template');
    const start = new Date(startDate);
    const end = expectedHarvestDate ? new Date(expectedHarvestDate) : new Date(start.getTime() + (120 * 86400000)); 
    const totalDays = Math.floor((end - start) / 86400000);
    
    if (totalDays <= 0 || totalDays > 200) return; 

    const tasksToInsert = [];
    
    // BƯỚC 1: LÊN LỊCH TRÌNH CÁC CÔNG VIỆC VÀO MẢNG
    for (let day = 1; day <= totalDays; day++) {
      const currentDay = new Date(start.getTime() + (day * 86400000));
      const dateString = currentDay.toISOString().split('T')[0];

      // 1. Đo môi trường (Type: 5)
      if (templateConfig['5']) {
        [{ label: 'Sáng', start: '06:00:00', due: '07:00:00' }, { label: 'Chiều', start: '14:00:00', due: '15:00:00' }].forEach(shift => {
          tasksToInsert.push({ title: `[Ngày ${day}] Đo môi trường nước cữ ${shift.label}`, desc: `Đo các chỉ số pH, Nhiệt độ, Oxy, Kiềm cữ ${shift.label}`, start: `${dateString} ${shift.start}`, due: `${dateString} ${shift.due}`, type_id: 5 });
        });
      }

      // 2. Cho ăn (Type: 2)
      if (templateConfig['2']) {
        [{ label: '6h Sáng', start: '06:00:00', due: '08:00:00' }, { label: '10h Trưa', start: '10:00:00', due: '12:00:00' }, { label: '14h Chiều', start: '14:00:00', due: '16:00:00' }, { label: '18h Tối', start: '18:00:00', due: '20:00:00' }].forEach(shift => {
          tasksToInsert.push({ title: `[Ngày ${day}] Cho tôm ăn cữ ${shift.label}`, desc: `Xuất kho thức ăn, rải đều và canh sàng (nhá)`, start: `${dateString} ${shift.start}`, due: `${dateString} ${shift.due}`, type_id: 2 });
        });
      }

      // 3. Xử lý nước & đáy (Type: 3)
      if (templateConfig['3']) {
        if (day % 7 === 0) tasksToInsert.push({ title: `[Ngày ${day}] Cấy vi sinh định kỳ (Xử lý đáy)`, desc: 'Nhân sinh khối vi sinh và tạt đều quanh ao', start: `${dateString} 08:00:00`, due: `${dateString} 12:00:00`, type_id: 3 });
        if (day % 10 === 0) tasksToInsert.push({ title: `[Ngày ${day}] Đánh khoáng bổ sung (Ban đêm)`, desc: 'Tạt khoáng lúc 20h đêm hỗ trợ tôm lột xác', start: `${dateString} 20:00:00`, due: `${dateString} 22:00:00`, type_id: 3 });
      }

      // 4. Xi phong & Thay nước (Type: 4)
      if (templateConfig['4'] && day >= 30) {
        tasksToInsert.push({ title: `[Ngày ${day}] Xi phong đáy & Thay nước`, desc: 'Rút phân tôm và vỏ lột ở rốn ao', start: `${dateString} 08:00:00`, due: `${dateString} 10:00:00`, type_id: 4 });
      }
    }

    // 5. Thu hoạch (Type: 6)
    if (templateConfig['6']) {
        const harvestDateString = end.toISOString().split('T')[0];
        tasksToInsert.push({ title: '🎯 Tiến hành thu hoạch tôm', desc: 'Chuẩn bị dụng cụ thu hoạch', start: `${harvestDateString} 04:00:00`, due: `${harvestDateString} 12:00:00`, type_id: 6 });
    }

    if (tasksToInsert.length === 0) return;

    // BƯỚC 2: TRANSACTION LƯU DỮ LIỆU VÀO DATABASE
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // 2.1: Lấy thông tin giá tiền vật tư từ Database để dự trù
      const productIds = [];
      Object.values(templateConfig).forEach(conf => {
         if (conf.materials) conf.materials.forEach(m => { if (m.product_id) productIds.push(m.product_id) });
      });
      const productPrices = {};
      if (productIds.length > 0) {
         const priceRes = await client.query(`SELECT product_id, unit_price FROM products WHERE product_id = ANY($1)`, [productIds]);
         priceRes.rows.forEach(r => productPrices[r.product_id] = r.unit_price || 0);
      }

      const year = new Date().getFullYear();
      let countRes = await client.query(`SELECT COALESCE(MAX(task_id), 0) AS max_id FROM tasks`);
      let baseCount = parseInt(countRes.rows[0].max_id);

      // 2.2: LƯU BẢNG TASKS VÀ LẤY VỀ ID
      const taskValues = [];
      const taskParams = [];
      let paramIdx = 1;
      
      tasksToInsert.forEach(t => {
        baseCount++;
        const taskCode = `TSK-${year}-${String(baseCount).padStart(5, '0')}`;
        taskValues.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, 'PENDING', $${paramIdx++})`);
        taskParams.push(taskCode, seasonId, pondId, t.title, t.desc, t.start, t.due, t.type_id, technicianId);
      });

      const insertedTasks = await client.query(`
        INSERT INTO tasks (task_code, season_id, pond_id, task_title, description, start_date, due_date, type_id, status, assigned_by) 
        VALUES ${taskValues.join(', ')} RETURNING task_id, type_id
      `, taskParams);

      // 2.3: LƯU CÔNG NHÂN VÀ VẬT TƯ (Dựa theo Mẫu Config)
      const workerParams = [];
      const workerValues = [];
      let wIdx = 1;

      const matParams = [];
      const matValues = [];
      let mIdx = 1;

      for (const row of insertedTasks.rows) {
          const config = templateConfig[row.type_id];
          if (!config) continue;

          // Phân công công nhân
          if (config.workers && config.workers.length > 0) {
              config.workers.forEach(workerId => {
                  workerValues.push(`($${wIdx++}, $${wIdx++}, 'ASSIGNED')`);
                  workerParams.push(row.task_id, workerId);
              });
          }

          // Dự trù vật tư
          if (config.materials && config.materials.length > 0) {
              config.materials.forEach(mat => {
                  if (mat.product_id && Number(mat.quantity) > 0) {
                      const price = productPrices[mat.product_id] || 0;
                      matValues.push(`($${mIdx++}, $${mIdx++}, $${mIdx++}, $${mIdx++})`);
                      matParams.push(row.task_id, mat.product_id, Number(mat.quantity), price);
                  }
              });
          }
      }

      if (workerValues.length > 0) {
          await client.query(`INSERT INTO task_workers (task_id, worker_id, status) VALUES ${workerValues.join(', ')}`, workerParams);
      }
      if (matValues.length > 0) {
          await client.query(`INSERT INTO task_product_usage (task_id, product_id, quantity, unit_price) VALUES ${matValues.join(', ')}`, matParams);
      }

      await client.query('COMMIT');
      console.log(`✅ [SOP ENGINE] Đã tạo thành công SOP cho Mùa vụ ${seasonId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [SOP ENGINE] Lỗi sinh Task tự động:', error);
      throw error;
    } finally {
      client.release();
      console.timeEnd('⏱️ [PERFORMANCE] Tổng thời gian chạy SOP Template');
    }
  }
};

module.exports = sopService;