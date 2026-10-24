"""AI Chatbot tư vấn bán hàng.

Luồng: lấy danh sách sản phẩm đang bán -> đưa vào system prompt (context) ->
gọi Gemini hoặc OpenAI -> dò tên sản phẩm trong câu trả lời để trả kèm thẻ sản phẩm.
Không có API key (hoặc gọi lỗi) -> dùng bộ tư vấn offline dựa trên từ khóa.
"""
import logging
import re

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..database import get_db
from ..models import Coupon, Product
from ..schemas import ChatIn, ChatMessage, ChatOut
from ..utils import format_vnd, strip_accents

router = APIRouter(prefix="/api", tags=["AI Chat"])
log = logging.getLogger(__name__)


def build_system_prompt(products: list[Product], coupons: list[Coupon]) -> str:
    lines = []
    for p in products:
        stock = f"còn {p.stock}" if p.stock > 0 else "HẾT HÀNG"
        extra = ", ".join(x for x in [p.origin, p.roast_level, p.weight] if x)
        lines.append(
            f"- {p.name} | {format_vnd(p.price)} | {p.category.name if p.category else 'Khác'} | {stock}"
            f" | {extra} | ⭐{p.rating_avg} | {p.description[:160]}"
        )
    coupon_lines = [f"- {c.code}: {c.description}" for c in coupons] or ["- (không có)"]
    return f"""Bạn là "Bean", nhân viên tư vấn bán hàng thân thiện của cửa hàng cà phê Bean & Brew.

NHIỆM VỤ: Tư vấn, gợi ý sản phẩm phù hợp nhu cầu, khẩu vị và ngân sách của khách.

QUY TẮC:
1. CHỈ giới thiệu sản phẩm có trong danh sách bên dưới. Viết ĐÚNG NGUYÊN VĂN tên sản phẩm. Không bịa sản phẩm, giá hay khuyến mãi.
2. Không giới thiệu sản phẩm HẾT HÀNG như thể đang có; nếu khách hỏi, hãy báo hết hàng và gợi ý sản phẩm thay thế.
3. Trả lời bằng tiếng Việt, ngắn gọn (tối đa ~120 từ), thân thiện, có thể dùng gạch đầu dòng. Giá ghi dạng 150.000đ.
4. Gợi ý tối đa 3 sản phẩm mỗi lần và giải thích ngắn gọn vì sao phù hợp.
5. Câu hỏi ngoài phạm vi cửa hàng: lịch sự từ chối và hướng về sản phẩm.
6. Để đặt hàng: khách thêm sản phẩm vào giỏ hàng rồi thanh toán trên website.

CHÍNH SÁCH:
- Phí giao hàng {format_vnd(settings.SHIPPING_FEE)}, miễn phí cho đơn từ {format_vnd(settings.FREE_SHIPPING_THRESHOLD)}.
- Thanh toán: COD, thẻ (giả lập), chuyển khoản QR (giả lập). Hủy đơn được khi đơn còn "Đang xử lý".
- Mã giảm giá đang có:
{chr(10).join(coupon_lines)}

DANH SÁCH SẢN PHẨM (tên | giá | danh mục | tồn kho | thông tin | đánh giá | mô tả):
{chr(10).join(lines)}
"""


