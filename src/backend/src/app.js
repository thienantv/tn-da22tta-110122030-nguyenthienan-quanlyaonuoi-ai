const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const http = require('http')
const socketIO = require('socket.io')
const path = require('path')
require('dotenv').config()

// Config
const db = require('./config/database')

// Utils
const logger = require('./utils/logger')

// Middleware
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler')
const { authenticateToken } = require('./middlewares/auth')

// Routes
const authRoutes = require('./routes/authRoutes')
const userRoutes = require('./routes/userRoutes')
const pondRoutes = require('./routes/pondRoutes')
const seasonRoutes = require('./routes/seasonRoutes')
const environmentLogRoutes = require('./routes/environmentLogRoutes')
const taskRoutes = require('./routes/taskRoutes')
const expenseRoutes = require('./routes/expenseRoutes');
const sensorRoutes = require('./routes/sensorRoutes')
const notificationRoutes = require('./routes/notificationRoutes')
const diseaseRoutes = require('./routes/diseaseRoutes')
const productRoutes = require('./routes/productRoutes')
const incidentRoutes = require('./routes/incidentRoutes')

// Initialize Express
const app = express()

app.use(cors({
    origin: '*', // Cho phép mọi thiết bị (localhost, mạng LAN, điện thoại) truy cập
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Lắp camera theo dõi mọi API gửi tới
app.use((req, res, next) => {
    console.log(`\n🚨 CÓ NGƯỜI GỌI VÀO NODE.JS: ${req.method} ${req.url}`);
    next();
});

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.set('trust proxy', true)

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}))

// Body parser
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Logging
app.use(morgan('combined'))

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() })
})

// ============================================================================
// HỆ THỐNG ĐƯỜNG DẪN API (ROUTES)
// ============================================================================

// 1. Route không cần khóa bảo mật (Public)
app.use('/api/auth', authRoutes)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 2. Các route yêu cầu phải đăng nhập (Bảo mật bằng authenticateToken)
app.use('/api/users/matrix', authenticateToken, require('./routes/userRoutes'));
app.use('/api/users', authenticateToken, userRoutes)
app.use('/api/ponds', authenticateToken, pondRoutes)
app.use('/api/seasons', authenticateToken, seasonRoutes)
app.use('/api/environment-logs', authenticateToken, environmentLogRoutes)
app.use('/api/tasks', authenticateToken, taskRoutes)
app.use('/api/sensors', authenticateToken, sensorRoutes)
app.use('/api/notifications', authenticateToken, notificationRoutes)
app.use('/api/diseases', authenticateToken, diseaseRoutes)
app.use('/api/products', authenticateToken, productRoutes)
app.use('/api/expenses', authenticateToken, expenseRoutes);
app.use('/api/incidents', authenticateToken, incidentRoutes);

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// HTTP Server + Socket.io
const PORT = process.env.PORT || 3000
const server = http.createServer(app)

const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})

// Socket.io authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error('Authentication error'))
  }
  next()
})

// Socket.io events
io.on('connection', (socket) => {
  logger.info(`🔌 Client connected: ${socket.id}`)

  socket.on('join_pond', (pondId) => {
    socket.join(`pond_${pondId}`)
    logger.info(`📍 Client ${socket.id} joined pond ${pondId}`)
  })

  socket.on('leave_pond', (pondId) => {
    socket.leave(`pond_${pondId}`)
    logger.info(`📍 Client ${socket.id} left pond ${pondId}`)
  })

  socket.on('subscribe_alerts', () => {
    socket.join('alerts')
    logger.info(`🔔 Client ${socket.id} subscribed to alerts`)
  })

  socket.on('disconnect', () => {
    logger.info(`🔌 Client disconnected: ${socket.id}`)
  })
})

// Export for use in services
app.locals.io = io

// Gọi hệ thống Quản lý Cron tập trung (Từ thư mục src/cron/)
const startAllCronJobs = require('./cron/index.js'); 

// 1. ĐỊNH NGHĨA HÀM KHỞI ĐỘNG SERVER
// const startServer = async () => {
//   server.listen(PORT, () => {
//     logger.info(`
//     ===================================
//     ✅ Server started on port ${PORT}
//     🌍 Environment: ${process.env.NODE_ENV}
//     📡 API URL: ${process.env.API_URL || 'http://localhost:' + PORT}
//     ===================================
//     `);
//   });

//   // 🌟 KÍCH HOẠT TOÀN BỘ CÁC TIẾN TRÌNH CHẠY NGẦM 🌟
//   startAllCronJobs();
// };

const startServer = async () => {
  // Thêm '0.0.0.0' vào đây để cho phép mọi thiết bị trong mạng LAN truy cập
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`✅ Server started on port ${PORT}`);
  });

  startAllCronJobs();
};

// 2. 🌟 DÒNG QUAN TRỌNG NHẤT: GỌI HÀM ĐỂ SERVER BẬT LÊN 🌟
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// 3. Xử lý tắt Server an toàn
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };