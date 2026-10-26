"""AI Chatbot tư vấn bán hàng.

Luồng:
1. Lấy sản phẩm đang bán + mã giảm giá + giỏ hàng của khách -> đưa vào system prompt (context)
2. Gọi Gemini hoặc OpenAI ở chế độ streaming, khai báo tool `add_to_cart` (function calling)
3. Text sinh ra được đẩy dần về trình duyệt (Server-Sent Events); khi AI gọi tool,
   server KIỂM TRA LẠI sản phẩm/phân loại/tồn kho rồi mới gửi hành động cho frontend
4. Không có API key hoặc gọi lỗi -> bộ tư vấn offline dựa trên từ khóa

Cả POST /api/chat (trả JSON) và POST /api/chat/stream (SSE) dùng chung generator `chat_events`.
"""
import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..database import get_db
from ..models import Coupon, Product, Topping, User
from ..schemas import (
    DEFAULT_ICE, DEFAULT_SUGAR, GRIND_OPTIONS, ICE_OPTIONS, MAX_TOPPING_QTY, MAX_TOPPINGS_TOTAL, SUGAR_OPTIONS,
    ChatAction, ChatIn, ChatMessage, ChatOut, ProductOut, ToppingChoice,
)
from ..security import get_optional_user
from ..services import resolve_line_options
from ..utils import format_vnd, strip_accents

router = APIRouter(prefix="/api", tags=["AI Chat"])
log = logging.getLogger(__name__)

ADD_TO_CART_TOOL = {
    "name": "add_to_cart",
    "description": "Thêm sản phẩm vào giỏ hàng của khách. CHỈ gọi khi khách yêu cầu rõ ràng muốn mua/thêm vào giỏ.",
    "parameters": {
        "type": "object",
        "properties": {
            "product_id": {"type": "integer", "description": "id sản phẩm trong danh sách"},
            "quantity": {"type": "integer", "description": "số lượng, mặc định 1"},
            "variant": {"type": "string", "description": "tên phân loại, VD '500g' (bắt buộc nếu sản phẩm có phân loại)"},
            "grind": {"type": "string", "enum": GRIND_OPTIONS, "description": "kiểu xay (chỉ với sản phẩm cho chọn kiểu xay)"},
            "sugar": {"type": "string", "enum": SUGAR_OPTIONS, "description": "mức đường (chỉ đồ uống pha chế)"},
            "ice": {"type": "string", "enum": ICE_OPTIONS, "description": "mức đá hoặc Nóng (chỉ đồ uống pha chế)"},
            "toppings": {
                "type": "array",
                "description": "topping thêm (chỉ đồ uống cho phép topping)",
                "items": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}, "quantity": {"type": "integer"}},
                    "required": ["name"],
                },
            },
        },
        "required": ["product_id", "quantity"],
    },
}


@dataclass
class ChatContext:
    """Toàn bộ dữ liệu cần cho 1 lượt chat, nạp sẵn từ DB trước khi stream."""
    products: list[Product]
    coupons: list[Coupon]
    user_name: str | None
    cart_text: str
    by_id: dict[int, Product] = field(init=False)
    toppings: list[Topping] = field(default_factory=list)

    def __post_init__(self):
        self.by_id = {p.id: p for p in self.products}

    def find_topping(self, name: str) -> Topping | None:
        key = strip_accents(name)
        return next((t for t in self.toppings if strip_accents(t.name) == key), None) or \
            next((t for t in self.toppings if key and (key in strip_accents(t.name) or strip_accents(t.name) in key)), None)


def _price_text(p: Product) -> str:
    if p.variants:
        return " / ".join(f"{v.label}: {format_vnd(v.price)}{'' if v.stock else ' (hết)'}" for v in p.variants)
    return format_vnd(p.price)


