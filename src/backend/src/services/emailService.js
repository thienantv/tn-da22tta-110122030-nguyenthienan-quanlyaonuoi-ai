const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Email của bạn (VD: admin@gmail.com)
    pass: process.env.EMAIL_APP_PASSWORD // Mật khẩu ứng dụng 16 ký tự vừa lấy
  }
});

const emailService = {
  async sendResetPasswordEmail(toEmail, tempPassword) {
    const mailOptions = {
      from: `"AquaFarm System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: 'Yêu cầu khôi phục mật khẩu - AquaFarm',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #10b981; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">Khôi phục mật khẩu</h2>
          </div>
          <div style="padding: 20px; color: #334155;">
            <p>Xin chào,</p>
            <p>Hệ thống AquaFarm vừa nhận được yêu cầu khôi phục mật khẩu cho tài khoản của bạn.</p>
            <p>Mật khẩu tạm thời của bạn là: <strong style="font-size: 18px; color: #10b981; letter-spacing: 2px;">${tempPassword}</strong></p>
            <p>Vui lòng đăng nhập bằng mật khẩu này và đổi lại mật khẩu mới ngay lập tức để bảo mật tài khoản.</p>
            <br/>
            <p>Trân trọng,<br/><strong>Đội ngũ AquaFarm</strong></p>
          </div>
        </div>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      logger.error('Lỗi gửi email reset password:', error);
      throw new Error('Không thể gửi email lúc này');
    }
  }
};

module.exports = emailService;