const db = require('../config/database');

const masterSeasonService = {
  async getAllMasterSeasons(farmId) {
    const query = `SELECT * FROM master_seasons WHERE farm_id = $1 ORDER BY created_at DESC`;
    const result = await db.query(query, [farmId]);
    return result.rows;
  },

  async createMasterSeason(farmId, seasonName, planStartDate, planEndDate, note) {
    const query = `
      INSERT INTO master_seasons (farm_id, season_name, plan_start_date, plan_end_date, note)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await db.query(query, [farmId, seasonName, planStartDate, planEndDate, note]);
    return result.rows[0];
  }
};

module.exports = { masterSeasonService };