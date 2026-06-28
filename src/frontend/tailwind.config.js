/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Bạn có thể khai báo mã màu hệ thống cũ của bạn vào đây để dùng cho Tailwind
      colors: {
        primary: '#0ea5e9',
        secondary: '#64748b',
        danger: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
        dark: '#0f172a'
      }
    },
  },
  plugins: [],
}