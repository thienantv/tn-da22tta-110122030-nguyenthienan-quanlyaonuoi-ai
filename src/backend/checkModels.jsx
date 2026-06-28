require('dotenv').config(); // Đọc API Key từ file .env
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function listMyModels() {
    console.log("Đang dò tìm các mô hình AI bạn được phép dùng...");
    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
        
        console.log("\n✅ THÀNH CÔNG! ĐÂY LÀ DANH SÁCH MÔ HÌNH CỦA BẠN:");
        response.data.models.forEach(model => {
            // Chỉ in ra các mô hình hỗ trợ generateContent (tạo văn bản)
            if (model.supportedGenerationMethods.includes("generateContent")) {
                console.log(`👉 Tên Model: "${model.name.replace('models/', '')}"`);
            }
        });
        console.log("\n💡 Hướng dẫn: Hãy copy chính xác một Tên Model ở trên (ví dụ: gemini-1.0-pro) và dán vào file diseaseController.js");
    } catch (error) {
        console.error("❌ Lỗi:", error.response ? error.response.data : error.message);
    }
}

listMyModels();