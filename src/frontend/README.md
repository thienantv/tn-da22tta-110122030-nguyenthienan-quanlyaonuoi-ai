1. Giới thiệu tổng quan
Hệ thống Quản lý Nuôi Tôm Thông Minh là một ứng dụng web toàn diện được thiết kế để tối ưu hóa quy trình nuôi tôm thông qua việc giám sát môi trường, quản lý trang trại, phân tích dữ liệu và tích hợp trí tuệ nhân tạo (AI). Dự án này hướng đến việc cung cấp một giải pháp hiệu quả cho người nuôi tôm, giúp họ đưa ra các quyết định sáng suốt nhằm nâng cao năng suất, giảm thiểu rủi ro dịch bệnh và tối ưu hóa chi phí vận hành.

Tầm nhìn của hệ thống là chuyển đổi phương pháp nuôi tôm truyền thống sang mô hình nuôi tôm công nghệ cao, ứng dụng các tiến bộ khoa học kỹ thuật để đạt được sự phát triển bền vững. Giá trị thực tiễn mà hệ thống mang lại bao gồm:

Tăng cường năng suất: Giám sát môi trường nước liên tục và đưa ra khuyến nghị kịp thời.
Giảm thiểu rủi ro: Phát hiện sớm các dấu hiệu dịch bệnh thông qua phân tích hình ảnh AI, cảnh báo các chỉ số môi trường bất thường.
Tối ưu hóa quản lý: Quản lý tập trung các ao nuôi, mùa vụ, nhân sự và sản phẩm.
Nâng cao chất lượng sản phẩm: Duy trì môi trường nuôi tối ưu, góp phần tạo ra sản phẩm tôm chất lượng cao.
2. Kiến trúc hệ thống
Hệ thống được xây dựng dựa trên mô hình Kiến trúc Ba tầng (3-Tier Architecture), đảm bảo tính modular, khả năng mở rộng và dễ dàng bảo trì. Ngoài ra, hệ thống còn tích hợp một AI Engine độc lập, tăng cường khả năng phân tích và chẩn đoán thông minh.

a. Các tầng kiến trúc chính:

Presentation Layer (Frontend):

Phát triển bằng React.js sử dụng bộ công cụ Vite cho tốc độ phát triển nhanh chóng.
Giao diện người dùng được thiết kế hiện đại, tối giản với Tailwind CSS, áp dụng phong cách Glassmorphism để tạo hiệu ứng thị giác chuyên nghiệp.
Hiển thị dữ liệu trực quan bằng các biểu đồ từ thư viện Recharts và Chart.js, với các hiệu ứng tải cục bộ (Local Loading) và làm mờ nền (Backdrop Blur) để cải thiện trải nghiệm người dùng.
Giao tiếp với Backend thông qua các API RESTful sử dụng Axios.
Sử dụng Socket.IO Client để nhận dữ liệu thời gian thực và thông báo.
Application Layer (Backend):

Xây dựng trên nền tảng Node.js với framework Express.js.
Chịu trách nhiệm xử lý logic nghiệp vụ, quản lý phiên, xác thực người dùng (Authentication) và phân quyền (Authorization) dựa trên JSON Web Tokens (JWT).
Tương tác với Database thông qua thư viện pg (PostgreSQL client).
Cung cấp các API RESTful cho Frontend.
Tích hợp Socket.IO Server để truyền dữ liệu và thông báo theo thời gian thực.
Sử dụng Multer để xử lý upload ảnh cho tính năng chẩn đoán AI.
Lập lịch công việc tự động (Cron-jobs) bằng node-cron để thực hiện các tác vụ định kỳ như dọn dẹp tài khoản khóa hoặc cập nhật trạng thái công việc.
Giao tiếp với AI Engine thông qua HTTP requests.
Data Layer (Database):

Sử dụng PostgreSQL làm hệ quản trị cơ sở dữ liệu quan hệ.
Lưu trữ tất cả dữ liệu hệ thống bao gồm thông tin người dùng, ao nuôi, mùa vụ, sản phẩm, nhật ký môi trường, nhật ký canh tác và các bản ghi liên quan đến AI.
Được thiết kế tối ưu để đảm bảo tính toàn vẹn, nhất quán và hiệu suất cao.
b. Luồng giao tiếp với AI Engine:

AI Engine là một dịch vụ độc lập, được phát triển bằng Python, chuyên biệt cho các tác vụ học sâu (Deep Learning).

Người dùng tải ảnh: Kỹ sư hoặc Owner tải lên ảnh tôm/ao nuôi thông qua giao diện Frontend.
Frontend gửi ảnh đến Backend: Ảnh được gửi đến Backend (Node.js) qua API.
Backend Proxy ảnh đến AI Engine: Backend nhận ảnh và sử dụng Axios để chuyển tiếp (proxy) ảnh đến AI Engine (Python) thông qua một HTTP POST request. Điều này giúp tách biệt logic xử lý hình ảnh phức tạp ra khỏi Backend chính và tận dụng được các thư viện AI mạnh mẽ của Python.
AI Engine xử lý hình ảnh: AI Engine nhận ảnh, thực hiện tiền xử lý và đưa vào mô hình học sâu CNN MobileNetV2 để phân tích.
AI Engine dự đoán: Mô hình AI dự đoán tình trạng sức khỏe của tôm, phân loại vào 4 lớp chính: BG (Nền), WSSV (Hội chứng đốm trắng), YHD (Bệnh đầu vàng), và Healthy (Khỏe mạnh).
AI Engine trả về kết quả: AI Engine trả về kết quả dự đoán (lớp bệnh, mức độ tin cậy - Confidence Score) và phác đồ 3 bước (khuyến nghị xử lý) cho Backend.
Backend xử lý và lưu trữ: Backend nhận kết quả từ AI Engine, có thể thực hiện thêm các bước xử lý nghiệp vụ (ví dụ: ghi nhật ký chẩn đoán, gửi thông báo) và lưu trữ kết quả vào Database.
Backend trả về kết quả cho Frontend: Backend gửi kết quả chẩn đoán cuối cùng về Frontend để hiển thị cho người dùng.
Frontend hiển thị kết quả: Frontend trình bày kết quả chẩn đoán AI một cách trực quan, bao gồm hình ảnh đã phân tích, kết quả dự đoán, mức độ tin cậy và phác đồ khuyến nghị.
3. Danh sách tính năng toàn diện
Hệ thống được thiết kế với một bộ tính năng phong phú, phân loại rõ ràng theo vai trò người dùng (Owner, Technician, Worker) và tập trung vào chiều sâu kỹ thuật trong các nghiệp vụ cốt lõi.

