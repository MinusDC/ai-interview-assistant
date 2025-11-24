# ai-interview-assistant
Candidates can send CVs for mock interviews with AI
# Trợ lý Phỏng vấn AI — Quản lý Trạng thái Toàn diện và Rollback

## 🧠 Định hướng Bài toán
Các hệ thống AI hiện đại thường yêu cầu phản hồi từ con người theo thời gian thực trước khi tiếp tục một quy trình làm việc.  
Trợ lý Phỏng vấn AI hiện thực hóa khái niệm này bằng cách đặt con người (ứng viên) vào bên trong một hệ thống phỏng vấn tương tác, hướng sự kiện (event-driven) được vận hành bởi AI.

---

## 🎯 Tổng quan
**Trợ lý Phỏng vấn AI** là một ứng dụng web toàn diện (end-to-end) thực hiện các chức năng:
- Phân tích sơ yếu lý lịch (resume/CV) của ứng viên
- Tạo câu hỏi phỏng vấn động sử dụng Google Gemini API
- Mô phỏng phỏng vấn trực tiếp với các phản hồi được tính giờ
- Đánh giá câu trả lời bất đồng bộ thông qua AI
- Cung cấp phản hồi, chấm điểm và phân tích hiệu suất ngay lập tức

Hệ thống này hoạt động theo **hướng sự kiện (event-driven), có trạng thái (stateful) và bền bỉ (resilient)** — có khả năng tạm dừng/tiếp tục quy trình, xử lý độ trễ và hỗ trợ thử lại hoặc các vòng lặp phản hồi.

---

## ⚙️ Tổng quan Kiến trúc

### 🧩 Các Thành phần Cốt lõi
1. **Frontend (React + Vite + Ant Design)**
   - Giao diện người dùng động, có thể cấu hình cho luồng phỏng vấn
   - Theo dõi câu hỏi hiện tại, đồng hồ đếm ngược và phản hồi của người dùng
   - Giao tiếp bất đồng bộ với các API backend

2. **Backend (Node.js + Express)**
   - Xử lý logic điều phối và các tuyến API (routes)
   - Tích hợp với **Google Gemini API** cho việc hỏi đáp và phản hồi dựa trên AI
   - Duy trì trạng thái phỏng vấn và ghi nhật ký (log) để phát lại (replay) hoặc thử lại (retry)

3. **Quản lý Trạng thái & Rollback (State Management & Rollback)**
   - Phiên phỏng vấn (session) được lưu trong bộ nhớ hoặc cơ sở dữ liệu
   - Hỗ trợ thử lại câu hỏi và khởi động lại phiên làm việc
   - Ghi lại phản hồi của AI và dấu thời gian (timestamps) để quan sát

4. **Khả năng Quan sát & Phản hồi (Observability & Feedback)**
   - Dashboard trực quan hóa hiệu suất phỏng vấn và phản hồi của AI
   - Mỗi phiên bao gồm các phân tích: thời gian đã dùng, danh mục câu hỏi, điểm số và đánh giá của AI

---

## 🛠️ Tech Stack (Công nghệ sử dụng)
| Tầng (Layer) | Công nghệ |
|-------|-------------|
| **Frontend** | React, Vite, Ant Design |
| **Backend** | Node.js, Express |
| **Mô hình AI** | Google Gemini API |
| **Quản lý Trạng thái** | Session store + theo dõi trạng thái cục bộ |


---

## 💡 Tính năng Chính
- Tương tác Người–AI thời gian thực (Human-in-Loop)
- Quản lý phiên (session) có trạng thái và khả năng tiếp tục/quay lại (resume/rollback) động
- Đánh giá và phản hồi AI bất đồng bộ
- Thiết kế API hướng sự kiện (frontend & backend tách biệt)
- Có thể triển khai đầy đủ trên Render hoặc bất kỳ host Node/React nào

---

