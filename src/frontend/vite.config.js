import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 🌟 THÊM KHỐI NÀY ĐỂ ÉP VITE BIÊN DỊCH CHUẨN CÁC THƯ VIỆN BỊ LỖI
  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts']
  },
  server: {
    port: 3001,
  },
});