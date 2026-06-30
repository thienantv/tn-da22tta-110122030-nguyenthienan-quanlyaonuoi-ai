const { seasonService } = require('../services/commonService')
const auditLogService = require('../services/auditLogService')
const logger = require('../utils/logger')
const db = require('../config/database')
const sopService = require('../services/sopService');
const notificationService = require('../services/notificationService');

const isAdmin = (role) => {
  const r = String(role || '').toUpperCase()
  return r === 'OWNER'
}

const ensurePondInUserFarm = async (pondId, req, res) => {
  const role = String(req.user.role || '').toUpperCase()
  if (isAdmin(role)) return true

  const farmCheck = await db.query('SELECT pond_id FROM ponds WHERE pond_id = $1 AND farm_id = $2', [pondId, req.user.farm_id])
  if (farmCheck.rows.length === 0) {
    res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác với ao này' })
    return false
  }

  if (role === 'TECHNICIAN' || role === 'WORKER') {
    const pondRes = await db.query(
      `SELECT pond_id FROM ponds p 
       WHERE pond_id = $1 AND farm_id = $2 
       AND (p.assigned_staff = $3 OR EXISTS (SELECT 1 FROM technician_workers tw WHERE tw.technician_id = p.assigned_staff AND tw.worker_id = $3))`, 
      [pondId, req.user.farm_id, req.user.user_id]
    );
    if (pondRes.rows.length === 0) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác với ao này' });
      return false;
    }
    return true;
  }
  return true
}

const ensureSeasonInUserFarm = async (seasonId, req, res) => {
  const role = String(req.user.role || '').toUpperCase()
  if (isAdmin(role)) return true

  const farmCheck = await db.query(
    `SELECT s.season_id FROM seasons s JOIN ponds p ON p.pond_id = s.pond_id WHERE s.season_id = $1 AND p.farm_id = $2`,
    [seasonId, req.user.farm_id]
  )
  if (farmCheck.rows.length === 0) {
    res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác với mùa vụ này' })
    return false
  }

  if (role === 'TECHNICIAN' || role === 'WORKER') {
    const resP = await db.query(
      `SELECT s.season_id FROM seasons s JOIN ponds p ON p.pond_id = s.pond_id WHERE s.season_id = $1 AND p.farm_id = $2 
       AND (p.assigned_staff = $3 OR EXISTS (SELECT 1 FROM technician_workers tw WHERE tw.technician_id = p.assigned_staff AND tw.worker_id = $3))`,
      [seasonId, req.user.farm_id, req.user.user_id]
    )
    if (resP.rows.length === 0) {
      res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác với mùa vụ này' })
      return false
    }
    return true
  }

  const season = await seasonService.getSeasonById(seasonId, req.user.user_id, req.user.role, req.user.farm_id)
  if (!season) {
    res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác với mùa vụ này' })
    return false
  }
  return true
}

