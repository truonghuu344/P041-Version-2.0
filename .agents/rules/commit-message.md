---
trigger: always_on
---

# Git Commit Message Rules

Khi tạo Git commit message, PHẢI tuân thủ toàn bộ các quy tắc dưới đây.

## 1. Phạm vi phân tích

- Chỉ phân tích các thay đổi đã được stage.
- Luôn sử dụng:

  git diff --cached

- Không phân tích unstaged changes.
- Không phân tích untracked files chưa được stage.
- Commit message phải phản ánh đúng nội dung của staged changes.
- Không suy đoán thay đổi không xuất hiện trong `git diff --cached`.
- Nếu không có staged changes, không tự tạo commit message.
- Khi không có staged changes, thông báo rằng cần stage file trước.

## 2. Định dạng Conventional Commits

Bắt buộc sử dụng:

<type>[optional scope]: <description>

Ví dụ:

feat(auth): thêm đăng nhập bằng Google
fix(api): sửa lỗi xác thực Google ID token
ci: bổ sung kiểm tra backend và frontend

## 3. Quy tắc ngôn ngữ BẮT BUỘC

- `type` PHẢI viết bằng tiếng Anh.
- `scope` PHẢI viết bằng tiếng Anh.
- `description` PHẢI viết bằng tiếng Việt.
- KHÔNG được viết description bằng tiếng Anh.
- Không dịch các thuật ngữ kỹ thuật khi việc dịch làm mất nghĩa.

Các thuật ngữ có thể giữ nguyên:

- API
- OAuth
- Google OAuth
- Google ID token
- JWT
- CI/CD
- Docker
- Node.js
- npm
- Python
- FastAPI
- Next.js
- PostgreSQL
- Redis
- Ruff
- pytest
- frontend
- backend
- environment variable

ĐÚNG:

feat(auth): thêm đăng nhập bằng Google
feat(job): thêm dịch vụ quản lý danh mục việc làm
fix(api): sửa lỗi xác thực Google ID token
ci: bổ sung kiểm tra backend và frontend
test(job): bổ sung integration test cho job service
docs: cập nhật hướng dẫn thiết lập môi trường
chore(env): chuẩn hóa cấu hình Node.js 20

SAI:

feat(auth): add Google OAuth login
fix(api): handle expired Google ID tokens
ci: add backend and frontend checks
docs: update local development setup

Quy tắc tiếng Việt này là BẮT BUỘC và được ưu tiên hơn ngôn ngữ mặc định của Agent.

## 4. Các type được phép

Chỉ sử dụng các type sau:

- feat: thêm tính năng mới
- fix: sửa lỗi
- docs: thay đổi tài liệu
- style: thay đổi format, không thay đổi logic
- refactor: tái cấu trúc code nhưng không thay đổi hành vi
- perf: cải thiện hiệu năng
- test: thêm hoặc sửa test
- build: thay đổi build system hoặc dependency
- ci: thay đổi CI/CD
- chore: công việc bảo trì hoặc cấu hình

Không tự tạo type khác.

## 5. Cách chọn type

Chọn type dựa trên thay đổi chính trong staged changes.

Ví dụ:

- Thêm chức năng mới → feat
- Sửa bug → fix
- Chỉ sửa README/docs → docs
- Thêm/sửa test → test
- Sửa GitHub Actions → ci
- Thay dependency/package → build
- Refactor code → refactor
- Cấu hình môi trường/tooling → chore

Nếu staged changes chứa nhiều loại thay đổi nhưng thuộc cùng một mục tiêu, chọn type đại diện cho thay đổi chính.

Nếu staged changes chứa nhiều thay đổi không liên quan, KHÔNG cố gộp thành một commit.

Hãy đề xuất tách thành nhiều commit.

## 6. Quy tắc scope

Scope là tùy chọn.

Chỉ sử dụng scope khi nó giúp commit rõ nghĩa hơn.

Scope phải:

- ngắn gọn
- viết thường
- bằng tiếng Anh
- phản ánh module hoặc khu vực bị thay đổi

Scope phù hợp:

auth
api
cv
job
frontend
backend
env
db
oauth
docker
deps

Ví dụ:

feat(auth): thêm đăng nhập bằng Google
fix(api): sửa lỗi xử lý token hết hạn
feat(cv): thêm chức năng phân tích CV
test(job): bổ sung test cho job service
chore(env): chuẩn hóa Node.js 20