def build_system_prompt(ctx: ChatContext) -> str:
    lines = []
    for p in ctx.products:
        stock = f"còn {p.stock}" if p.stock > 0 else "HẾT HÀNG"
        extra = ", ".join(x for x in [p.origin, p.roast_level] if x)
        grind = " | có chọn kiểu xay" if p.has_grind_option else ""
        if p.is_drink:
            grind += " | ĐỒ UỐNG: chọn size, đá, đường" + (", topping" if p.allow_toppings else "")
        lines.append(
            f"- id={p.id} | {p.name} | {_price_text(p)} | {p.category.name if p.category else 'Khác'} | {stock}"
            f"{grind} | {extra} | ⭐{p.rating_avg} | {p.description[:150]}"
        )
    coupon_lines = [f"- {c.code}: {c.description}" for c in ctx.coupons] or ["- (không có)"]
    topping_text = ", ".join(f"{t.name} +{format_vnd(t.price)}" for t in ctx.toppings) or "(không có)"
    greeting = f"Khách đang trò chuyện tên là {ctx.user_name}. Hãy xưng hô thân thiện." if ctx.user_name \
        else "Khách chưa đăng nhập."
    return f"""Bạn là "Bean", nhân viên tư vấn bán hàng thân thiện của cửa hàng cà phê Bean & Brew.

NHIỆM VỤ: Tư vấn, gợi ý sản phẩm phù hợp nhu cầu, khẩu vị và ngân sách của khách; giúp khách thêm sản phẩm vào giỏ.

QUY TẮC:
1. CHỈ giới thiệu sản phẩm có trong danh sách bên dưới. Viết ĐÚNG NGUYÊN VĂN tên sản phẩm. Không bịa sản phẩm, giá hay khuyến mãi.
2. Không giới thiệu sản phẩm/phân loại HẾT HÀNG như thể đang có; hãy báo hết hàng và gợi ý thay thế.
3. Trả lời bằng tiếng Việt, ngắn gọn (tối đa ~120 từ), có thể dùng gạch đầu dòng. Giá ghi dạng 150.000đ.
4. Gợi ý tối đa 3 sản phẩm mỗi lần và giải thích ngắn gọn vì sao phù hợp.
5. Khi khách yêu cầu thêm/mua sản phẩm: gọi tool add_to_cart (mỗi sản phẩm một lần gọi). Nếu sản phẩm có phân loại
   (khối lượng / size) mà khách chưa nói rõ, hãy hỏi lại khách muốn phân loại nào thay vì tự chọn.
   Với đồ uống: truyền mức đá, đường, topping nếu khách có nói; không nói thì để trống (mặc định {DEFAULT_ICE}, {DEFAULT_SUGAR} đường).
6. Câu hỏi ngoài phạm vi cửa hàng: lịch sự từ chối và hướng về sản phẩm.

{greeting}
GIỎ HÀNG HIỆN TẠI CỦA KHÁCH: {ctx.cart_text}

CHÍNH SÁCH:
- Phí giao hàng {format_vnd(settings.SHIPPING_FEE)}, miễn phí cho đơn từ {format_vnd(settings.FREE_SHIPPING_THRESHOLD)}.
- Thanh toán: COD, thẻ, chuyển khoản QR. Hủy đơn được khi đơn còn "Đang xử lý".
- Mã giảm giá đang có:
{chr(10).join(coupon_lines)}

TÙY CHỌN ĐỒ UỐNG PHA CHẾ:
- Đá: {", ".join(ICE_OPTIONS)} | Đường: {", ".join(SUGAR_OPTIONS)}
- Topping (giá mỗi phần, tối đa {MAX_TOPPING_QTY} phần/loại, {MAX_TOPPINGS_TOTAL} phần/ly): {topping_text}

DANH SÁCH SẢN PHẨM (id | tên | giá theo phân loại | danh mục | tồn kho | kiểu xay | thông tin | đánh giá | mô tả):
{chr(10).join(lines)}
"""


