import React from 'react'
import TaskManagementPage from '../shared/TaskManagementPage'

const TechnicianTasks = () => {
  return (
    <TaskManagementPage 
      mode="technician" 
      readOnly={false} 
      showEngineerFilter={false} 
      showEngineerColumn={false}
      pageTitle="Quản lý công việc"
      pageSubtitle="Giám sát và phân phối ma trận việc làm cho Công nhân kỹ thuật"
    />
  )
}

export default TechnicianTasks