Không tạo scope quá dài.

SAI:

feat(google-oauth-authentication-service): thêm đăng nhập Google

## 7. Quy tắc description

Description phải:

- viết bằng tiếng Việt
- ngắn gọn
- cụ thể
- mô tả thay đổi thực tế
- bắt đầu bằng chữ thường
- không kết thúc bằng dấu chấm
- ưu tiên mô tả một thay đổi logic chính

Không dùng emoji.

Không dùng mô tả mơ hồ như:

- cập nhật code
- thay đổi
- sửa một số lỗi
- chỉnh sửa file
- cập nhật project
- update
- changes
- fix stuff
- modify files

Thay vào đó phải nói rõ đã thay đổi gì.

SAI:

chore: cập nhật code

ĐÚNG:

chore(env): chuẩn hóa cấu hình môi trường Node.js 20

## 8. Một commit = một thay đổi logic

Ưu tiên:

One logical change = One commit

Ví dụ staged changes có:

- Google OAuth
- CI workflow
- README
- Job service

Nếu các thay đổi này độc lập với nhau, KHÔNG tạo:

feat: thêm Google OAuth, CI/CD, tài liệu và job service

Thay vào đó đề xuất tách:

feat(auth): thêm đăng nhập bằng Google
feat(job): thêm dịch vụ quản lý danh mục việc làm
ci: bổ sung pipeline kiểm tra backend và frontend
docs: cập nhật hướng dẫn thiết lập môi trường

## 9. Không commit secret

Nếu staged changes có dấu hiệu chứa dữ liệu nhạy cảm như:

- API key thật
- password thật
- access token
- refresh token
- private key
- database password
- OAuth client secret
- SECRET_KEY thật
- file `.env` chứa credential

KHÔNG đề xuất commit ngay.

Phải cảnh báo người dùng kiểm tra và loại secret khỏi staged changes trước khi commit.

Các giá trị placeholder trong `.env.example` được phép.

Ví dụ hợp lệ:

GEMINI_API_KEY=your-gemini-api-key
SECRET_KEY=replace-with-a-long-random-secret
DATABASE_URL=postgresql://user:password@localhost/db

## 10. Không tự động commit

Khi được yêu cầu "tạo commit message":

- Chỉ phân tích staged changes.
- Chỉ đề xuất commit message.
- KHÔNG tự chạy `git commit`.
- KHÔNG tự push.
- KHÔNG tự stage thêm file.

Chỉ thực hiện commit hoặc push khi người dùng yêu cầu rõ ràng.

## 11. Format đầu ra

Khi chỉ cần tạo commit message, ưu tiên trả về đúng một commit message:

feat(auth): thêm đăng nhập bằng Google

Không giải thích dài dòng nếu không cần thiết.

Nếu staged changes nên được chia thành nhiều commit, có thể đề xuất:

Nên tách thành các commit:

feat(job): thêm dịch vụ quản lý danh mục việc làm
ci: bổ sung pipeline kiểm tra backend và frontend
test(job): bổ sung integration test cho job service

## 12. Ví dụ chuẩn của dự án

feat(auth): thêm đăng nhập bằng Google
feat(cv): thêm chức năng phân tích và đối chiếu CV
feat(job): thêm dịch vụ quản lý danh mục việc làm
feat(frontend): thêm giao diện dashboard cho ứng viên

fix(auth): xử lý Google ID token hết hạn
fix(api): sửa lỗi xác thực request
fix(db): sửa lỗi kết nối PostgreSQL

ci: bổ sung kiểm tra backend và frontend
ci: chạy Ruff và pytest cho backend
ci: thêm kiểm tra typecheck và build frontend

test(job): bổ sung integration test cho job service
test(api): bổ sung test cho API

docs: cập nhật hướng dẫn thiết lập môi trường phát triển
docs: bổ sung hướng dẫn chạy dự án trên Windows

chore(env): chuẩn hóa môi trường Node.js 20
chore(env): cập nhật biến môi trường mẫu

build(frontend): cập nhật dependency frontend
build(docker): cập nhật cấu hình Docker build

refactor(cv): tách logic xử lý CV khỏi controller
refactor(job): tái cấu trúc job service