const seasonController = {
  async getAllSeasons(req, res) {
    try {
      const { pondId } = req.query
      const seasons = await seasonService.getAllSeasons({ pondId, userId: req.user.user_id, role: req.user.role, farmId: req.user.farm_id })
      res.json({ success: true, data: seasons })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async getSeasonDetail(req, res) {
    try {
      const season = await seasonService.getSeasonById(req.params.seasonId, req.user.user_id, req.user.role, req.user.farm_id)
      if (!season) return res.status(404).json({ success: false, message: 'Mùa vụ không tồn tại' })
      res.json({ success: true, data: season })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  },

  async createSeason(req, res) {
    try {
      const { pondIds, pondId, pond_id, seasonName, season_name, startDate, start_date, expectedHarvestDate, expectedHarvest, expected_harvest, shrimpType, shrimp_type, quantitySeed, quantity_seed, density, note } = req.body
      let targetPondIds = pondIds;
      if (!targetPondIds || !Array.isArray(targetPondIds)) {
        if (pondId || pond_id) targetPondIds = [pondId || pond_id];
        else return res.status(400).json({ success: false, message: 'Vui lòng cung cấp danh sách ao nuôi' });
      }
      if (targetPondIds.length === 0) return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 ao nuôi' });

      for (const pId of targetPondIds) {
        const canAccessPond = await ensurePondInUserFarm(pId, req, res);
        if (!canAccessPond) return;
      }

      const createdSeasons = await seasonService.createSeason(
        targetPondIds, seasonName || season_name, startDate || start_date, expectedHarvestDate || expectedHarvest || expected_harvest,
        shrimpType || shrimp_type || 'Tôm sú', quantitySeed || quantity_seed, density, note || null
      )

      const creatorName = req.user.full_name || 'Kỹ sư';

      for (const season of createdSeasons) {
        await auditLogService.logActivity(req.user.user_id, 'CREATE', 'SEASON', season.season_id, { pondId: season.pond_id, seasonName: season.season_name }, auditLogService.resolveEntityLabel('SEASON'));
        
        // 🌟 BẮN THÔNG BÁO CHO CHỦ TRẠI
        const pondRes = await db.query('SELECT pond_code, pond_name FROM ponds WHERE pond_id = $1', [season.pond_id]);
        const pName = pondRes.rows[0]?.pond_name || pondRes.rows[0]?.pond_code;
        await notificationService.notifyOwnersOfFarm(
            req.user.farm_id,
            '🌱 Kế hoạch mùa vụ mới',
            `${creatorName} vừa lên kế hoạch vụ "${season.season_name}" cho ${pName}.`,
            'SYSTEM_ALERT'
        );
      }

      res.status(201).json({ success: true, message: `Đã khởi tạo thành công ${createdSeasons.length} mùa vụ!`, data: createdSeasons })
    } catch (error) { res.status(400).json({ success: false, message: error.message }) }
  },

  // API XÁC NHẬN XUỐNG GIỐNG
  async startSeason(req, res) {
    try {
      const { seasonId } = req.params;
      const canAccessSeason = await ensureSeasonInUserFarm(seasonId, req, res);
      if (!canAccessSeason) return;

      await seasonService.startSeason(seasonId);
      
      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'SEASON', seasonId, { action: 'Xác nhận thả tôm giống (Bắt đầu nuôi)' }, auditLogService.resolveEntityLabel('SEASON'));
      res.json({ success: true, message: 'Đã xác nhận thả giống! Mùa vụ chính thức Bắt đầu Nuôi.' });
    } catch (error) {
      logger.error('Error in startSeason:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // API BƠM DỮ LIỆU SOP TỪ MODAL MẪU
  async generateSOP(req, res) {
    try {
      const { seasonId } = req.params;
      const { templateConfig } = req.body; 

      const canAccessSeason = await ensureSeasonInUserFarm(seasonId, req, res);
      if (!canAccessSeason) return;

      const season = await seasonService.getSeasonById(seasonId, req.user.user_id, req.user.role, req.user.farm_id);
      if (!season) return res.status(404).json({ success: false, message: 'Mùa vụ không tồn tại' });
      
      if (season.status !== 'CHUAN_BI_NUOI') {
          return res.status(400).json({ success: false, message: 'Chỉ có thể tạo SOP khi vụ nuôi đang ở trạng thái Chuẩn bị' });
      }

      await sopService.generateSOPFromTemplate(
        season.season_id, 
        season.pond_id, 
        season.start_date, 
        season.expected_harvest || season.expected_harvest_date, 
        req.user.user_id, 
        templateConfig
      );

      await auditLogService.logActivity(req.user.user_id, 'CREATE', 'SEASON', seasonId, { action: 'Cấu hình và phát lệnh SOP Tự động' }, auditLogService.resolveEntityLabel('SEASON'));
      res.status(201).json({ success: true, message: 'Đã thiết lập và phát lệnh Lịch trình (SOP) thành công!' });

    } catch (error) {
      logger.error('Error in generateSOP:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async updateSeason(req, res) {
    try {
      const { seasonId } = req.params
      const canAccessSeason = await ensureSeasonInUserFarm(seasonId, req, res)
      if (!canAccessSeason) return
      const season = await seasonService.updateSeason(seasonId, req.body)
      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'SEASON', seasonId, req.body, auditLogService.resolveEntityLabel('SEASON'))
      res.json({ success: true, data: season })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async harvestSeason(req, res) {
    try {
      const { seasonId } = req.params
      const canAccessSeason = await ensureSeasonInUserFarm(seasonId, req, res)
      if (!canAccessSeason) return

      const { actualHarvestDate, actual_harvest, harvestWeightKg, harvest_weight_kg, harvestNote, harvest_note, note } = req.body
      const resolvedActualHarvestDate = actualHarvestDate || actual_harvest
      const resolvedHarvestWeight = harvestWeightKg ?? harvest_weight_kg ?? null
      const resolvedHarvestNote = harvestNote ?? harvest_note ?? note ?? null

      const season = await seasonService.harvestSeason(seasonId, resolvedActualHarvestDate, resolvedHarvestNote, resolvedHarvestWeight, req.user.role)
      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'SEASON', seasonId, { action: 'Thu hoạch mùa vụ' }, auditLogService.resolveEntityLabel('SEASON'))
      
      // 🌟 NẾU NGƯỜI BẤM LÀ KỸ SƯ -> BÁO CÁO SẢN LƯỢNG CHO CHỦ TRẠI
      if (String(req.user.role).toUpperCase() === 'TECHNICIAN') {
          const sRes = await db.query('SELECT s.season_name, p.pond_name, p.pond_code FROM seasons s JOIN ponds p ON s.pond_id = p.pond_id WHERE s.season_id = $1', [seasonId]);
          const sName = sRes.rows[0]?.season_name;
          const pName = sRes.rows[0]?.pond_name || sRes.rows[0]?.pond_code;
          const creatorName = req.user.full_name || 'Kỹ sư';

          await notificationService.notifyOwnersOfFarm(
              req.user.farm_id,
              '🎉 Báo cáo: Thu hoạch hoàn tất',
              `${creatorName} đã thu hoạch xong vụ "${sName}" (${pName}). Tổng sản lượng: ${resolvedHarvestWeight} kg.`,
              'OWNER_REPORT'
          );
      }

      res.json({ success: true, data: season })
    } catch (error) { res.status(400).json({ success: false, message: error.message }) }
  },

  async deleteSeason(req, res) {
    try {
      const canAccessSeason = await ensureSeasonInUserFarm(req.params.seasonId, req, res)
      if (!canAccessSeason) return
      const result = await seasonService.deleteSeason(req.params.seasonId)
      await auditLogService.logActivity(req.user.user_id, 'DELETE', 'SEASON', req.params.seasonId, { action: 'Xóa mùa vụ' }, auditLogService.resolveEntityLabel('SEASON'));
      res.json(result)
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
  },

  async requestHarvest(req, res) {
    try {
      const { seasonId } = req.params;
      const { requestDate, note } = req.body;
      const canAccess = await ensureSeasonInUserFarm(seasonId, req, res);
      if (!canAccess) return;
      
      await seasonService.requestHarvest(seasonId, requestDate, note);
      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'SEASON', seasonId, { action: 'Gửi yêu cầu thu hoạch' }, auditLogService.resolveEntityLabel('SEASON'));
      
      // 🌟 BẮN THÔNG BÁO KHẨN CHO CHỦ TRẠI
      const sRes = await db.query('SELECT s.season_name, p.pond_name, p.pond_code FROM seasons s JOIN ponds p ON s.pond_id = p.pond_id WHERE s.season_id = $1', [seasonId]);
      const sName = sRes.rows[0]?.season_name;
      const pName = sRes.rows[0]?.pond_name || sRes.rows[0]?.pond_code;
      const dateStr = new Date(requestDate).toLocaleDateString('vi-VN');
      const creatorName = req.user.full_name || 'Kỹ sư';

      await notificationService.notifyOwnersOfFarm(
          req.user.farm_id,
          '🚨 Đề xuất Thu hoạch',
          `${creatorName} xin thu hoạch vụ "${sName}" (${pName}) vào ngày ${dateStr}. Lý do: ${note}`,
          'URGENT_REMINDER'
      );

      res.json({ success: true, message: 'Đã gửi yêu cầu thu hoạch đến Chủ trại' });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
  },

  async reviewHarvestRequest(req, res) {
    try {
      const { seasonId } = req.params;
      const { isApproved } = req.body;
      
      await seasonService.reviewHarvestRequest(seasonId, isApproved);
      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'SEASON', seasonId, { action: isApproved ? 'Duyệt thu hoạch' : 'Từ chối thu hoạch' }, auditLogService.resolveEntityLabel('SEASON'));
      
      // 🌟 BẮN THÔNG BÁO CHO KỸ SƯ PHỤ TRÁCH MÙA VỤ ĐÓ
      const sRes = await db.query('SELECT season_name FROM seasons WHERE season_id = $1', [seasonId]);
      const sName = sRes.rows[0]?.season_name;
      
      await notificationService.notifyTechnicianOfSeason(
          seasonId,
          isApproved ? '✅ Đã duyệt thu hoạch' : '❌ Từ chối thu hoạch',
          `Chủ trại đã ${isApproved ? 'ĐỒNG Ý' : 'TỪ CHỐI'} yêu cầu thu hoạch vụ "${sName}".`,
          'SYSTEM_ALERT'
      );

      res.json({ success: true, message: isApproved ? 'Đã phê duyệt thu hoạch' : 'Đã từ chối thu hoạch' });
    } catch (error) { res.status(400).json({ success: false, message: error.message }); }
  },
}

module.exports = { seasonController }