a. Tính năng chung
Đăng ký & Đăng nhập: Hệ thống cung cấp cơ chế đăng ký tài khoản mới và đăng nhập an toàn, sử dụng mã hóa mật khẩu (bcryptjs) và JSON Web Tokens (JWT) để xác thực và ủy quyền.
Quản lý hồ sơ cá nhân: Người dùng có thể xem và cập nhật thông tin cá nhân.
Đổi mật khẩu & Quên mật khẩu: Cơ chế an toàn để thay đổi hoặc đặt lại mật khẩu.
b. Tính năng theo vai trò
Owner (Chủ trang trại)
Tổng quan & Thống kê (Dashboard):
Hiển thị biểu đồ tổng quan về tình trạng các ao nuôi, các mùa vụ đang diễn ra, số lượng nhân sự, sản lượng dự kiến và chi phí.
Biểu đồ Recharts và Chart.js với hiệu ứng tải cục bộ giúp dữ liệu được cập nhật mượt mà.
Quản lý Ao nuôi (Ponds):
Thêm, sửa, xóa thông tin chi tiết về từng ao nuôi.
Xem trạng thái hiện tại và lịch sử của từng ao.
Quản lý Mùa vụ (Seasons):
Tạo, quản lý và theo dõi các mùa vụ nuôi tôm, bao gồm thời gian bắt đầu, kết thúc, loại tôm, và sản lượng mục tiêu.
Quản lý Sản phẩm (Products):
Thêm, sửa, xóa các loại sản phẩm (thức ăn, hóa chất, thuốc men) được sử dụng trong quá trình nuôi.
Theo dõi tồn kho và lịch sử sử dụng.
Quản lý Môi trường (Environment):
Xem dữ liệu cảm biến môi trường nước (pH, Oxy, nhiệt độ, độ mặn...) theo thời gian thực và lịch sử.
Biểu đồ động trực quan hóa sự thay đổi của các chỉ số.
Quản lý Nhật ký canh tác (Farming Logs):
Xem và phê duyệt các nhật ký công việc được Kỹ sư/Công nhân nhập vào.
Cơ chế khóa sổ (Lock): Để bảo vệ tính toàn vẹn của dữ liệu, sau một khoảng thời gian nhất định (hoặc khi mùa vụ kết thúc), các nhật ký canh tác sẽ được tự động khóa lại, ngăn chặn mọi chỉnh sửa để đảm bảo tính chính xác và không thay đổi của dữ liệu lịch sử.
Quản lý Chi phí (Cost Management):
Theo dõi và phân tích các khoản chi phí liên quan đến nuôi tôm (thức ăn, điện nước, nhân công, thuốc men...).
Quản lý Chẩn đoán AI (AI Diagnostic):
Xem lịch sử các lần chẩn đoán AI và kết quả tương ứng.
Có thể tải lên hình ảnh để thực hiện chẩn đoán dịch bệnh cho tôm.
Quản lý Nhân sự & Phân quyền (Manage Staff & RBAC):
Cơ chế Phân quyền (RBAC) & Quản lý nhân sự ma trận: Hệ thống triển khai mô hình kiểm soát truy cập dựa trên vai trò (Role-Based Access Control) với ba cấp độ chính: Owner (chủ trang trại), Technician (kỹ sư), và Worker (công nhân).
Owner: Có toàn quyền quản lý hệ thống, bao gồm quản lý người dùng, ao nuôi, mùa vụ, sản phẩm, chi phí, và xem tất cả các báo cáo.
Technician: Có quyền giám sát môi trường, quản lý nhật ký canh tác, thực hiện chẩn đoán AI và quản lý công việc trong các ao được phân công.
Worker: Chỉ có quyền xem các công việc được giao và cập nhật trạng thái công việc.
Thuật toán kiểm tra ràng buộc trước khi xóa nhân sự: Khi Owner thực hiện xóa một tài khoản nhân sự (Technician hoặc Worker), hệ thống sẽ kiểm tra tất cả các ràng buộc liên quan:
Công việc đang hoạt động: Kiểm tra xem người dùng đó có đang phụ trách bất kỳ công việc nào đang IN_PROGRESS hay không.
Nhật ký canh tác: Kiểm tra xem người dùng đó có bất kỳ nhật ký canh tác nào được ghi trong mùa vụ hiện tại hoặc gần đây hay không.
Phân công ao: Kiểm tra xem người dùng đó có đang được phân công vào bất kỳ ao nuôi nào hay không.
Nếu có bất kỳ ràng buộc nào tồn tại, hệ thống sẽ đưa ra cảnh báo và yêu cầu Owner phải gỡ bỏ các ràng buộc đó trước khi tiến hành xóa tài khoản. Điều này đảm bảo tính toàn vẹn của dữ liệu và tránh các lỗi tham chiếu.
Cron-job tự động quét gỡ liên kết trại (farm_id = NULL) đối với tài khoản bị khóa quá 30 ngày: Một cron-job định kỳ sẽ được chạy (sử dụng node-cron).
Nó quét các tài khoản người dùng có trạng thái locked (bị khóa).
Đối với những tài khoản đã bị khóa quá 30 ngày, hệ thống sẽ tự động gỡ bỏ liên kết của họ với các farm_id (thiết lập farm_id = NULL). Điều này giải phóng các tài khoản này khỏi các trang trại cụ thể, hỗ trợ cho việc tái phân công hoặc dọn dẹp dữ liệu người dùng không còn hoạt động một cách hiệu quả và tự động.
Technician (Kỹ sư)
Tổng quan & Thống kê (Dashboard):
Hiển thị biểu đồ tổng quan về các ao nuôi được phân công, các mùa vụ đang diễn ra, và các công việc cần thực hiện.
Quản lý Ao nuôi (Ponds):
Xem thông tin chi tiết về các ao nuôi được phân công.
Quản lý Mùa vụ (Seasons):
Xem thông tin về các mùa vụ trong các ao được phân công.
Quản lý Môi trường (Environment):
Thuật toán Cooldown 30 phút: Khi Kỹ sư nhập các thông số môi trường nước mới cho một ao nuôi, hệ thống áp dụng cơ chế khóa chống spam hai lớp:
Lớp ReactJS (Frontend): Sau khi gửi dữ liệu thành công, nút "Gửi" hoặc trường nhập liệu sẽ bị vô hiệu hóa trong 30 phút. Một bộ đếm ngược sẽ hiển thị để thông báo cho người dùng.
Lớp API Node.js (Backend): Khi API nhận yêu cầu nhập dữ liệu môi trường, nó sẽ kiểm tra timestamp của lần nhập gần nhất cho ao đó. Nếu chưa đủ 30 phút kể từ lần nhập trước, API sẽ từ chối yêu cầu và trả về lỗi 429 Too Many Requests hoặc một lỗi nghiệp vụ tương ứng.
Cơ chế này nhằm ngăn chặn việc nhập dữ liệu quá thường xuyên một cách không cần thiết, bảo vệ tính toàn vẹn của dữ liệu và giảm tải cho hệ thống.
Nhập và cập nhật các thông số môi trường nước.
Quản lý Công việc (Tasks):
Xem danh sách các công việc được giao, cập nhật trạng thái công việc (PENDING, IN_PROGRESS, COMPLETED, OVERDUE).
Cơ chế tự động hóa Công việc (Tasks): Hệ thống sử dụng một cron-job định kỳ (Backend) để tự động quét và cập nhật trạng thái của các công việc:
Nếu start_date của một công việc đã đến nhưng trạng thái vẫn là PENDING, công việc sẽ được tự động chuyển sang IN_PROGRESS.
Nếu due_date của một công việc đã qua và trạng thái không phải là COMPLETED, công việc sẽ được tự động chuyển sang OVERDUE.
Cơ chế này đảm bảo rằng trạng thái công việc luôn được phản ánh chính xác theo thời gian thực mà không cần sự can thiệp thủ công, nâng cao hiệu quả quản lý công việc.
Chẩn đoán AI (AI Diagnostic):
Tải lên hình ảnh tôm để nhận chẩn đoán về tình trạng sức khỏe.
Trợ lý AI Chẩn đoán:
Luồng xử lý ảnh: Kỹ sư tải ảnh lên Frontend. Frontend gửi ảnh đến Backend (Node.js). Backend đóng vai trò như một proxy, nhận ảnh và chuyển tiếp nó đến một dịch vụ AI độc lập được xây dựng bằng Python.
Xử lý qua mô hình học sâu CNN MobileNetV2: Dịch vụ AI Python sử dụng mô hình Convolutional Neural Network (CNN) MobileNetV2 đã được huấn luyện trước (pre-trained) hoặc tinh chỉnh (fine-tuned) cho bài toán phân loại hình ảnh tôm. MobileNetV2 là một kiến trúc hiệu quả, nhẹ, phù hợp cho việc triển khai trên các thiết bị tài nguyên hạn chế hoặc để có tốc độ xử lý nhanh.
Dự đoán 4 lớp (BG, WSSV, YHD, Healthy): Mô hình AI sẽ phân tích hình ảnh và dự đoán xác suất cho 4 lớp chính:
BG (Background): Hình ảnh không chứa tôm hoặc không đủ rõ ràng để chẩn đoán.
WSSV (White Spot Syndrome Virus): Phát hiện dấu hiệu của bệnh đốm trắng.
YHD (Yellow Head Disease): Phát hiện dấu hiệu của bệnh đầu vàng.
Healthy: Tôm khỏe mạnh, không có dấu hiệu bệnh.
Phân loại mức độ tin cậy (Confidence Score): Đối với mỗi lớp dự đoán, mô hình AI sẽ trả về một mức độ tin cậy (probability score), cho biết mức độ chắc chắn của dự đoán. Mức độ tin cậy cao sẽ giúp Kỹ sư đưa ra quyết định nhanh chóng và chính xác hơn.
Kết xuất phác đồ 3 bước: Dựa trên kết quả dự đoán và mức độ tin cậy, dịch vụ AI sẽ tự động tạo ra một phác đồ khuyến nghị 3 bước hành động cụ thể cho Kỹ sư:
Bước 1: Xác nhận/Quan sát: Yêu cầu Kỹ sư xác nhận lại triệu chứng bằng mắt thường hoặc quan sát thêm trong một khoảng thời gian nhất định.
Bước 2: Hành động sơ bộ: Đề xuất các biện pháp xử lý ban đầu như cách ly tôm bệnh, điều chỉnh môi trường nước, hoặc sử dụng một loại thuốc/chất bổ sung nhất định.
Bước 3: Tham vấn chuyên gia/Theo dõi sâu: Khuyến nghị lấy mẫu xét nghiệm, tham vấn với chuyên gia thú y thủy sản, hoặc thiết lập lịch trình theo dõi chặt chẽ hơn.
Kết quả này sau đó được Backend chuyển về Frontend để hiển thị cho Kỹ sư.
Worker (Công nhân)
Tổng quan (Dashboard):
Xem tổng quan các công việc được giao trong ngày/tuần.
Quản lý Công việc (Tasks):
Xem chi tiết các công việc được giao.
Cập nhật trạng thái công việc (COMPLETED) sau khi hoàn thành.
Công nhân chỉ có thể cập nhật trạng thái của các công việc được giao cho chính mình.
c. Kiến trúc giao diện
Thiết kế Glassmorphism trên Tailwind CSS: Giao diện người dùng được xây dựng với Tailwind CSS, tận dụng các tiện ích CSS linh hoạt để tạo ra một thiết kế Glassmorphism hiện đại. Điều này bao gồm việc sử dụng thuộc tính backdrop-filter: blur() kết hợp với màu nền bán trong suốt để tạo hiệu ứng "kính mờ" xuyên thấu, mang lại cảm giác chiều sâu và sự sang trọng. Thiết kế này nhấn mạnh sự tối giản, sử dụng không gian trắng hiệu quả và bố cục rõ ràng để nâng cao trải nghiệm người dùng.
Tối giản và trực quan: Hệ thống tập trung vào việc trình bày thông tin một cách tối giản, loại bỏ các yếu tố gây xao nhãng. Các thành phần giao diện được thiết kế để dễ hiểu và dễ thao tác, giúp người dùng nhanh chóng nắm bắt tình hình và thực hiện các tác vụ cần thiết.
Biểu đồ Recharts có hiệu ứng Local Loading (Backdrop blur): Các biểu đồ dữ liệu được tạo bằng Recharts không chỉ cung cấp cái nhìn trực quan về các chỉ số môi trường, hiệu suất ao nuôi, v.v., mà còn được tích hợp hiệu ứng tải cục bộ. Khi dữ liệu cho một biểu đồ đang được tải, một lớp phủ bán trong suốt với hiệu ứng làm mờ nền (backdrop blur) sẽ xuất hiện trên khu vực biểu đồ. Điều này không chỉ báo hiệu cho người dùng rằng dữ liệu đang được tải mà còn tạo ra một trải nghiệm người dùng mượt mà và chuyên nghiệp hơn, tránh việc hiển thị trạng thái tải toàn trang.
4. Cấu trúc Cơ sở dữ liệu
Cơ sở dữ liệu được thiết kế trên PostgreSQL với các bảng chính và mối quan hệ để hỗ trợ các nghiệp vụ của hệ thống. Dưới đây là tóm tắt cấu trúc các bảng cốt lõi:


Apply
-- Bảng Người dùng (Users)
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'technician', 'worker')),
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE, -- Thêm cột is_locked để hỗ trợ cron-job
    locked_at TIMESTAMP WITH TIME ZONE, -- Thời điểm tài khoản bị khóa
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Trang trại (Farms)
CREATE TABLE farms (
    farm_id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    farm_name VARCHAR(255) NOT NULL,
    location TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Thêm cột farm_id vào bảng users (nếu user có thể liên kết với farm)
ALTER TABLE users ADD COLUMN farm_id INTEGER REFERENCES farms(farm_id) ON DELETE SET NULL;


-- Bảng Ao nuôi (Ponds)
CREATE TABLE ponds (
    pond_id SERIAL PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    pond_name VARCHAR(255) NOT NULL,
    size_sqm DECIMAL(10, 2),
    depth_m DECIMAL(5, 2),
    status VARCHAR(50) DEFAULT 'inactive', -- active, inactive, under_maintenance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Mùa vụ (Seasons)
CREATE TABLE seasons (
    season_id SERIAL PRIMARY KEY,
    pond_id INTEGER NOT NULL REFERENCES ponds(pond_id) ON DELETE CASCADE,
    shrimp_species VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    expected_yield_kg DECIMAL(10, 2),
    actual_yield_kg DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Nhật ký môi trường (EnvironmentLogs)
CREATE TABLE environment_logs (
    log_id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
    technician_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL, -- Ai là người nhập
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ph_level DECIMAL(4, 2),
    do_level DECIMAL(5, 2), -- Dissolved Oxygen
    salinity_ppt DECIMAL(5, 2), -- Parts Per Thousand
    temperature_c DECIMAL(4, 2),
    ammonia_mg_l DECIMAL(5, 2),
    nitrite_mg_l DECIMAL(5, 2),
    nitrate_mg_l DECIMAL(5, 2),
    alkalinity_mg_l DECIMAL(7, 2),
    last_input_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP -- Hỗ trợ cooldown
);

-- Bảng Sản phẩm (Products)
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- e.g., 'feed', 'medicine', 'chemical'
    unit VARCHAR(50), -- e.g., 'kg', 'liter', 'pack'
    current_stock DECIMAL(10, 2),
    price_per_unit DECIMAL(10, 2),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Chi phí (Expenses)
CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    season_id INTEGER REFERENCES seasons(season_id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(product_id) ON DELETE SET NULL,
    expense_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    category VARCHAR(100), -- e.g., 'feed', 'labor', 'electricity', 'medicine'
    incurred_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Công việc (Tasks)
CREATE TABLE tasks (
    task_id SERIAL PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
    assigned_to INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, overdue
    priority VARCHAR(50) DEFAULT 'medium',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Nhật ký canh tác (CultivationLogs) - chi tiết công việc hàng ngày
CREATE TABLE cultivation_logs (
    cultivation_log_id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(task_id) ON DELETE SET NULL,
    season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE CASCADE,
    logged_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    log_date DATE DEFAULT CURRENT_DATE,
    activity_description TEXT NOT NULL,
    observations TEXT,
    notes TEXT,
    is_locked BOOLEAN DEFAULT FALSE, -- Hỗ trợ cơ chế khóa sổ
    locked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Chẩn đoán AI (AiDiagnostics)
CREATE TABLE ai_diagnostics (
    diagnosis_id SERIAL PRIMARY KEY,
    season_id INTEGER REFERENCES seasons(season_id) ON DELETE SET NULL,
    uploaded_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    upload_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    image_url TEXT NOT NULL,
    predicted_class VARCHAR(100) NOT NULL, -- e.g., 'WSSV', 'YHD', 'Healthy', 'Background'
    confidence_score DECIMAL(5, 4),
    recommendations TEXT, -- Phác đồ 3 bước
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Thông báo (Notifications)
CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(50), -- e.g., 'alert', 'warning', 'info', 'task_update'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
Mối quan hệ chính:

users 1-N farms (Owner sở hữu nhiều trang trại)
users 1-N tasks (User được giao nhiều công việc)
users 1-N cultivation_logs (User ghi nhiều nhật ký canh tác)
farms 1-N ponds (Trang trại có nhiều ao nuôi)
farms 1-N products (Trang trại quản lý nhiều sản phẩm)
farms 1-N expenses (Trang trại có nhiều chi phí)
ponds 1-N seasons (Ao nuôi có nhiều mùa vụ)
seasons 1-N environment_logs (Mùa vụ có nhiều nhật ký môi trường)
seasons 1-N tasks (Mùa vụ có nhiều công việc)
seasons 1-N cultivation_logs (Mùa vụ có nhiều nhật ký canh tác)
seasons 1-N ai_diagnostics (Mùa vụ có nhiều chẩn đoán AI)
tasks 1-N cultivation_logs (Công việc có thể có nhiều nhật ký canh tác liên quan)
5. Hướng dẫn cài đặt và Khởi chạy
Để cài đặt và khởi chạy hệ thống, bạn cần cấu hình cả phần Frontend, Backend và AI Service.

a. Yêu cầu hệ thống
Node.js (phiên bản 16 trở lên)
Python (phiên bản 3.8 trở lên)
PostgreSQL Database
Git
b. Cấu hình biến môi trường
Tạo một tệp .env trong thư mục gốc của cả backend và ai_service theo cấu trúc sau:

backend/.env:


Apply
PORT=5000
DATABASE_URL="postgresql://user:password@host:port/database_name"
JWT_SECRET="your_jwt_secret_key"
JWT_EXPIRES_IN="1h"
AI_SERVICE_URL="http://localhost:8000/predict" # URL của dịch vụ AI
EMAIL_USER="your_email@example.com"
EMAIL_PASS="your_email_password_or_app_specific_password"
ai_service/.env:

Run
PORT=8000
c. Cài đặt và khởi chạy Frontend
Di chuyển vào thư mục Frontend:
Run
cd frontend
Cài đặt các gói phụ thuộc:
Run
npm install
Khởi chạy ứng dụng Frontend:
Run
npm run dev
Ứng dụng Frontend sẽ chạy tại http://localhost:5173 (hoặc một cổng khác tùy cấu hình Vite).
d. Cài đặt và khởi chạy Backend
Di chuyển vào thư mục Backend:
Run
cd backend
Cài đặt các gói phụ thuộc:
Run
npm install
Khởi chạy ứng dụng Backend:
Run
npm run dev
Ứng dụng Backend sẽ chạy tại http://localhost:5000 (hoặc cổng được cấu hình trong .env).
e. Cài đặt và khởi chạy AI Service (Python)
Di chuyển vào thư mục AI Service:
Run
cd ai_service
Cài đặt các gói phụ thuộc:
Run
# Khuyến nghị sử dụng virtual environment
python -m venv venv
source venv/bin/activate # Trên Windows dùng `venv\Scripts\activate`
pip install -r requirements.txt # Cần tạo file requirements.txt
(Nếu chưa có requirements.txt, bạn cần tạo nó bằng cách liệt kê các thư viện Python đã sử dụng, ví dụ: tensorflow, flask, opencv-python, Pillow, numpy, python-dotenv).
Khởi chạy dịch vụ AI:
Run
python app.py # Giả sử file chính là app.py
Dịch vụ AI sẽ chạy tại http://localhost:8000 (hoặc cổng được cấu hình trong .env).
f. Cấu hình Database
Tạo cơ sở dữ liệu PostgreSQL: Sử dụng công cụ quản lý PostgreSQL của bạn để tạo một cơ sở dữ liệu mới (ví dụ: smart_shrimp_db).

Chạy các script SQL: Sử dụng nội dung từ file shrimp_db.sql hoặc shrimp_db.session.sql để tạo các bảng và thiết lập schema cơ sở dữ liệu.

Run
# Ví dụ sử dụng psql
psql -U your_username -d smart_shrimp_db -f shrimp_db.sql
6. Đóng góp & Bản quyền
Dự án này là một phần của báo cáo đồ án tốt nghiệp đại học, được phát triển với mục đích học thuật và nghiên cứu. Mọi đóng góp, ý kiến phản hồi và cải tiến đều được hoan nghênh.

Đồ án tốt nghiệp: [Tên đầy đủ của Đồ án tốt nghiệp]
Sinh viên thực hiện: [Tên của bạn]
Giảng viên hướng dẫn: [Tên giảng viên]
Trường: [Tên trường đại học]
Bản quyền: Mã nguồn dự án này được phát hành dưới giấy phép MIT.