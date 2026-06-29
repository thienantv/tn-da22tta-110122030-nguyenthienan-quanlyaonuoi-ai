const pool = require('../config/database');

const getTaskDurationHours = (typeId) => {
    switch (String(typeId)) {
        case '1': return 4; // Cải tạo & Xử lý: Tối đa 4h
        case '2': return 1; // Cho ăn: Tối đa 1h
        case '3': return 2; // Xử lý nước: Tối đa 2h
        case '4': return 2; // Xi phong: Tối đa 2h
        case '5': return 1; // Đo môi trường: Tối đa 1h
        case '6': return 8; // Thu hoạch: Tối đa 8h
        case '7': return 2; // Khác: Tối đa 2h
        default: return 2;
    }
};

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

  // LẤY DANH SÁCH WORKER (ĐÃ GỠ BỎ TRUY VẤN TÍNH TOÁN TRẠNG THÁI BẬN/RẢNH)
  getWorkersStatus: async (req, res) => {
    try {
      const technicianId = req.user.user_id;
      const query = `
        SELECT u.user_id AS worker_id, u.full_name, u.username
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
      // 🌟 Nhận thêm mảng 'assignments' từ ma trận giao diện
      const { season_id, pond_id, task_title, description, start_date, due_date, assigned_workers, materials, assignments } = req.body;
      const type_id = req.body.type_id || req.body.task_type || req.body.type;

      const start = new Date(start_date || new Date());
      const due = new Date(due_date);
      const now = new Date();

      // 1. KIỂM TRA THỜI GIAN VÀ THỜI LƯỢNG
      if (start.getTime() < now.getTime() + (30 * 60000)) {
          throw new Error("Thời gian bắt đầu phải cách thời điểm hiện tại ít nhất 30 phút để nhân sự chuẩn bị.");
      }
      if (due.getTime() <= start.getTime()) {
          throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
      }
      
      const durationMinutes = (due.getTime() - start.getTime()) / 60000;
      const maxHours = getTaskDurationHours(type_id);

      if (durationMinutes < 15) throw new Error("Thời lượng tối thiểu là 15 phút.");
      if (durationMinutes > maxHours * 60) throw new Error(`Kế hoạch quá dài! Loại công việc này quy định tối đa là ${maxHours} giờ.`);

      // ==========================================================
      // 🌟 2. TIỀN XỬ LÝ DỮ LIỆU TỪ MA TRẬN FRONTEND
      // ==========================================================
      let taskGroups = []; // Mảng chứa các cụm { pond_id, worker_ids: [] }

      if (assignments && assignments.length > 0) {
          // Nếu nhận được ma trận: Gom nhóm các nhân viên lại theo từng ao
          const groups = {};
          for (const item of assignments) {
              if (!groups[item.pond_id]) groups[item.pond_id] = [];
              groups[item.pond_id].push(item.worker_id);
          }
          for (const pId in groups) {
              taskGroups.push({ pond_id: pId, worker_ids: groups[pId] });
          }
      } else if (pond_id && assigned_workers && assigned_workers.length > 0) {
          // Dự phòng nếu giao diện chỉ gửi 1 ao cơ bản
          taskGroups.push({ pond_id: pond_id, worker_ids: assigned_workers });
      } else {
          throw new Error("Vui lòng chọn ít nhất 1 ao và 1 nhân sự để giao việc.");
      }

      // ==========================================================
      // 🌟 3. VÒNG LẶP TẠO CÔNG VIỆC CHO TỪNG AO
      // ==========================================================
      const createdTaskCodes = [];

      for (const group of taskGroups) {
          const currentPondId = group.pond_id;
          const currentWorkers = group.worker_ids;

          // 🌟 THÊM MỚI: Tự động tìm Mùa vụ (Season) mới nhất của Ao này
          const seasonCheck = await client.query(
            `SELECT season_id FROM seasons WHERE pond_id = $1 ORDER BY season_id DESC LIMIT 1`, 
            [currentPondId]
          );
          const currentSeasonId = seasonCheck.rows.length > 0 ? seasonCheck.rows[0].season_id : null;

          // Kiểm tra kẹt lịch ao
          const overlapCheck = await client.query(`
              SELECT task_id, task_title FROM tasks 
              WHERE pond_id = $1 AND status NOT IN ('COMPLETED', 'CANCELLED')
                AND start_date < $2 AND due_date > $3 LIMIT 1
          `, [currentPondId, due, start]);

          if (overlapCheck.rows.length > 0) {
              const pInfo = await client.query(`SELECT pond_code FROM ponds WHERE pond_id = $1`, [currentPondId]);
              throw new Error(`Ao [${pInfo.rows[0]?.pond_code || currentPondId}] đang vướng công việc: "${overlapCheck.rows[0].task_title}".`);
          }
          
          // Kiểm tra kẹt lịch nhân sự
          const workerOverlap = await client.query(`
              SELECT u.full_name, t.task_title
              FROM task_workers tw
              INNER JOIN tasks t ON tw.task_id = t.task_id
              INNER JOIN users u ON tw.worker_id = u.user_id
              WHERE tw.worker_id = ANY($1::int[])
                AND t.status NOT IN ('COMPLETED', 'CANCELLED')
                AND tw.status NOT IN ('DONE', 'CANCELLED')
                AND t.start_date < $2 AND t.due_date > $3
              LIMIT 1
          `, [currentWorkers, due, start]);

          if (workerOverlap.rows.length > 0) {
              throw new Error(`Nhân sự "${workerOverlap.rows[0].full_name}" đang bận làm "${workerOverlap.rows[0].task_title}".`);
          }

          // Generate Mã Task
          const year = new Date().getFullYear();
          const countCheck = await client.query(`SELECT COALESCE(MAX(task_id), 0) AS max_id FROM tasks`);
          const nextSequence = parseInt(countCheck.rows[0].max_id) + 1;
          const task_code = `TSK-${year}-${String(nextSequence).padStart(5, '0')}`;

          // 🌟 SỬA ĐỔI: Sử dụng currentSeasonId thay vì season_id từ req.body
          const taskInsertQuery = `
          INSERT INTO tasks (task_code, season_id, pond_id, task_title, description, assigned_by, start_date, due_date, type_id, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
          RETURNING task_id
          `;
          const taskResult = await client.query(taskInsertQuery, [task_code, currentSeasonId, currentPondId, task_title, description, assigned_by, start, due, type_id]);
          const taskId = taskResult.rows[0].task_id;

          // Thêm danh sách công nhân vào task
          for (const workerId of currentWorkers) {
              await client.query(`INSERT INTO task_workers (task_id, worker_id, status) VALUES ($1, $2, 'ASSIGNED')`, [taskId, workerId]);
          }

          // Thêm vật tư sử dụng
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
          
          createdTaskCodes.push(task_code);
      } // Kết thúc vòng lặp

      await client.query('COMMIT'); 
      return res.status(201).json({ message: "Phân công công việc thành công!", task_codes: createdTaskCodes });

    } catch (error) {
      await client.query('ROLLBACK'); 
      console.error("LỖI TẠO TASK:", error);
      return res.status(400).json({ message: error.message || "Lỗi hệ thống khi xử lý dữ liệu." });
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
      const executorId = req.user.user_id; // Người đang bấm nút xác nhận
      const farmId = req.user.farm_id;

      const taskCheck = await client.query(`SELECT status, due_date FROM tasks WHERE task_id = $1`, [taskId]);
      if (taskCheck.rows.length === 0) throw new Error("Không tìm thấy công việc trong hệ thống.");

      const taskData = taskCheck.rows[0];
      if (new Date(taskData.due_date) < new Date() && (!note || !note.trim())) {
        throw new Error("Công việc đã quá hạn. Bắt buộc phải có ghi chú/lý do giải trình thực địa.");
      }

      // =========================================================================
      // 🌟 BƯỚC 1: XÁC NHẬN CHO TỪNG CÁ NHÂN
      // =========================================================================
      // Kiểm tra xem người đang bấm nút có nằm trong danh sách được giao việc không
      const isWorkerAssigned = await client.query(
        `SELECT 1 FROM task_workers WHERE task_id = $1 AND worker_id = $2`,
        [taskId, executorId]
      );

      if (isWorkerAssigned.rows.length > 0) {
        // Nếu là Công nhân tự bấm -> CHỈ XÁC NHẬN CHO RIÊNG CÔNG NHÂN ĐÓ
        await client.query(
          `UPDATE task_workers SET status = 'DONE', completed_at = NOW(), note = $1 WHERE task_id = $2 AND worker_id = $3`,
          [note || null, taskId, executorId]
        );
      } else {
        // Nếu là Kỹ sư/Quản lý bấm (Force Complete) -> Ép xác nhận cho TẤT CẢ công nhân chưa xong
        await client.query(
          `UPDATE task_workers SET status = 'DONE', completed_at = NOW(), note = $1 WHERE task_id = $2 AND status != 'DONE'`,
          [note || null, taskId]
        );
      }

      // =========================================================================
      // 🌟 BƯỚC 2: KIỂM TRA ĐIỀU KIỆN ĐỂ ĐÓNG CÔNG VIỆC CHÍNH (TASK)
      // =========================================================================
      const workerStats = await client.query(`
        SELECT 
            COUNT(*) AS total_workers, 
            SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done_workers
        FROM task_workers 
        WHERE task_id = $1
      `, [taskId]);

      const totalWorkers = parseInt(workerStats.rows[0].total_workers) || 0;
      const doneWorkers = parseInt(workerStats.rows[0].done_workers) || 0;

      // NẾU TẤT CẢ NHÂN VIÊN ĐÃ XONG (hoặc công việc không có ai) -> ĐÓNG TASK & TRỪ KHO
      if (totalWorkers === 0 || doneWorkers === totalWorkers) {

        await client.query(`UPDATE tasks SET status = 'COMPLETED', updated_at = NOW() WHERE task_id = $1`, [taskId]);

        // Lấy TẤT CẢ vật tư thuộc Task này
        const usageRes = await client.query(
          `SELECT tpu.*, p.category_id FROM task_product_usage tpu
             INNER JOIN products p ON tpu.product_id = p.product_id
             WHERE tpu.task_id = $1`,
          [taskId]
        );

        // VÒNG LẶP HẠCH TOÁN TỪNG MÓN VẬT TƯ MỘT VÀO NHẬT KÝ CHI PHÍ
        if (usageRes.rows.length > 0) {
          for (const usage of usageRes.rows) {
            const insertLogQuery = `
                  INSERT INTO product_usage_logs (farm_id, product_id, category_id, source_module, source_ref, quantity, unit_price, total_amount, note, created_by)
                  VALUES ($1, $2, $3, 'TASK_MANAGEMENT', $4, $5, $6, $7, $8, $9)
                `;
            const totalAmount = Number(usage.quantity) * Number(usage.unit_price);

            await client.query(insertLogQuery, [
              farmId, usage.product_id, usage.category_id, `TASK_CODE_ID_${taskId}`,
              usage.quantity, usage.unit_price, totalAmount,
              'Chi phí tự động kết chuyển khi toàn bộ công nhân báo cáo hoàn thành công việc.',
              executorId
            ]);
          }
        }

        await client.query('COMMIT');
        return res.status(200).json({
          success: true,
          message: "Toàn bộ nhân viên đã xong. Công việc hoàn tất và đã hạch toán chi phí vật tư!"
        });

      } else {
        // NẾU VẪN CÒN NGƯỜI CHƯA XONG -> CHỈ LƯU TRẠNG THÁI CÁ NHÂN, TASK GIỮ NGUYÊN
        await client.query('COMMIT');
        return res.status(200).json({
          success: true,
          message: `Bạn đã báo cáo xong phần việc của mình! Đang chờ ${totalWorkers - doneWorkers} người khác hoàn thành.`
        });
      }

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
      const { task_title, description, start_date, due_date, assigned_workers, materials } = req.body;

      // 🌟 1. CẬP NHẬT: Lấy thêm pond_id và season_id để tự động vá lỗi nếu thiếu
      const statusCheck = await client.query(`SELECT status, type_id, pond_id, season_id FROM tasks WHERE task_id = $1`, [taskId]);
      if (statusCheck.rows.length === 0) throw new Error("Không tìm thấy công việc tương ứng.");
      if (statusCheck.rows[0].status !== 'PENDING') throw new Error("Chỉ có thể chỉnh sửa khi công việc đang ở trạng thái Chờ xử lý (PENDING).");

      const type_id = statusCheck.rows[0].type_id; 
      let currentSeasonId = statusCheck.rows[0].season_id;

      // 🌟 2. AUTO-FIX: Nếu công việc cũ bị mất season_id, tự động tìm lại mùa vụ mới nhất của ao đó
      if (!currentSeasonId) {
          const seasonCheck = await client.query(
              `SELECT season_id FROM seasons WHERE pond_id = $1 ORDER BY season_id DESC LIMIT 1`, 
              [statusCheck.rows[0].pond_id]
          );
          currentSeasonId = seasonCheck.rows.length > 0 ? seasonCheck.rows[0].season_id : null;
      }

      const start = new Date(start_date);
      const due = new Date(due_date);

      // 🌟 3. THỜI GIAN LINH HOẠT: Đã gỡ bỏ chặn quá khứ để Kỹ sư dễ sửa sai
      if (due.getTime() <= start.getTime()) {
          throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
      }
      
      const durationMinutes = (due.getTime() - start.getTime()) / 60000;
      const maxHours = getTaskDurationHours(type_id); // Hàm lấy số giờ tối đa chúng ta đã định nghĩa ở trên

      if (durationMinutes < 15) throw new Error("Thời lượng công việc tối thiểu là 15 phút.");
      if (durationMinutes > maxHours * 60) throw new Error(`Kế hoạch quá dài! Loại công việc này quy định tối đa là ${maxHours} giờ.`);

      // 🌟 4. KIỂM TRA TRÙNG LỊCH NHÂN VIÊN: Bỏ qua những người đã bấm Xong sớm (DONE)
      if (assigned_workers && assigned_workers.length > 0) {
        const workerOverlap = await client.query(`
          SELECT u.full_name, t.task_title
          FROM task_workers tw
          INNER JOIN tasks t ON tw.task_id = t.task_id
          INNER JOIN users u ON tw.worker_id = u.user_id
          WHERE tw.worker_id = ANY($1::int[])
            AND t.task_id != $4 -- Không check trùng với chính công việc đang sửa
            AND t.status NOT IN ('COMPLETED', 'CANCELLED')
            AND tw.status NOT IN ('DONE', 'CANCELLED') -- Bỏ qua ai đã làm xong phần việc của mình
            AND t.start_date < $2 AND t.due_date > $3
          LIMIT 1
        `, [assigned_workers, due, start, taskId]);

        if (workerOverlap.rows.length > 0) {
          throw new Error(`Nhân sự "${workerOverlap.rows[0].full_name}" đang bị kẹt lịch làm "${workerOverlap.rows[0].task_title}".`);
        }
      }

      // 🌟 5. CẬP NHẬT DATABASE: Lưu lại season_id chuẩn xác
      await client.query(
        `UPDATE tasks SET task_title = $1, description = $2, start_date = $3, due_date = $4, season_id = $5, updated_at = NOW() WHERE task_id = $6`,
        [task_title, description, start, due, currentSeasonId, taskId]
      );

      // LÀM SẠCH VÀ PHÂN CÔNG LẠI NHÂN SỰ
      await client.query(`DELETE FROM task_workers WHERE task_id = $1`, [taskId]);
      if (assigned_workers && assigned_workers.length > 0) {
        for (const workerId of assigned_workers) {
          await client.query(`INSERT INTO task_workers (task_id, worker_id, status) VALUES ($1, $2, 'ASSIGNED')`, [taskId, workerId]);
        }
      }

      // LÀM SẠCH VÀ THÊM LẠI MẢNG VẬT TƯ
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
      return res.status(200).json({ success: true, message: "Cập nhật công việc thành công!" });
    } catch (error) {
      await client.query('ROLLBACK'); 
      console.error("LỖI CHI TIẾT TẠI BACKEND:", error);
      return res.status(400).json({ message: error.message || "Lỗi hệ thống khi xử lý dữ liệu." });
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