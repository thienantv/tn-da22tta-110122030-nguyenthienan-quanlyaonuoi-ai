import React from 'react'
import TechnicianSensors from '../technician/TechnicianSensors'

const OwnerSensorData = () => {
	return (
		<TechnicianSensors
			readOnly
			pageTitle="Dữ liệu cảm biến"
			pageSubtitle="Theo dõi và giám sát dữ liệu cảm biến theo thời gian thực (chế độ chỉ xem)."
		/>
	)
}

export default OwnerSensorData
