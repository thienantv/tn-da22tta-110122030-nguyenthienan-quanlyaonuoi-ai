import React from 'react'
import TaskManagementPage from '../shared/TaskManagementPage'

const OwnerFarmingLogs = () => {
  return (
    <TaskManagementPage 
      mode="owner" 
      readOnly={true} 
      showEngineerFilter={true} 
      showEngineerColumn={true}
      pageTitle="Nhật ký canh tác"
      pageSubtitle="Theo dõi toàn bộ lịch sử công việc và tiến độ vận hành của toàn trại"
    />
  )
}

export default OwnerFarmingLogs