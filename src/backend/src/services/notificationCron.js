const cron = require('node-cron');
const pool = require('../config/database');

// 🌟 CẤU HÌNH MÚI GIỜ CHUẨN VIỆT NAM (UTC+7)
const tzConfig = { timezone: "Asia/Ho_Chi_Minh" };

const notificationCron = {
  startAllNotificationJobs: () => {
    
    // =========================================================================
    // 🧠 CRON 1: CẢNH BÁO "AO BỊ BỎ ĐÓI" (Chạy vào 13:00 hằng ngày)
    // Hệ thống quét xem ngày mai các ao đang nuôi có bị Kỹ sư quên lên lịch việc không?
    // =========================================================================
    cron.schedule('0 13 * * *', async () => {
      console.log("🤖 [CRON - ALARM] Đang quét kiểm tra ao bỏ đói ngày mai...");
      try {
        const query = `
          SELECT p.pond_id, p.pond_code, p.pond_name, p.assigned_staff, p.farm_id, u_tech.full_name AS tech_name
          FROM ponds p
          INNER JOIN users u_tech ON p.assigned_staff = u_tech.user_id
          WHERE p.status = 'DANG_NUOI'
            AND NOT EXISTS (
                SELECT 1 FROM tasks t 
                WHERE t.pond_id = p.pond_id 
                  AND (t.start_date AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh' + INTERVAL '1 DAY')::date
            )
        `;
        const { rows } = await pool.query(query);

        for (const pond of rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content, type, reference_id) 
             VALUES ($1, $2, $3, 'SYSTEM_ALERT', $4)`,
            [
              pond.assigned_staff,
              `⚠️ BÁO ĐỘNG GẤP: Ao [${pond.pond_code}] chưa có lịch ngày mai!`,
              `Chào Kỹ sư ${pond.tech_name}, hệ thống phát hiện ao nuôi này hiện đang trống lịch trình cho ngày mai. Vui lòng vào phân phối SOP ngay!`,
              pond.pond_id
            ]
          );

          if (pond.farm_id) {
            const ownerRes = await pool.query(
              `SELECT user_id FROM users WHERE farm_id = $1 AND role_id = (SELECT role_id FROM roles WHERE role_name = 'OWNER' LIMIT 1) LIMIT 1`, 
              [pond.farm_id]
            );
            if (ownerRes.rows.length > 0) {
              await pool.query(
                `INSERT INTO notifications (user_id, title, content, type, reference_id) 
                 VALUES ($1, $2, $3, 'OWNER_REPORT', $4)`,
                [
                  ownerRes.rows[0].user_id,
                  `📢 Giám sát kỹ thuật: Thiếu lịch trình ao ${pond.pond_code}`,
                  `Ao [${pond.pond_name}] phụ trách bởi Kỹ sư ${pond.tech_name} chưa được thiết lập công việc cho ngày mai.`,
                  pond.pond_id
                ]
              );
            }
          }
        }
      } catch (err) {
        console.error("❌ Lỗi chạy Cron kiểm tra ao trống lịch:", err);
      }
    }, tzConfig); 

    // =========================================================================
    // ⏰ CRON 2: BẢN TIN SÁNG CHO CÔNG NHÂN (Chạy vào 03:00 sáng hằng ngày)
    // =========================================================================
    cron.schedule('0 3 * * *', async () => {
      console.log("🤖 [CRON - DIGEST] Đang chuẩn bị bản tin công việc sáng cho công nhân...");
      try {
        const query = `
          SELECT tw.worker_id, COUNT(t.task_id) AS total_tasks, u.full_name
          FROM task_workers tw
          INNER JOIN tasks t ON tw.task_id = t.task_id
          INNER JOIN users u ON tw.worker_id = u.user_id
          WHERE t.status IN ('PENDING', 'IN_PROGRESS')
            AND (t.start_date AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
          GROUP BY tw.worker_id, u.full_name
        `;
        const { rows } = await pool.query(query);

        for (const worker of rows) {
          await pool.query(
            `INSERT INTO notifications (user_id, title, content, type) 
             VALUES ($1, $2, $3, 'DAILY_DIGEST')`,
            [
              worker.worker_id,
              `☀️ Nhật ký công việc hôm nay của bạn`,
              `Chào ${worker.full_name}, hôm nay bạn có [ ${worker.total_tasks} công việc ]. Vui lòng truy cập để xem chi tiết.`
            ]
          );
        }
      } catch (err) {
        console.error("❌ Lỗi chạy bản tin sáng:", err);
      }
    }, tzConfig);

    // =========================================================================
    // 🛑 CRON 3: THÔNG BÁO SẮP QUÁ HẠN LÊN CẢ 3 CẤP (Quét mỗi 5 phút)
    // 👉 Cập nhật theo yêu cầu: Cảnh báo trước 30 Phút
    // =========================================================================
    cron.schedule('*/5 * * * *', async () => {
      try {
        const alertQuery = `
          SELECT t.task_id, t.task_code, t.task_title, t.due_date, t.assigned_by, p.farm_id, p.pond_name, u.full_name AS tech_name,
                 array_agg(tw.worker_id) as worker_ids
          FROM tasks t
          INNER JOIN ponds p ON t.pond_id = p.pond_id
          LEFT JOIN task_workers tw ON t.task_id = tw.task_id
          LEFT JOIN users u ON t.assigned_by = u.user_id
          WHERE t.status IN ('PENDING', 'IN_PROGRESS')
            AND t.due_date > NOW() 
            AND t.due_date <= (NOW() + INTERVAL '30 MINUTES')
            AND NOT EXISTS (
              SELECT 1 FROM notifications n WHERE n.reference_id = t.task_id AND n.type = 'URGENT_REMINDER'
            )
          GROUP BY t.task_id, p.farm_id, p.pond_name, u.full_name
        `;
        const tasksToAlert = await pool.query(alertQuery);

        for (const task of tasksToAlert.rows) {
          const timeStr = new Date(task.due_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          const title = `⏳ SẮP QUÁ HẠN: ${task.task_title}`;
          const contentBase = `Công việc tại ao [${task.pond_name}] sẽ đóng lúc ${timeStr} (chỉ còn dưới 30 phút).`;

          // 1️⃣ BÁO CHO CÔNG NHÂN (Người thực hiện)
          if (task.worker_ids && task.worker_ids.length > 0 && task.worker_ids[0] !== null) {
              for (const workerId of task.worker_ids) {
                await pool.query(
                  `INSERT INTO notifications (user_id, title, content, type, reference_id) VALUES ($1, $2, $3, 'URGENT_REMINDER', $4)`,
                  [workerId, title, `${contentBase} Vui lòng khẩn trương hoàn thành và báo cáo lên hệ thống!`, task.task_id]
                );
              }
          }

          // 2️⃣ BÁO CHO KỸ SƯ (Người giao việc)
          await pool.query(
              `INSERT INTO notifications (user_id, title, content, type, reference_id) VALUES ($1, $2, $3, 'URGENT_REMINDER', $4)`,
              [task.assigned_by, title, `${contentBase} Vui lòng đôn đốc công nhân thực hiện ngay để tránh trễ hạn.`, task.task_id]
          );

          // 3️⃣ BÁO CHO OWNER (Chủ trại)
          if (task.farm_id) {
              const ownerRes = await pool.query(
                `SELECT user_id FROM users WHERE farm_id = $1 AND role_id = (SELECT role_id FROM roles WHERE role_name = 'OWNER' LIMIT 1) LIMIT 1`, 
                [task.farm_id]
              );
              if (ownerRes.rows.length > 0) {
                await pool.query(
                  `INSERT INTO notifications (user_id, title, content, type, reference_id) VALUES ($1, $2, $3, 'URGENT_REMINDER', $4)`,
                  [ownerRes.rows[0].user_id, `🚨 Cảnh báo Rủi ro tiến độ: ${task.task_code}`, `Hệ thống ghi nhận công việc [${task.task_title}] do Kỹ sư ${task.tech_name} quản lý sắp trễ hạn lúc ${timeStr} mà công nhân chưa báo cáo.`, task.task_id]
                );
              }
          }
        }
      } catch (err) {
        console.error("❌ Lỗi xử lý thông báo sắp quá hạn:", err);
      }
    }, tzConfig);

    // =========================================================================
    // 🔔 CRON 4: NHẮC NHỞ PHÂN CÔNG SOP (Chạy mỗi 30 phút)
    // =========================================================================
    cron.schedule('*/30 * * * *', async () => {
      try {
        const query = `
            SELECT t.task_id, t.task_title, t.start_date, t.assigned_by, p.pond_name
            FROM tasks t
            JOIN ponds p ON p.pond_id = t.pond_id
            WHERE t.status = 'PENDING'
              AND t.start_date BETWEEN NOW() AND (NOW() + INTERVAL '24 hours')
              AND NOT EXISTS (SELECT 1 FROM task_workers tw WHERE tw.task_id = t.task_id)
              AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.reference_id = t.task_id AND n.type = 'SOP_REMINDER')
        `;
        const { rows } = await pool.query(query);

        if (rows.length > 0) {
          for (const task of rows) {
            const timeStr = new Date(task.start_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            await pool.query(
              `INSERT INTO notifications (user_id, title, content, type, reference_id) 
               VALUES ($1, $2, $3, 'SOP_REMINDER', $4)`,
              [
                task.assigned_by,
                `⏰ CẦN PHÂN CÔNG GẤP: ${task.task_title}`,
                `Công việc tại ao [${task.pond_name}] sẽ bắt đầu lúc ${timeStr}. Vui lòng vào phân công nhân sự thực hiện ngay!`,
                task.task_id
              ]
            );
          }
        }
      } catch (error) {
        console.error("❌ Lỗi chạy Cron nhắc nhở phân công SOP:", error);
      }
    }, tzConfig); 

    // =========================================================================
    // 🏁 CRON 5 (MỚI): NHẮC NHỞ TRƯỚC GIỜ BẮT ĐẦU 15 PHÚT (Quét mỗi 5 phút)
    // =========================================================================
    cron.schedule('*/5 * * * *', async () => {
      try {
        // LỌC CÁC CÔNG VIỆC CÒN <= 15 PHÚT LÀ BẮT ĐẦU
        const startQuery = `
          SELECT t.task_id, t.task_code, t.task_title, t.start_date, t.assigned_by, p.pond_name,
                 array_agg(tw.worker_id) as worker_ids
          FROM tasks t
          INNER JOIN ponds p ON t.pond_id = p.pond_id
          LEFT JOIN task_workers tw ON t.task_id = tw.task_id
          WHERE t.status = 'PENDING'
            AND t.start_date > NOW() 
            AND t.start_date <= (NOW() + INTERVAL '15 MINUTES')
            AND NOT EXISTS (
              SELECT 1 FROM notifications n WHERE n.reference_id = t.task_id AND n.type = 'START_REMINDER'
            )
          GROUP BY t.task_id, p.pond_name, t.start_date, t.assigned_by
        `;
        const tasksToStart = await pool.query(startQuery);

        for (const task of tasksToStart.rows) {
          const timeStr = new Date(task.start_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          const title = `🚀 Sắp đến giờ làm việc: ${task.task_title}`;
          const content = `Công việc tại ao [${task.pond_name}] sẽ diễn ra lúc ${timeStr} (trong 15 phút tới). Vui lòng chuẩn bị vật tư và công cụ!`;

          // Báo cho Công nhân
          if (task.worker_ids && task.worker_ids.length > 0 && task.worker_ids[0] !== null) {
              for (const workerId of task.worker_ids) {
                await pool.query(
                  `INSERT INTO notifications (user_id, title, content, type, reference_id) VALUES ($1, $2, $3, 'START_REMINDER', $4)`,
                  [workerId, title, content, task.task_id]
                );
              }
          } else {
              // ⚠️ Nếu chưa có công nhân nào được gán, báo động khẩn cấp cho Kỹ sư!
              await pool.query(
                  `INSERT INTO notifications (user_id, title, content, type, reference_id) VALUES ($1, $2, $3, 'START_REMINDER', $4)`,
                  [task.assigned_by, `⚠️ BỎ LỠ PHÂN CÔNG: ${task.task_title}`, `Công việc tại ao [${task.pond_name}] sẽ bắt đầu lúc ${timeStr} nhưng CHƯA CÓ CÔNG NHÂN! Vui lòng vào phân công ngay!`, task.task_id]
              );
          }
        }
      } catch (err) {
        console.error("❌ Lỗi xử lý thông báo nhắc giờ bắt đầu:", err);
      }
    }, tzConfig);

  }
};

module.exports = notificationCron;