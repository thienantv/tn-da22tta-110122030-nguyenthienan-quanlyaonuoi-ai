const { seasonService } = require('../services/commonService')
const auditLogService = require('../services/auditLogService')
const logger = require('../utils/logger')
const db = require('../config/database')
const sopService = require('../services/sopService');

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

      for (const season of createdSeasons) {
        await auditLogService.logActivity(req.user.user_id, 'CREATE', 'SEASON', season.season_id, { pondId: season.pond_id, seasonName: season.season_name }, auditLogService.resolveEntityLabel('SEASON'))
      }

      res.status(201).json({ success: true, message: `Đã khởi tạo thành công ${createdSeasons.length} mùa vụ!`, data: createdSeasons })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
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

      const season = await seasonService.harvestSeason(seasonId, resolvedActualHarvestDate, resolvedHarvestNote, resolvedHarvestWeight)
      await auditLogService.logActivity(req.user.user_id, 'UPDATE', 'SEASON', seasonId, { action: 'Thu hoạch mùa vụ' }, auditLogService.resolveEntityLabel('SEASON'))
      res.json({ success: true, data: season })
    } catch (error) {
      res.status(400).json({ success: false, message: error.message })
    }
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
}

module.exports = { seasonController }