# ---------------- Kiểm tra hành động AI yêu cầu ----------------
def resolve_add_to_cart(ctx: ChatContext, args: dict) -> tuple[ChatAction | None, str]:
    """Không tin tuyệt đối vào AI: kiểm tra id, phân loại, kiểu xay, tồn kho. Trả (action, mô tả/lý do lỗi)."""
    try:
        product = ctx.by_id.get(int(args.get("product_id", 0)))
        qty = max(1, min(int(args.get("quantity") or 1), 20))
    except (TypeError, ValueError):
        return None, "Yêu cầu không hợp lệ"
    if not product:
        return None, "Không tìm thấy sản phẩm"
    variant = None
    if product.variants:
        wanted = strip_accents(str(args.get("variant") or ""))
        variant = next((v for v in product.variants if strip_accents(v.label) == wanted), None)
        if variant is None:
            options = ", ".join(v.label for v in product.variants)
            return None, f"**{product.name}** có các phân loại: {options}. Bạn muốn chọn loại nào ạ?"
    stock = variant.stock if variant else product.stock
    label = f"{product.name}" + (f" ({variant.label})" if variant else "")
    if stock <= 0:
        return None, f"Rất tiếc **{label}** đang hết hàng 😢"
    qty = min(qty, stock)
    grind = args.get("grind") if product.has_grind_option else None
    if product.has_grind_option and grind not in GRIND_OPTIONS:
        grind = "Nguyên hạt"
    sugar = args.get("sugar") if product.is_drink and args.get("sugar") in SUGAR_OPTIONS else None
    ice = args.get("ice") if product.is_drink and args.get("ice") in ICE_OPTIONS else None

    tops, unknown, capped = [], [], []
    for t in (args.get("toppings") or []) if product.allow_toppings else []:
        name = str(t.get("name", "") if isinstance(t, dict) else t)
        try:
            wanted = int(t.get("quantity") or 1) if isinstance(t, dict) else 1
        except (TypeError, ValueError):
            wanted = 1
        tq = max(1, min(wanted, MAX_TOPPING_QTY))
        if top := ctx.find_topping(name):
            tops.append((top.id, tq))
            if wanted > MAX_TOPPING_QTY:
                capped.append(top.name)
        else:
            unknown.append(name)
    if unknown:
        have = ", ".join(t.name for t in ctx.toppings)
        return None, f"Bean chưa có topping **{', '.join(unknown)}** 😅 Hiện có: {have}. Bạn chọn loại khác nhé?"
    try:
        opts = resolve_line_options(product, variant, grind, sugar, ice, tops, {t.id: t for t in ctx.toppings})
    except HTTPException as exc:  # VD quá số topping cho phép
        return None, str(exc.detail)

    o = opts.options or {}
    action = ChatAction(product=ProductOut.model_validate(product), variant_id=variant.id if variant else None,
                        grind=o.get("grind"), sugar=o.get("sugar"), ice=o.get("ice"),
                        toppings=[ToppingChoice(topping_id=t["id"], quantity=t["quantity"]) for t in o.get("toppings", [])],
                        quantity=qty)
    desc = f"{qty} × **{product.name}**" + (f" ({opts.label})" if opts.label else "")
    if capped:  # báo cho khách biết đã bị giới hạn thay vì âm thầm sửa
        desc += f" – {', '.join(capped)} tối đa {MAX_TOPPING_QTY} phần/ly nên Bean để {MAX_TOPPING_QTY} phần nhé"
    return action, desc


# ---------------- Gọi LLM (streaming) ----------------
# Mỗi provider là async generator trả về ("text", str) hoặc ("tool", dict args)
async def stream_gemini(system: str, messages: list[ChatMessage]) -> AsyncIterator[tuple[str, object]]:
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{settings.GEMINI_MODEL}:streamGenerateContent?alt=sse")
    tool = {**ADD_TO_CART_TOOL, "parameters": _to_gemini_schema(ADD_TO_CART_TOOL["parameters"])}
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [
            {"role": "model" if m.role == "assistant" else "user", "parts": [{"text": m.content}]}
            for m in messages
        ],
        "tools": [{"functionDeclarations": [tool]}],
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": 1024},
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(45, connect=5)) as client:
        async with client.stream("POST", url, json=body, headers={"x-goog-api-key": settings.GEMINI_API_KEY}) as r:
            if r.status_code != 200:
                raise RuntimeError(f"Gemini {r.status_code}: {(await r.aread())[:300]!r}")
            async for line in r.aiter_lines():
                if not line.startswith("data:"):
                    continue
                chunk = json.loads(line[5:])
                for part in chunk.get("candidates", [{}])[0].get("content", {}).get("parts", []):
                    if part.get("thought"):
                        continue
                    if "functionCall" in part and part["functionCall"].get("name") == "add_to_cart":
                        yield "tool", part["functionCall"].get("args", {})
                    elif part.get("text"):
                        yield "text", part["text"]


def _to_gemini_schema(schema: dict) -> dict:
    """Gemini dùng kiểu viết hoa (OBJECT, STRING, ARRAY...)."""
    out = {k: v for k, v in schema.items() if k not in ("type", "properties", "items")}
    out["type"] = schema["type"].upper()
    if "properties" in schema:
        out["properties"] = {k: _to_gemini_schema(v) for k, v in schema["properties"].items()}
    if "items" in schema:
        out["items"] = _to_gemini_schema(schema["items"])
    return out


