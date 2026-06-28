import React from 'react'
import TaskManagementPage from '../shared/TaskManagementPage'

const WorkerTasks = () => {
    return (
        <TaskManagementPage
            mode="worker"
            readOnly={true}            // Khóa chức năng tạo mới/hủy
            canComplete={true}         // BẬT nút báo cáo hoàn thành
            showEngineerFilter={true}  // Hiển thị lọc theo kỹ sư giao việc
            showEngineerColumn={true}  // Hiển thị cột kỹ sư
            showWorkerFilter={false}   // Ẩn bộ lọc nhân viên (vì chỉ có mình họ)
            pageTitle="Công việc của tôi"
            pageSubtitle="Tiếp nhận, thực hiện và báo cáo kết quả công việc từ Kỹ sư"
        />
    )
}

export default WorkerTasks