async def ask_gemini(system: str, messages: list[ChatMessage]) -> str:
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{settings.GEMINI_MODEL}:generateContent")
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": "model" if m.role == "assistant" else "user", "parts": [{"text": m.content}]}
            for m in messages
        ],
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": 800},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, json=body, headers={"x-goog-api-key": settings.GEMINI_API_KEY})
        r.raise_for_status()
        parts = r.json()["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts).strip()


async def ask_openai(system: str, messages: list[ChatMessage]) -> str:
    body = {
        "model": settings.OPENAI_MODEL,
        "messages": [{"role": "system", "content": system}, *[m.model_dump() for m in messages]],
        "temperature": 0.6,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.openai.com/v1/chat/completions",
            json=body,
            headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


# ---------------- Bộ tư vấn offline ----------------
PRICE_RE = re.compile(r"(duoi|toi da|khong qua|max|<)\s*(\d+)\s*(k|nghin|ngan|000)?")
INTENT_WORDS = {
    "ship": ["ship", "giao hang", "van chuyen", "phi giao"],
    "coupon": ["ma giam", "khuyen mai", "voucher", "coupon", "giam gia", "sale"],
    "greet": ["xin chao", "chao", "hello", "hi ", "alo"],
    "cheap": ["re", "tiet kiem", "binh dan"],
    "strong": ["dam", "manh", "dang", "tinh tao", "robusta"],
    "light": ["nhe", "chua", "thanh", "arabica", "trai cay"],
}
STOPWORDS = {"toi", "muon", "mua", "can", "tim", "co", "khong", "nao", "cho", "minh", "ban", "gi",
             "loai", "san", "pham", "ca", "phe", "voi", "va", "la", "duoc", "nhe", "a", "oi", "em", "anh", "chi"}


def offline_reply(products: list[Product], coupons: list[Coupon], question: str) -> tuple[str, list[Product]]:
    text = f" {strip_accents(question)} "
    has = lambda key: any(w in text for w in INTENT_WORDS[key])  # noqa: E731
    available = [p for p in products if p.stock > 0]

    if has("ship"):
        return (f"🚚 Phí giao hàng là {format_vnd(settings.SHIPPING_FEE)}, **miễn phí** cho đơn từ "
                f"{format_vnd(settings.FREE_SHIPPING_THRESHOLD)}. Đơn thường được giao trong 1–3 ngày."), []
    if has("coupon"):
        if not coupons:
            return "Hiện cửa hàng chưa có mã giảm giá nào, bạn quay lại sau nhé!", []
        return "🎁 Mã giảm giá đang áp dụng:\n" + "\n".join(f"- **{c.code}**: {c.description}" for c in coupons), []

    max_price = None
    if m := PRICE_RE.search(text):
        max_price = int(m.group(2)) * (1000 if m.group(3) or int(m.group(2)) < 10_000 else 1)

    greet_words = {w.strip() for w in INTENT_WORDS["greet"]} | {"xin"}
    keywords = [w for w in text.split() if len(w) > 1 and w not in STOPWORDS and w not in greet_words]
    has_criteria = bool(max_price) or has("cheap") or has("strong") or has("light")
    scored = []
    for p in available:
        if max_price and p.price > max_price:
            continue
        match = sum(2 for w in keywords if w in p.search_text)
        if has("strong") and any(k in p.search_text for k in ("robusta", "dam", "dark")):
            match += 3
        if has("light") and any(k in p.search_text for k in ("arabica", "chua", "trai cay", "light")):
            match += 3
        if keywords and not match and not has_criteria:
            continue  # có từ khóa nhưng sản phẩm không khớp
        bonus = p.rating_avg / 5 + min(p.sold_count, 200) / 400  # ưu tiên sản phẩm được ưa chuộng
        scored.append((match + bonus, p))
    if has("cheap"):
        scored.sort(key=lambda x: x[1].price)
    else:
        scored.sort(key=lambda x: x[0], reverse=True)
    picks = [p for _, p in scored[:3]]

    if has("greet") and not keywords and not has_criteria:
        return ("Chào bạn 👋 Mình là Bean, trợ lý của Bean & Brew. Bạn thích cà phê đậm đà hay chua thanh, "
                "và ngân sách khoảng bao nhiêu để mình gợi ý nhé?"), []
    if not picks:
        return "Mình chưa tìm thấy sản phẩm phù hợp 😅 Bạn thử mô tả khẩu vị (đậm, nhẹ, chua thanh) hoặc ngân sách nhé!", []

    intro = "Chào bạn 👋 " if has("greet") else ""
    budget = f" trong tầm giá dưới {format_vnd(max_price)}" if max_price else ""
    short = lambda s: s if len(s) <= 100 else s[:100].rsplit(" ", 1)[0] + "…"  # noqa: E731
    body = "\n".join(f"- **{p.name}** – {format_vnd(p.price)}: {short(p.description)}" for p in picks)
    return (f"{intro}Mình gợi ý cho bạn{budget}:\n{body}\n\n"
            "_(Chế độ tư vấn offline – thêm GEMINI_API_KEY hoặc OPENAI_API_KEY để bật AI.)_"), picks


def find_mentioned(products: list[Product], reply: str) -> list[Product]:
    low = reply.lower()
    found = [p for p in products if p.name.lower() in low]
    found.sort(key=lambda p: low.index(p.name.lower()))
    return found[:4]


@router.post("/chat", response_model=ChatOut)
async def chat(data: ChatIn, db: Session = Depends(get_db)):
    products = db.scalars(
        select(Product).options(joinedload(Product.category)).where(Product.is_active.is_(True))
    ).all()
    coupons = db.scalars(select(Coupon).where(Coupon.is_active.is_(True))).all()
    system = build_system_prompt(products, coupons)
    messages = data.messages[-12:]  # giới hạn lịch sử để tiết kiệm token

    providers = []
    if settings.GEMINI_API_KEY:
        providers.append(("gemini", ask_gemini))
    if settings.OPENAI_API_KEY:
        providers.append(("openai", ask_openai))

    for name, ask in providers:
        try:
            reply = await ask(system, messages)
            if reply:
                return ChatOut(reply=reply, products=find_mentioned(products, reply), provider=name)
        except Exception as exc:  # lỗi mạng / hết quota -> thử provider tiếp theo
            log.warning("Chat provider %s failed: %s", name, exc)

    reply, picks = offline_reply(products, coupons, messages[-1].content)
    return ChatOut(reply=reply, products=picks, provider="offline")