## ⚙️ Ánh xạ Tiêu chí Đánh giá
| Tiêu chí Đánh giá | Triển khai thực tế |
|----------------------|----------------|
| **Tư duy Kiến trúc (25%)** | Thiết kế hướng sự kiện; backend điều phối AI tách biệt |
| **Thiết kế Mô hình Trạng thái (20%)** | Tiến độ phỏng vấn được theo dõi qua các trạng thái: đang chờ (pending) → đang đánh giá (evaluating) → hoàn thành (completed) |
| **Khả năng Cấu hình Frontend (15%)** | Các component React động để hiển thị câu hỏi, bộ đếm giờ và phản hồi |
| **Khả năng Phục hồi & Logic Thử lại (15%)** | Hỗ trợ khởi động lại phiên và thử lại câu hỏi |
| **Sự Sáng tạo trong Tích hợp (15%)** | Tích hợp Gemini API cho logic phỏng vấn nhiều vòng |
| **Khả năng Quan sát & Vòng lặp Phản hồi (10%)** | Dashboard hiệu suất và phân tích câu trả lời chi tiết |

---

## 🧱 Cấu trúc Repository
```
ai-interview-assistant/
│
├── backend/ # Backend Express
│ ├── server.js # Điểm nhập chính của backend
│ ├── package.json # Các phụ thuộc (dependencies) của backend
│ ├── .env # Biến môi trường backend (không được commit)
│ └── public/ # Tài nguyên frontend đã build (được copy từ frontend/dist)
│
├── frontend/ # Frontend React + Vite
│ ├── src/ # Mã nguồn Frontend
│ │ ├── api.js # Wrapper API cho các cuộc gọi backend
│ │ ├── App.jsx # Ứng dụng React chính
│ │ ├── pages/ # Các trang (InterviewPage, DashboardPage, v.v.)
│ │ └── components/ # Các component React tái sử dụng
│ ├── package.json # Các phụ thuộc (dependencies) của frontend
│ ├── .env # Biến môi trường Frontend
│ └── dist/ # Bản build Production (được tạo bởi Vite)
│
├── .gitignore # Bỏ qua node_modules, env, file build
├── README.md # Tài liệu dự án

```
---

## 🚀 Demo
**GitHub:** [https://github.com/MinusDC/ai-interview-assistant](https://github.com/MinusDC/ai-interview-assistant)

---

## 🔮 Cải tiến trong Tương lai
- Thêm đánh giá đa tác nhân (Multi-agent): Bot HR + Bot Kỹ thuật
- Tích hợp thông báo Slack/Gmail cho tóm tắt buổi phỏng vấn
- Cho phép phân tích dài hạn với MongoDB hoặc Firebase
  
---

## 🚀 Bắt đầu (Getting Started)

### 1. Clone Repository
```
git clone [https://github.com/MinusDC/ai-interview-assistant](https://github.com/MinusDC/ai-interview-assistant)
cd ai-interview-assistant
```

### 2. Cài đặt Backend
```
cd backend
npm install
```
- Tạo file `.env` trong thư mục `backend/` với nội dung:
- `GEMINI_API_KEY=your_google_gemini_api_key`
- `NODE_ENV=production`
### Chạy cục bộ:
```
node server.js
```

### 3. Cài đặt Frontend
```
cd ../frontend
npm install
```
- Tạo file `.env` trong thư mục `frontend/`:
- `VITE_API_URL=http://localhost:4000`
### Chạy cục bộ:
```
npm run dev
```
- Truy cập: http://localhost:5173

Lệnh Build (Build Command):
```
cd frontend && npm ci && npm run build && cd ../backend && npm ci && mkdir -p public && cp -r ../frontend/dist/* public/
```

Lệnh Start (Start Command):
```
node server.js
```

### Biến Môi trường (Render Dashboard → Environment):

- `GEMINI_API_KEY=your_google_gemini_api_key`
- `NODE_ENV=production`
- `VITE_API_URL=https://your-service-name.onrender.com`
- Render tự động phục vụ bản build React từ `/backend/public` và proxy gọi API tới Express.

---
