import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

// --- CONTEXT & COMPONENTS ---
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { ToastProvider } from './components/ToastProvider'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'

// --- PAGES: PUBLIC & COMMON ---
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import ChangePassword from './pages/ChangePassword'
import { ForgotPassword } from './pages/ForgotPassword';
import NotificationsPage from './pages/NotificationsPage';

// --- PAGES: OWNER ---
import OwnerDashboard from './pages/owner/OwnerDashboard'
import OwnerPonds from './pages/owner/OwnerPonds'
import OwnerSensorData from './pages/owner/OwnerSensorData'
import OwnerEnvironment from './pages/owner/OwnerEnvironment'
import OwnerManageStaff from './pages/owner/OwnerManageStaff'
import OwnerSeasons from './pages/owner/OwnerSeasons'
import OwnerProducts from './pages/owner/OwnerProducts'
import OwnerFarmingLogs from './pages/owner/OwnerFarmingLogs'
import CostManagement from './pages/owner/CostManagement'
import OwnerAiDiagnostic from './pages/owner/OwnerAiDiagnostic'

// --- PAGES: TECHNICIAN ---
import TechnicianDashboard from './pages/technician/TechnicianDashboard'
import TechnicianEnvironment from './pages/technician/TechnicianEnvironment'
import TechnicianSensors from './pages/technician/TechnicianSensors'
import TechnicianPonds from './pages/technician/TechnicianPonds'
import TechnicianSeasons from './pages/technician/TechnicianSeasons'
import TechnicianProducts from './pages/technician/TechnicianProducts'
import TechnicianTasks from './pages/technician/TechnicianTasks'
import TechnicianAiDiagnostic from './pages/technician/TechnicianAiDiagnostic'

// --- PAGES: WORKER ---
import WorkerDashboard from './pages/worker/WorkerDashboard'
import WorkerTasks from './pages/worker/WorkerTasks'
import WorkerEnvironment from './pages/worker/WorkerEnvironment'

// ============================================================================
// HỖ TRỢ LAYOUT & PHÂN QUYỀN
// ============================================================================
const DashboardLayout = ({ children }) => (
  <div className="flex min-h-screen bg-slate-50 relative">
    <Sidebar />
    {/* 🌟 Thẻ div này sẽ tự động co giãn margin dựa theo độ rộng của Sidebar */}
    <div 
      className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out"
      style={{ paddingLeft: 'var(--sidebar-width, 280px)' }}
    >
      {/* 🌟 Khung chứa nội dung chính (Đã thêm padding để không bị sát lề) */}
      <main className="flex-1 w-full p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  </div>
)

const ProtectedDashboardRoute = ({ children, requiredRoles = [] }) => (
  <ProtectedRoute requiredRoles={requiredRoles}>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
)

const Unauthorized = () => (
  <div className="flex-center app-empty-state">
    <h1>🚫 Không có quyền truy cập</h1>
    <p>Bạn không có quyền truy cập trang này</p>
    <a href="/" className="btn btn-primary">Quay lại trang chủ</a>
  </div>
)