async def stream_openai(system: str, messages: list[ChatMessage]) -> AsyncIterator[tuple[str, object]]:
    body = {
        "model": settings.OPENAI_MODEL,
        "messages": [{"role": "system", "content": system}, *[m.model_dump() for m in messages]],
        "tools": [{"type": "function", "function": ADD_TO_CART_TOOL}],
        "temperature": 0.6,
        "stream": True,
    }
    calls: dict[int, str] = {}  # tool call arguments đến theo từng mảnh -> ghép lại
    async with httpx.AsyncClient(timeout=httpx.Timeout(45, connect=5)) as client:
        async with client.stream("POST", "https://api.openai.com/v1/chat/completions", json=body,
                                 headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}) as r:
            if r.status_code != 200:
                raise RuntimeError(f"OpenAI {r.status_code}: {(await r.aread())[:300]!r}")
            async for line in r.aiter_lines():
                if not line.startswith("data:") or line.strip() == "data: [DONE]":
                    continue
                delta = json.loads(line[5:])["choices"][0]["delta"]
                if delta.get("content"):
                    yield "text", delta["content"]
                for tc in delta.get("tool_calls") or []:
                    calls[tc["index"]] = calls.get(tc["index"], "") + (tc.get("function", {}).get("arguments") or "")
    for raw in calls.values():
        try:
            yield "tool", json.loads(raw or "{}")
        except json.JSONDecodeError:
            log.warning("Bad tool args from OpenAI: %s", raw)


# ---------------- Bộ tư vấn offline ----------------
PRICE_RE = re.compile(r"(duoi|toi da|khong qua|max|<)\s*(\d+)\s*(k|nghin|ngan|000)?")
ADD_RE = re.compile(r"\b(them|bo|cho|lay|mua|dat)\b.*\b(gio|goi|hop|cai|chai|phan|ly|bo)\b|\bvao gio\b")
QTY_RE = re.compile(r"\b(\d{1,2})\b(?!\s*(%|(g|kg|k|ml)\b))")  # "5 gói" là số lượng; "5g", "50%" thì không
INTENT_WORDS = {
    "ship": ["ship", "giao hang", "van chuyen", "phi giao"],
    "coupon": ["ma giam", "khuyen mai", "voucher", "coupon", "giam gia", "sale"],
    "greet": ["xin chao", "chao", "hello", "hi ", "alo"],
    "cheap": ["re", "tiet kiem", "binh dan"],
    "strong": ["dam", "manh", "dang", "tinh tao", "robusta"],
    "light": ["nhe", "chua", "thanh", "arabica", "trai cay"],
}
STOPWORDS = {"toi", "muon", "mua", "can", "tim", "co", "khong", "nao", "cho", "minh", "ban", "gi", "them", "vao",
             "gio", "lay", "goi", "loai", "san", "pham", "ca", "phe", "voi", "va", "la", "duoc", "nhe", "a", "oi",
             "em", "anh", "chi", "hang", "dat", "bo", "hop", "cai"}


def _score_products(ctx: ChatContext, text: str, has, max_price: int | None):
    greet_words = {w.strip() for w in INTENT_WORDS["greet"]} | {"xin"}
    keywords = [w for w in text.split() if len(w) > 1 and w not in STOPWORDS and w not in greet_words
                and not w.isdigit() and not re.fullmatch(r"\d+(g|kg|k)", w)]
    has_criteria = bool(max_price) or has("cheap") or has("strong") or has("light")
    scored = []
    for p in ctx.products:
        if p.stock <= 0 or (max_price and p.price > max_price):
            continue
        match = sum(2 for w in keywords if w in p.search_text) + sum(3 for w in keywords if w in strip_accents(p.name))
        if has("strong") and any(k in p.search_text for k in ("robusta", "dam", "dark")):
            match += 3
        if has("light") and any(k in p.search_text for k in ("arabica", "chua", "trai cay", "light")):
            match += 3
        if keywords and not match and not has_criteria:
            continue
        bonus = p.rating_avg / 5 + min(p.sold_count, 200) / 400  # ưu tiên sản phẩm được ưa chuộng
        scored.append((match, match + bonus, p))
    scored.sort(key=(lambda x: x[2].price) if has("cheap") else (lambda x: x[1]), reverse=not has("cheap"))
    return keywords, has_criteria, scored


