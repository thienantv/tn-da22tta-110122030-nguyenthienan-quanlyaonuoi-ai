import React, { useEffect, useMemo, useState } from 'react'
import { cultivationLogService, pondService } from '../../services/api'
import { showToast } from '../../utils/toast'
import '../../styles/owner/owner-cultivation-logs.css'

const formatVietnameseDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

const formatVietnameseDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

const OwnerCultivationLogs = () => {
  const [ponds, setPonds] = useState([])
  const [selectedPondId, setSelectedPondId] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(false)

  useEffect(() => {
    fetchPonds()
  }, [])

  useEffect(() => {
    if (!selectedPondId) {
      setLogs([])
      return
    }

    fetchLogs(selectedPondId)
  }, [selectedPondId])

  const fetchPonds = async () => {
    try {
      setLoading(true)
      const response = await pondService.getAllPonds()
      const pondList = response?.data?.data || []
      setPonds(pondList)
      if (pondList.length > 0) {
        setSelectedPondId(String(pondList[0].pond_id))
      }
    } catch (err) {
      showToast({ title: err?.response?.data?.message || 'Không tải được danh sách ao nuôi', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async (pondId) => {
    try {
      setLoadingLogs(true)
      const response = await cultivationLogService.getByPondId(pondId)
      setLogs(response?.data?.data || [])
    } catch (err) {
      showToast({ title: err?.response?.data?.message || 'Không tải được nhật ký xử lý', type: 'error' })
      setLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  const selectedPond = ponds.find((pond) => String(pond.pond_id) === String(selectedPondId))

  const summary = useMemo(() => ({ total: logs.length }), [logs])

  if (loading) {
    return (
      <div className="dashboard-container owner-page owner-cultivation-logs_page">
        <div className="table-container table-panel owner-cultivation-logs_panel">
          <div className="owner-cultivation-logs_loading">Đang tải danh sách ao nuôi...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-container owner-page owner-cultivation-logs_page">
      <div className="table-container table-panel owner-cultivation-logs_panel">
        <div className="table-header">
          <div>
            <h2>Nhật ký xử lý</h2>
            <p className="table-subtitle">Xem lịch sử xử lý theo từng ao nuôi đã được phân công</p>
          </div>
        </div>

        <div className="owner-cultivation-logs_summary-grid">
          <div className="card owner-cultivation-logs_summary-card owner-cultivation-logs_summary-card--total">
            <h3>Tổng nhật ký</h3>
            <p className="owner-cultivation-logs_stat-value">{summary.total}</p>
          </div>
          <div className="card owner-cultivation-logs_summary-card owner-cultivation-logs_summary-card--info">
            <h3>Thông tin ao đang xem</h3>
            <p className="owner-cultivation-logs_info-title">
              {selectedPond ? `${selectedPond.pond_code} - ${selectedPond.pond_name}` : 'Chưa chọn ao'}
            </p>
            <p className="owner-cultivation-logs_info-subtitle">
              {selectedPond ? `Mã ao: ${selectedPond.pond_code}` : '-'}
            </p>
          </div>
        </div>

        <div className="table-toolbar owner-cultivation-logs_toolbar">
          <div className="owner-cultivation-logs_selector">
            <label htmlFor="pondSelect">Ao nuôi</label>
            <select
              id="pondSelect"
              className="input"
              value={selectedPondId}
              onChange={(e) => setSelectedPondId(e.target.value)}
            >
              <option value="">-- Chọn ao nuôi --</option>
              {ponds.map((pond) => (
                <option key={pond.pond_id} value={pond.pond_id}>
                  {pond.pond_code} - {pond.pond_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-scroll">
          <table className="table-base table">
            <thead>
              <tr>
                <th>Ngày xử lý</th>
                <th>Mùa vụ</th>
                <th>Nhân viên</th>
                <th>Đã làm gì</th>
                <th>Chi tiết</th>
                <th>Ghi lúc</th>
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr>
                  <td colSpan="6">Đang tải...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6">Chưa có nhật ký xử lý nào</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id}>
                    <td>{formatVietnameseDate(log.log_date)}</td>
                    <td>{log.season_name || `Mùa vụ #${log.season_id}`}</td>
                    <td>{log.created_by_name || log.created_by_username || `#${log.created_by || '-'}`}</td>
                    <td>{log.action_type || '-'}</td>
                    <td className="owner-cultivation-logs_description">{log.description || '-'}</td>
                    <td>{formatVietnameseDateTime(log.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default OwnerCultivationLogs
