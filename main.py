def main():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI()

    # Danh sách domain Frontend được phép truy cập
    origins = [
        "http://localhost:3000",  # Mặc định của Next.js / React
        "http://127.0.0.1:3000",
        # Thêm domain production khi deploy (vd: "https://my-frontend.com")
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,       # Hoặc ["*"] cho phép tất cả domain trong lúc test
        allow_credentials=True,      # Cho phép truyền cookie/authorization header
        allow_methods=["*"],          # Cho phép tất cả HTTP methods (GET, POST, PUT, DELETE,...)
    allow_headers=["*"],          # Cho phép tất cả headers
)


if __name__ == "__main__":
    main()