def offline_reply(ctx: ChatContext, question: str) -> tuple[str, list[Product], list[dict]]:
    """Trả về (câu trả lời, sản phẩm gợi ý, danh sách tool args giống AI)."""
    text = f" {strip_accents(question)} "
    has = lambda key: any(w in text for w in INTENT_WORDS[key])  # noqa: E731
    short = lambda s: s if len(s) <= 100 else s[:100].rsplit(" ", 1)[0] + "…"  # noqa: E731

    if has("ship"):
        return (f"🚚 Phí giao hàng là {format_vnd(settings.SHIPPING_FEE)}, **miễn phí** cho đơn từ "
                f"{format_vnd(settings.FREE_SHIPPING_THRESHOLD)}. Đơn thường được giao trong 1–3 ngày."), [], []
    if has("coupon"):
        if not ctx.coupons:
            return "Hiện cửa hàng chưa có mã giảm giá nào, bạn quay lại sau nhé!", [], []
        return "🎁 Mã giảm giá đang áp dụng:\n" + "\n".join(f"- **{c.code}**: {c.description}" for c in ctx.coupons), [], []

    max_price = None
    if m := PRICE_RE.search(text):
        max_price = int(m.group(2)) * (1000 if m.group(3) or int(m.group(2)) < 10_000 else 1)
    keywords, has_criteria, scored = _score_products(ctx, text, has, max_price)

    # Ý định thêm vào giỏ: chọn sản phẩm khớp tên nhất
    if ADD_RE.search(text) and scored and scored[0][0] > 0:
        product = max(scored, key=lambda x: x[0])[2]
        qty = int(q.group(1)) if (q := QTY_RE.search(text)) else 1
        variant = next((v.label for v in product.variants if strip_accents(v.label) in text.split()), None)
        grind = next((g for g in GRIND_OPTIONS if strip_accents(g) in text), None)
        args = {"product_id": product.id, "quantity": qty, "variant": variant, "grind": grind}
        if product.is_drink:
            args |= _parse_drink_options(ctx, text, question)
        return "", [], [args]

    picks = [p for _, _, p in scored[:3]]
    if has("greet") and not keywords and not has_criteria:
        name = f" {ctx.user_name.split()[-1]}" if ctx.user_name else ""
        return (f"Chào bạn{name} 👋 Mình là Bean, trợ lý của Bean & Brew. Bạn thích cà phê đậm đà hay chua thanh, "
                "và ngân sách khoảng bao nhiêu để mình gợi ý nhé?"), [], []
    if not picks:
        return "Mình chưa tìm thấy sản phẩm phù hợp 😅 Bạn thử mô tả khẩu vị (đậm, nhẹ, chua thanh) hoặc ngân sách nhé!", [], []

    intro = "Chào bạn 👋 " if has("greet") else ""
    budget = f" trong tầm giá dưới {format_vnd(max_price)}" if max_price else ""
    body = "\n".join(f"- **{p.name}** – {format_vnd(p.price)}: {short(p.description)}" for p in picks)
    return (f"{intro}Mình gợi ý cho bạn{budget}:\n{body}\n\nBạn muốn mình thêm món nào vào giỏ không? "
            "_(Chế độ tư vấn offline)_"), picks, []


SUGAR_WORDS = {"khong duong": "0%", "it duong": "30%", "nhieu duong": "100%"}
ICE_WORDS = {"khong da": "Không đá", "it da": "Ít đá", "nhieu da": "Nhiều đá", "vua da": "Vừa đá", "nong": "Nóng"}


def _parse_drink_options(ctx: ChatContext, text: str, raw: str) -> dict:
    """'ít đá 50% đường thêm 2 trân châu' -> {"ice": "Ít đá", "sugar": "50%", "toppings": [...]}
    text: câu đã bỏ dấu (mất ký tự %), raw: câu gốc"""
    out: dict = {}
    m = re.search(r"(\d{1,3})\s*%", raw) or re.search(r"(\d{1,3})\s*(?:phan tram\s*)?duong", text)
    if m and f"{m.group(1)}%" in SUGAR_OPTIONS:
        out["sugar"] = f"{m.group(1)}%"
    elif sugar := next((v for k, v in SUGAR_WORDS.items() if k in text), None):
        out["sugar"] = sugar
    if ice := next((v for k, v in ICE_WORDS.items() if f" {k} " in text), None):
        out["ice"] = ice
    tops = []
    for t in ctx.toppings:
        name = strip_accents(t.name)
        if m := re.search(rf"(?:(\d)\s*(?:phan\s*)?)?{re.escape(name)}", text):
            tops.append({"name": t.name, "quantity": int(m.group(1) or 1)})
    if tops:
        out["toppings"] = tops
    return out


def find_mentioned(products: list[Product], reply: str) -> list[Product]:
    low = reply.lower()
    found = [p for p in products if p.name.lower() in low]
    found.sort(key=lambda p: low.index(p.name.lower()))
    return found[:4]


