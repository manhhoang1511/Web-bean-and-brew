from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import Base, engine
from .routers import admin, auth, chat, orders, products, wishlist

Base.metadata.create_all(bind=engine)
settings.UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title=settings.APP_NAME,
    description="REST API cho website bán cà phê Bean & Brew (khách hàng + quản trị + AI chatbot).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(wishlist.router)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
# Ảnh sản phẩm mẫu (CC0, đã tải về và thu nhỏ) – nằm trong repo nên không phụ thuộc link ngoài
app.mount("/static", StaticFiles(directory=settings.STATIC_DIR), name="static")


@app.get("/api/health", tags=["System"])
def health():
    ai = "gemini" if settings.GEMINI_API_KEY else "openai" if settings.OPENAI_API_KEY else "offline"
    return {"status": "ok", "ai_provider": ai}
