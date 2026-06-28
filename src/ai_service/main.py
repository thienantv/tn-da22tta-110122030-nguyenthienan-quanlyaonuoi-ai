from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import time

app = FastAPI()

# 1. Khai báo chính xác các Nhãn Bệnh (PHẢI TRÙNG DATABASE VÀ THỨ TỰ CỦA COLAB)
# Ví dụ: Colab in ra {'BG': 0, 'Khoe_Manh': 1, 'WSSV': 2, 'WSSV_BG': 3}
CLASS_NAMES = ["BG", "Healthy", "WSSV", "WSSV_BG", "YH"]

# 2. Tải "bộ não" lên bộ nhớ
print("Đang tải mô hình AI...")
# 🌟 ĐÃ SỬA THÀNH ĐỊNH DẠNG .keras CHUẨN MỚI NHẤT
model = tf.keras.models.load_model('shrimp_disease_model.keras')
print("Đã tải xong mô hình!")

# 3. Hàm xử lý ảnh trước khi cho AI xem (Giống hệt lúc huấn luyện)
def preprocess_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize((224, 224)) # Đưa về đúng kích thước chuẩn 224x224
    img_array = np.array(img) / 255.0 # Chuẩn hóa màu sắc
    return np.expand_dims(img_array, axis=0)

# 4. Trạm gác tiếp nhận hình ảnh
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        # Đọc ảnh được gửi tới
        image_data = await file.read()
        processed_image = preprocess_image(image_data)

        # AI tiến hành dự đoán
        predictions = model.predict(processed_image)
        predicted_class_index = np.argmax(predictions[0]) # Lấy vị trí bệnh có điểm cao nhất
        confidence = np.max(predictions[0]) * 100 # Chuyển điểm thành %

        return {
            "predicted_disease": CLASS_NAMES[predicted_class_index],
            "confidence": float(confidence)
        }
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/ai/predict-disease")
async def predict_disease(file: UploadFile = File(...)):
    try:
        # 🌟 BẮT ĐẦU ĐO MỤC TIÊU 1
        start_time = time.time() 

        image_data = await file.read()
        processed_image = preprocess_image(image_data)

        predictions = model.predict(processed_image)
        predicted_class_index = np.argmax(predictions[0]) 
        confidence = np.max(predictions[0]) * 100 

        # 🌟 KẾT THÚC ĐO VÀ IN KẾT QUẢ RA CONSOLE PYTHON
        end_time = time.time()
        print(f"⏱️ Thời gian AI xử lý một ảnh: {round((end_time - start_time) * 1000, 2)} ms")

        return {
            "success": True,
            "data": {
                "disease_name": CLASS_NAMES[predicted_class_index],
                "confidence": float(confidence)
            }
        }
    except Exception as e:
        print(f"❌ Lỗi AI: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }
    
# uvicorn main:app --port 8000