# ---------------- Generator sự kiện dùng chung ----------------
async def chat_events(ctx: ChatContext, messages: list[ChatMessage]) -> AsyncIterator[dict]:
    """Sinh chuỗi sự kiện: delta (text), action, products, done."""
    system = build_system_prompt(ctx)
    providers = []
    if settings.GEMINI_API_KEY:
        providers.append(("gemini", stream_gemini))
    if settings.OPENAI_API_KEY:
        providers.append(("openai", stream_openai))

    text, tool_calls, provider = "", [], "offline"
    for name, stream in providers:
        try:
            async for kind, value in stream(system, messages):
                if kind == "text":
                    text += value
                    yield {"type": "delta", "text": value}
                else:
                    tool_calls.append(value)
            provider = name
            break
        except Exception as exc:  # lỗi mạng / hết quota -> thử provider tiếp theo
            log.warning("Chat provider %s failed: %s", name, exc)
            if text:  # đã stream được một phần -> dừng ở đây thay vì lặp lại câu trả lời
                provider = name
                break

    offline_picks: list[Product] = []
    if provider == "offline":
        reply, offline_picks, tool_calls = offline_reply(ctx, messages[-1].content)
        for word in re.split(r"(\s+)", reply):  # giả lập hiệu ứng gõ chữ
            if word:
                text += word
                yield {"type": "delta", "text": word}
                await asyncio.sleep(0.012)

    # Thực thi tool calls sau khi đã kiểm tra hợp lệ
    added, problems = [], []
    for args in tool_calls:
        action, desc = resolve_add_to_cart(ctx, args)
        if action:
            added.append(desc)
            yield {"type": "action", "action": action.model_dump(mode="json")}
        else:
            problems.append(desc)
    follow = []
    if added:
        follow.append("🛒 Đã thêm " + ", ".join(added) + " vào giỏ hàng của bạn!")
    follow += problems
    if follow:
        extra = ("\n\n" if text.strip() else "") + "\n".join(follow)
        text += extra
        yield {"type": "delta", "text": extra}

    shown = offline_picks or find_mentioned(ctx.products, text)
    if shown:
        yield {"type": "products", "products": [ProductOut.model_validate(p).model_dump(mode="json") for p in shown]}
    yield {"type": "done", "provider": provider}


def load_context(db: Session, data: ChatIn, user: User | None) -> ChatContext:
    products = db.scalars(
        select(Product).options(joinedload(Product.category)).where(Product.is_active.is_(True))
    ).unique().all()
    coupons = db.scalars(select(Coupon).where(Coupon.is_active.is_(True))).all()
    by_id = {p.id: p for p in products}
    cart = [
        f"{line.quantity} × {by_id[line.product_id].name}"
        + "".join(f" · {x}" for x in [line.variant_label, line.grind] if x)
        for line in data.cart if line.product_id in by_id
    ]
    toppings = db.scalars(select(Topping).where(Topping.is_active.is_(True)).order_by(Topping.sort_order)).all()
    ctx = ChatContext(products=list(products), coupons=list(coupons), toppings=list(toppings),
                      user_name=user.full_name if user else None, cart_text="; ".join(cart) or "(trống)")
    # Nạp sẵn mọi thuộc tính cần dùng để generator không chạm DB sau khi session đóng
    for p in ctx.products:
        _ = p.variants, p.search_text, p.category
    return ctx


@router.post("/chat", response_model=ChatOut)
async def chat(data: ChatIn, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    ctx = load_context(db, data, user)
    reply, products, actions, provider = "", [], [], "offline"
    async for ev in chat_events(ctx, data.messages[-12:]):
        if ev["type"] == "delta":
            reply += ev["text"]
        elif ev["type"] == "action":
            actions.append(ev["action"])
        elif ev["type"] == "products":
            products = ev["products"]
        elif ev["type"] == "done":
            provider = ev["provider"]
    return ChatOut(reply=reply.strip(), products=products, actions=actions, provider=provider)


@router.post("/chat/stream")
async def chat_stream(data: ChatIn, db: Session = Depends(get_db), user: User | None = Depends(get_optional_user)):
    """Server-Sent Events: mỗi dòng `data: {json}`; frontend đọc bằng fetch + ReadableStream."""
    ctx = load_context(db, data, user)
    messages = data.messages[-12:]  # giới hạn lịch sử để tiết kiệm token

    async def sse():
        async for ev in chat_events(ctx, messages):
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
