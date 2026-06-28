const db = require('../src/config/database')

async function run() {
  try {
    // Promote scheduled seasons whose start_date has passed
    const promoteRes = await db.query(`
      SELECT season_id, pond_id
      FROM seasons
      WHERE UPPER(status) = 'CHUAN_BI_NUOI'
        AND start_date <= now()
    `)

    if (promoteRes.rows.length > 0) {
      console.log(`Promoting ${promoteRes.rows.length} seasons to DANG_NUOI...`)
      await db.query('BEGIN')
      for (const row of promoteRes.rows) {
        console.log(`Setting season ${row.season_id} -> DANG_NUOI`)
        await db.query(`UPDATE seasons SET status = 'DANG_NUOI' WHERE season_id = $1`, [row.season_id])
        await db.query(`UPDATE ponds SET status = 'DANG_NUOI' WHERE pond_id = $1 AND COALESCE(usage_status, 'HOAT_DONG') = 'HOAT_DONG'`, [row.pond_id])
      }
      await db.query('COMMIT')
    } else {
      console.log('No seasons to promote.')
    }

    // Ensure ponds reflect running seasons (in case statuses use different aliases)
    const pondRes = await db.query(`
      SELECT DISTINCT s.pond_id
      FROM seasons s
      JOIN ponds p ON p.pond_id = s.pond_id
      WHERE UPPER(s.status) IN ('DANG_NUOI','RUNNING','IN_PROGRESS')
        AND s.start_date <= now()
        AND COALESCE(p.usage_status, 'HOAT_DONG') = 'HOAT_DONG'
        AND p.status <> 'DANG_NUOI'
    `)

    if (pondRes.rows.length > 0) {
      console.log(`Updating ${pondRes.rows.length} ponds to DANG_NUOI based on running seasons...`)
      for (const r of pondRes.rows) {
        console.log(`Setting pond ${r.pond_id} -> DANG_NUOI`)
        await db.query(`UPDATE ponds SET status = 'DANG_NUOI' WHERE pond_id = $1`, [r.pond_id])
      }
    } else {
      console.log('No ponds to update for running seasons.')
    }

    console.log('Sync job completed.')
  } catch (err) {
    try { await db.query('ROLLBACK') } catch (e) {}
    console.error('Error in sync job:', err)
    throw err
  }
}

module.exports = { run }

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1))
}
