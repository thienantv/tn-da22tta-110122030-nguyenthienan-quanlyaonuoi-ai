const pool = require('../config/database');

const taskController = {

  // LẤY TOÀN BỘ DANH SÁCH CÔNG VIỆC
  getAllTasks: async (req, res) => {
    try {
      const userId = req.user.user_id;
      const farmId = req.user.farm_id;
      const role = String(req.user.role || '').toUpperCase();

      let query = `
      SELECT t.*, p.pond_name, p.pond_code, s.season_name, tt.type_name,
      u_assign.full_name AS creator_name,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'worker_id', u.user_id, 
          'full_name', u.full_name,
          'worker_status', tw_sub.status,
          'started_at', tw_sub.started_at,
          'completed_at', tw_sub.completed_at,
          'note', tw_sub.note
        )), '[]'::json)
        FROM task_workers tw_sub
        INNER JOIN users u ON tw_sub.worker_id = u.user_id
        WHERE tw_sub.task_id = t.task_id
      ) AS assigned_workers_list,
      
      -- 🌟 ĐÃ NÂNG CẤP: LẤY RA MỘT MẢNG (ARRAY) CHỨA TẤT CẢ VẬT TƯ ĐÃ XUẤT KHO
      (
        SELECT COALESCE(json_agg(json_build_object(
          'product_id', pr.product_id,
          'product_name', pr.product_name,
          'quantity', tpu.quantity,
          'unit', pr.unit,
          'unit_price', tpu.unit_price
        )), '[]'::json)
        FROM task_product_usage tpu
        INNER JOIN products pr ON tpu.product_id = pr.product_id
        WHERE tpu.task_id = t.task_id
      ) AS materials_list

      FROM tasks t
      LEFT JOIN ponds p ON t.pond_id = p.pond_id
      LEFT JOIN seasons s ON t.season_id = s.season_id
      LEFT JOIN task_types tt ON t.type_id = tt.type_id
      LEFT JOIN users u_assign ON t.assigned_by = u_assign.user_id
      `;

      let queryParams = [];

      // Rẽ nhánh tìm kiếm theo phân quyền
      if (role === 'WORKER') {
        query += ` INNER JOIN task_workers tw_main ON t.task_id = tw_main.task_id WHERE tw_main.worker_id = $1`;
        queryParams.push(userId);
      } else if (role === 'OWNER' || role === 'ADMIN') {
        query += ` WHERE p.farm_id = $1`;
        queryParams.push(farmId);
      } else {
        query += ` WHERE t.assigned_by = $1`;
        queryParams.push(userId);
      }

      query += ` ORDER BY t.created_at DESC`;

      const { rows } = await pool.query(query, queryParams);
      return res.status(200).json({ success: true, data: rows });
    } catch (error) {
      console.error("Lỗi getAllTasks:", error);
      return res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
    }
  },

  // LỌC AO NUÔI THÔNG MINH THEO LOẠI CÔNG VIỆC VÀ PHÂN QUYỀN KỸ SƯ
  getPondsForTask: async (req, res) => {
    try {
      const technicianId = req.user.user_id;
      const typeId = parseInt(req.query.type_id || req.query.type, 10);

      if (!typeId || isNaN(typeId)) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin loại công việc (type_id)." });
      }

      let query = "";
      let queryParams = [technicianId];

      if (typeId === 1) {
        query = `
        SELECT p.pond_id, p.pond_code, p.pond_name, p.status AS pond_status, NULL AS season_id
        FROM ponds p
        WHERE p.status IN ('DANG_CAI_TAO', 'TAM_NGUNG')
          AND p.assigned_staff = $1
        ORDER BY p.pond_code ASC;
      `;
      }
      else if (typeId === 2 || typeId === 3) {
        query = `
        SELECT p.pond_id, p.pond_code, p.pond_name, p.status AS pond_status, s.season_id
        FROM ponds p
        INNER JOIN seasons s ON p.pond_id = s.pond_id AND s.status = 'DANG_NUOI'
        WHERE p.status = 'DANG_NUOI'
          AND p.assigned_staff = $1
        ORDER BY p.pond_code ASC;
      `;
      }
      else {
        query = `
        SELECT p.pond_id, p.pond_code, p.pond_name, p.status AS pond_status, s.season_id
        FROM ponds p
        LEFT JOIN seasons s ON p.pond_id = s.pond_id AND s.status = 'DANG_NUOI'
        WHERE p.status IN ('DANG_NUOI', 'DANG_CAI_TAO')
          AND p.assigned_staff = $1
        ORDER BY p.pond_code ASC;
      `;
      }

      const result = await pool.query(query, queryParams);
      return res.status(200).json({ success: true, data: result.rows });

    } catch (error) {
      console.error("Lỗi hệ thống khi lọc ao theo loại công việc:", error);
      return res.status(500).json({ success: false, message: "Không thể tải danh sách ao nuôi.", error: error.message });
    }
  },

  // LẤY DANH SÁCH WORKER VÀ ĐÁNH DẤU TRẠNG THÁI BẬN/RẢNH
  getWorkersStatus: async (req, res) => {
    try {
      const technicianId = req.user.user_id;
      const query = `
        SELECT u.user_id AS worker_id, u.full_name, u.username,
               CASE 
                   WHEN EXISTS (
                       SELECT 1 FROM task_workers tw
                       INNER JOIN tasks t ON tw.task_id = t.task_id
                       WHERE tw.worker_id = u.user_id 
                         AND tw.status IN ('ASSIGNED', 'DOING')
                         AND t.status IN ('PENDING', 'IN_PROGRESS')
                         AND t.due_date > NOW()
                   ) THEN 'BUSY'
                   ELSE 'AVAILABLE'
               END AS work_status
        FROM users u
        INNER JOIN technician_workers tw_rel ON u.user_id = tw_rel.worker_id
        WHERE tw_rel.technician_id = $1 AND u.status = TRUE
      `;
      const { rows } = await pool.query(query, [technicianId]);
      return res.status(200).json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi kiểm tra danh sách công nhân", error: error.message });
    }
  },

  // TẠO VÀ PHÂN CÔNG CÔNG VIỆC (HỖ TRỢ MẢNG VẬT TƯ)
  createTask: async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); 

      const assigned_by = req.user.user_id; 
      // 🌟 ĐÃ NÂNG CẤP: Thay product_id đơn lẻ bằng mảng materials
      const { type_id, season_id, pond_id, task_title, description, start_date, due_date, assigned_workers, materials } = req.body;

      const start = new Date(start_date || new Date());
      const due = new Date(due_date);
      const now = new Date();

      if (start.getTime() < now.getTime() - (5 * 60000)) throw new Error("Thời gian bắt đầu không được ở trong quá khứ.");
      if (due.getTime() <= start.getTime()) throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
      if ((due.getTime() - start.getTime()) / 60000 < 30) throw new Error("Thời lượng công việc tối thiểu là 30 phút.");

      const overlapCheck = await client.query(`
          SELECT task_id, task_title FROM tasks 
          WHERE pond_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')
            AND start_date < $2 AND due_date > $3 LIMIT 1
      `, [pond_id, due, start]);

      if (overlapCheck.rows.length > 0) {
          throw new Error(`Kẹt lịch! Ao này đang có công việc: "${overlapCheck.rows[0].task_title}" trong cùng khung giờ.`);
      }

      const year = new Date().getFullYear();
      const countCheck = await client.query(`SELECT COALESCE(MAX(task_id), 0) AS max_id FROM tasks`);
      const nextSequence = parseInt(countCheck.rows[0].max_id) + 1;
      const task_code = `TSK-${year}-${String(nextSequence).padStart(5, '0')}`;

      const taskInsertQuery = `
      INSERT INTO tasks (task_code, season_id, pond_id, task_title, description, assigned_by, start_date, due_date, type_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
      RETURNING task_id
      `;
      const taskResult = await client.query(taskInsertQuery, [task_code, season_id || null, pond_id, task_title, description, assigned_by, start, due, type_id]);
      const taskId = taskResult.rows[0].task_id;

      if (assigned_workers && assigned_workers.length > 0) {
        for (const workerId of assigned_workers) {
          await client.query(`INSERT INTO task_workers (task_id, worker_id, status) VALUES ($1, $2, 'ASSIGNED')`, [taskId, workerId]);
        }
      }

      // 🌟 VÒNG LẶP XỬ LÝ MẢNG VẬT TƯ (CÁM + THUỐC TRỘN)
      if (materials && Array.isArray(materials) && materials.length > 0) {
        for (const item of materials) {
            if (item.product_id && Number(item.quantity) > 0) {
                const prodRes = await client.query(`SELECT unit_price FROM products WHERE product_id = $1`, [item.product_id]);
                const currentPrice = prodRes.rows[0]?.unit_price || 0;

                await client.query(
                  `INSERT INTO task_product_usage (task_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
                  [taskId, item.product_id, Number(item.quantity), currentPrice]
                );
            }
        }
      }

      await client.query('COMMIT'); 
      return res.status(201).json({ message: "Phân công công việc thành công!", task_code });

    } catch (error) {
      await client.query('ROLLBACK'); 
      console.error("LỖI CHI TIẾT TẠI BACKEND:", error);
      return res.status(500).json({ message: "Lỗi hệ thống khi xử lý dữ liệu.", error: error.message });
    } finally {
      client.release(); 
    }
  },

  // XÁC NHẬN HOÀN THÀNH & TỰ ĐỘNG HẠCH TOÁN CHI PHÍ KHO SẢN PHẨM (HỖ TRỢ NHIỀU VẬT TƯ)
  completeTask: async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { taskId } = req.params;
      const { note } = req.body; 
      const executorId = req.user.user_id;
      const farmId = req.user.farm_id;

      const taskCheck = await client.query(`SELECT status, due_date FROM tasks WHERE task_id = $1`, [taskId]);
      if (taskCheck.rows.length === 0) throw new Error("Không tìm thấy công việc trong hệ thống.");
      
      const taskData = taskCheck.rows[0];
      if (new Date(taskData.due_date) < new Date() && (!note || !note.trim())) {
        throw new Error("Công việc đã quá hạn. Bắt buộc phải có ghi chú/lý do giải trình thực địa.");
      }

      await client.query(`UPDATE tasks SET status = 'COMPLETED', updated_at = NOW() WHERE task_id = $1`, [taskId]);
      await client.query(`UPDATE task_workers SET status = 'DONE', completed_at = NOW(), note = $1 WHERE task_id = $2`, [note || null, taskId]);

      // 🌟 ĐÃ NÂNG CẤP: Lấy TẤT CẢ vật tư thuộc Task này
      const usageRes = await client.query(
        `SELECT tpu.*, p.category_id FROM task_product_usage tpu
         INNER JOIN products p ON tpu.product_id = p.product_id
         WHERE tpu.task_id = $1`,
        [taskId]
      );

      // 🌟 VÒNG LẶP HẠCH TOÁN TỪNG MÓN VẬT TƯ MỘT VÀO NHẬT KÝ CHI PHÍ
      if (usageRes.rows.length > 0) {
        for (const usage of usageRes.rows) {
            const insertLogQuery = `
              INSERT INTO product_usage_logs (farm_id, product_id, category_id, source_module, source_ref, quantity, unit_price, total_amount, note, created_by)
              VALUES ($1, $2, $3, 'TASK_MANAGEMENT', $4, $5, $6, $7, $8, $9)
            `;
            // Tự tính lại total_amount cho an toàn
            const totalAmount = Number(usage.quantity) * Number(usage.unit_price);
            
            await client.query(insertLogQuery, [
              farmId,
              usage.product_id,
              usage.category_id,
              `TASK_CODE_ID_${taskId}`,
              usage.quantity,
              usage.unit_price,
              totalAmount,
              'Chi phí tự động kết chuyển khi công nhân báo cáo hoàn thành công việc.',
              executorId
            ]);
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: "Xác nhận hoàn thành công việc và hạch toán chi phí thành công!" });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: error.message || "Lỗi khi hoàn thành công việc" });
    } finally {
      client.release();
    }
  },

  // HỦY CÔNG VIỆC
  cancelTask: async (req, res) => {
    try {
      const { taskId } = req.params;
      const statusCheck = await pool.query(`SELECT status FROM tasks WHERE task_id = $1`, [taskId]);
      if (statusCheck.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy công việc tương ứng." });
      if (statusCheck.rows[0].status !== 'PENDING') return res.status(400).json({ message: "Không thể hủy! Công việc đã được thực hiện hoặc đã kết thúc." });

      await pool.query(`UPDATE tasks SET status = 'CANCELLED', updated_at = NOW() WHERE task_id = $1`, [taskId]);
      await pool.query(`UPDATE task_workers SET status = 'CANCELLED' WHERE task_id = $1`, [taskId]);

      return res.status(200).json({ success: true, message: "Đã hủy bỏ công việc phân công thành công." });
    } catch (error) {
      return res.status(500).json({ message: "Lỗi hệ thống khi hủy công việc", error: error.message });
    }
  },

  // CHỈNH SỬA CÔNG VIỆC VÀ VẬT TƯ (HỖ TRỢ MẢNG VẬT TƯ)
  updateTask: async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { taskId } = req.params;
      // 🌟 Lấy mảng materials thay vì 1 món
      const { task_title, description, start_date, due_date, assigned_workers, materials } = req.body;

      const statusCheck = await client.query(`SELECT status FROM tasks WHERE task_id = $1`, [taskId]);
      if (statusCheck.rows.length === 0) throw new Error("Không tìm thấy công việc tương ứng.");
      if (statusCheck.rows[0].status !== 'PENDING') throw new Error("Chỉ có thể chỉnh sửa khi công việc đang ở trạng thái Chờ xử lý (PENDING).");

      const start = new Date(start_date);
      const due = new Date(due_date);
      const now = new Date();

      if (start.getTime() < now.getTime() - (5 * 60000)) throw new Error("Thời gian bắt đầu không được lùi về quá khứ.");
      if (due.getTime() <= start.getTime()) throw new Error("Thời gian kết thúc phải lớn hơn thời gian bắt đầu.");
      if ((due.getTime() - start.getTime()) / 60000 < 30) throw new Error("Thời lượng công việc tối thiểu là 30 phút.");

      await client.query(
        `UPDATE tasks SET task_title = $1, description = $2, start_date = $3, due_date = $4, updated_at = NOW() WHERE task_id = $5`,
        [task_title, description, start, due, taskId]
      );

      await client.query(`DELETE FROM task_workers WHERE task_id = $1`, [taskId]);
      if (assigned_workers && assigned_workers.length > 0) {
        for (const workerId of assigned_workers) {
          await client.query(`INSERT INTO task_workers (task_id, worker_id, status) VALUES ($1, $2, 'ASSIGNED')`, [taskId, workerId]);
        }
      }

      // 🌟 LÀM SẠCH VÀ THÊM LẠI MẢNG VẬT TƯ
      await client.query(`DELETE FROM task_product_usage WHERE task_id = $1`, [taskId]);
      if (materials && Array.isArray(materials) && materials.length > 0) {
        for (const item of materials) {
            if (item.product_id && Number(item.quantity) > 0) {
                const prodRes = await client.query(`SELECT unit_price FROM products WHERE product_id = $1`, [item.product_id]);
                const currentPrice = prodRes.rows[0]?.unit_price || 0;
                await client.query(
                  `INSERT INTO task_product_usage (task_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
                  [taskId, item.product_id, Number(item.quantity), currentPrice]
                );
            }
        }
      }

      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: "Cập nhật công việc và phân công thành công!" });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: error.message || "Lỗi hệ thống khi cập nhật công việc." });
    } finally {
      client.release();
    }
  },

  // XÓA CÔNG VIỆC
  deleteTask: async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { taskId } = req.params;

      // 1. Kiểm tra trạng thái (Chỉ cho phép xóa khi đang PENDING)
      const statusCheck = await client.query(`SELECT status FROM tasks WHERE task_id = $1`, [taskId]);
      if (statusCheck.rows.length === 0) {
        throw new Error("Không tìm thấy công việc tương ứng.");
      }
      if (statusCheck.rows[0].status !== 'PENDING') {
        throw new Error("Chỉ có thể xóa công việc ở trạng thái Chờ xử lý (PENDING).");
      }

      // 2. Dọn dẹp sạch sẽ dữ liệu liên kết trước (Ràng buộc khóa ngoại)
      await client.query(`DELETE FROM task_workers WHERE task_id = $1`, [taskId]);
      await client.query(`DELETE FROM task_product_usage WHERE task_id = $1`, [taskId]);

      // 3. Xóa công việc chính
      await client.query(`DELETE FROM tasks WHERE task_id = $1`, [taskId]);

      await client.query('COMMIT');
      return res.status(200).json({ success: true, message: "Xóa công việc thành công!" });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Lỗi xóa task:", error);
      return res.status(400).json({ message: error.message || "Lỗi hệ thống khi xóa công việc." });
    } finally {
      client.release();
    }
  }
};

module.exports = taskController;