// ============================================================================
// CẤU HÌNH ROUTER CHÍNH
// ============================================================================
function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
          <div>
            <Routes>
              {/* 1. PUBLIC ROUTES (Không cần đăng nhập) */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* 2. COMMON PROTECTED ROUTES (Dùng chung cho nhiều Role) */}
              <Route 
                path="/profile" 
                element={
                  <ProtectedDashboardRoute requiredRoles={['OWNER', 'WORKER', 'TECHNICIAN', 'ACCOUNTANT']}>
                    <Profile />
                  </ProtectedDashboardRoute>
                } 
              />
              <Route 
                path="/change-password" 
                element={
                  <ProtectedDashboardRoute requiredRoles={['OWNER', 'WORKER', 'TECHNICIAN', 'ACCOUNTANT']}>
                    <ChangePassword />
                  </ProtectedDashboardRoute>
                } 
              />
              <Route 
                path="/notifications" 
                element={
                  <ProtectedDashboardRoute requiredRoles={['OWNER', 'WORKER', 'TECHNICIAN', 'ACCOUNTANT']}>
                    <NotificationsPage />
                  </ProtectedDashboardRoute>
                } 
              />

              {/* --------------------------------------------------------- */}
              {/* 3. OWNER ROUTES (Chủ trại)                                  */}
              {/* --------------------------------------------------------- */}
              <Route path="/owner/dashboard" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerDashboard /></ProtectedDashboardRoute>} />
              <Route path="/owner/ponds" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerPonds /></ProtectedDashboardRoute>} />
              <Route path="/owner/seasons" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerSeasons /></ProtectedDashboardRoute>} />
              <Route path="/owner/products" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerProducts /></ProtectedDashboardRoute>} />
              <Route path="/owner/costs" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><CostManagement /></ProtectedDashboardRoute>} />
              
              <Route path="/owner/sensor-data" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerSensorData /></ProtectedDashboardRoute>} />
              <Route path="/owner/sensors" element={<Navigate to="/owner/sensor-data" replace />} /> {/* Redirect hỗ trợ */}
              
              <Route path="/owner/environment" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerEnvironment /></ProtectedDashboardRoute>} />
              <Route path="/owner/farming-logs" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerFarmingLogs /></ProtectedDashboardRoute>} />
              
              <Route path="/owner/users" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerManageStaff /></ProtectedDashboardRoute>} />
              <Route path="/owner/manage-staff" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerManageStaff /></ProtectedDashboardRoute>} />

              <Route path="/owner/ai-diagnostic" element={<ProtectedDashboardRoute requiredRoles={['OWNER']}><OwnerAiDiagnostic /></ProtectedDashboardRoute>} />

              {/* --------------------------------------------------------- */}
              {/* 4. TECHNICIAN ROUTES (Kỹ sư)                                */}
              {/* --------------------------------------------------------- */}
              <Route path="/technician/dashboard" element={<ProtectedDashboardRoute requiredRoles={['TECHNICIAN']}><TechnicianDashboard /></ProtectedDashboardRoute>} />
              <Route path="/technician/ponds" element={<ProtectedDashboardRoute requiredRoles={['TECHNICIAN']}><TechnicianPonds /></ProtectedDashboardRoute>} />
              <Route path="/technician/seasons" element={<ProtectedDashboardRoute requiredRoles={['TECHNICIAN']}><TechnicianSeasons /></ProtectedDashboardRoute>} />
              <Route path="/technician/tasks" element={<ProtectedDashboardRoute requiredRoles={['TECHNICIAN']}><TechnicianTasks /></ProtectedDashboardRoute>} />
              <Route path="/technician/products" element={<ProtectedDashboardRoute requiredRoles={['TECHNICIAN']}><TechnicianProducts /></ProtectedDashboardRoute>} />
              
              <Route path="/technician/environment" element={<ProtectedDashboardRoute requiredRoles={['TECHNICIAN']}><TechnicianEnvironment /></ProtectedDashboardRoute>} />
              <Route path="/technician/sensors" element={<ProtectedDashboardRoute requiredRoles={['TECHNICIAN']}><TechnicianSensors /></ProtectedDashboardRoute>} />
              <Route path="/technician/sensor" element={<Navigate to="/technician/sensors" replace />} /> {/* Redirect hỗ trợ */}

              <Route path="/technician/ai-diagnostic" element={<ProtectedDashboardRoute requiredRoles={['TECHNICIAN']}><TechnicianAiDiagnostic /></ProtectedDashboardRoute>} />

              {/* --------------------------------------------------------- */}
              {/* 5. WORKER ROUTES (Công nhân)                                */}
              {/* --------------------------------------------------------- */}
              <Route path="/worker/dashboard" element={<ProtectedDashboardRoute requiredRoles={['WORKER']}><WorkerDashboard /></ProtectedDashboardRoute>} />
              <Route path="/worker/tasks" element={<ProtectedDashboardRoute requiredRoles={['WORKER']}><WorkerTasks /></ProtectedDashboardRoute>} />
              <Route path="/worker/environment" element={<ProtectedDashboardRoute requiredRoles={['WORKER']}><WorkerEnvironment /></ProtectedDashboardRoute>} />

              {/* 6. CATCH-ALL (Chặn các đường dẫn không tồn tại) */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          </NotificationProvider> 
        </AuthProvider>
      </ToastProvider>
    </Router>
  )
}

export default App