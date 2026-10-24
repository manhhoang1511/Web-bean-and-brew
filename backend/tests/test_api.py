"""Kiểm thử API end-to-end trên CSDL SQLite tạm.  Chạy:  pytest -q"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Category, Coupon, Product, User
from app.security import hash_password
from app.services import build_search_text

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSession()
    cat = Category(name="Cà phê hạt", slug="ca-phe-hat")
    db.add_all([
        User(email="admin@test.vn", full_name="Admin", role="admin", hashed_password=hash_password("admin123")),
        cat,
        Coupon(code="WELCOME10", description="10%", discount_percent=10, max_discount=50000, min_order=0),
    ])
    for name, price, stock in [("Arabica Cầu Đất", 200000, 10), ("Robusta Đậm", 100000, 2), ("Phin Nhôm", 35000, 0)]:
        p = Product(name=name, slug=name.lower().replace(" ", "-"), price=price, stock=stock, category=cat,
                    description="Cà phê thơm ngon")
        p.search_text = build_search_text(p)
        db.add(p)
    db.commit()
    db.close()
    yield


client = TestClient(app)


def register(email="khach@test.vn"):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Khách", "password": "123456"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def admin_headers():
    r = client.post("/api/auth/login", json={"email": "admin@test.vn", "password": "admin123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def order_payload(**kw):
    return {"items": [{"product_id": 1, "quantity": 2}], "shipping_name": "Khách", "shipping_phone": "0901234567",
            "shipping_address": "123 Lê Lợi, Q1", "payment_method": "cod", **kw}


def test_register_login_and_duplicate():
    register()
    assert client.post("/api/auth/register",
                       json={"email": "khach@test.vn", "full_name": "Khách 2", "password": "123456"}).status_code == 409
    assert client.post("/api/auth/login", json={"email": "khach@test.vn", "password": "sai"}).status_code == 401


def test_categories_with_product_count():
    r = client.get("/api/categories")
    assert r.status_code == 200 and r.json()[0]["product_count"] == 3


def test_search_is_accent_insensitive_and_filters():
    r = client.get("/api/products", params={"q": "cau dat"}).json()
    assert [p["name"] for p in r["items"]] == ["Arabica Cầu Đất"]
    r = client.get("/api/products", params={"min_price": 50000, "max_price": 150000}).json()
    assert [p["name"] for p in r["items"]] == ["Robusta Đậm"]
    r = client.get("/api/products", params={"in_stock": True, "sort": "price_asc"}).json()
    assert [p["price"] for p in r["items"]] == [100000, 200000]


def test_order_flow_prices_from_server_and_stock():
    h = register()
    r = client.post("/api/orders", json=order_payload(coupon_code="welcome10"), headers=h)
    assert r.status_code == 201, r.text
    o = r.json()
    assert o["subtotal"] == 400000 and o["discount"] == 40000 and o["shipping_fee"] == 30000
    assert o["total"] == 390000 and o["status"] == "pending"
    assert client.get("/api/products/1").json()["stock"] == 8

    # Hủy đơn -> hoàn kho
    assert client.post(f"/api/orders/{o['code']}/cancel", headers=h).json()["status"] == "cancelled"
    assert client.get("/api/products/1").json()["stock"] == 10


def test_cannot_oversell_or_buy_out_of_stock():
    h = register()
    r = client.post("/api/orders", json=order_payload(items=[{"product_id": 2, "quantity": 3}]), headers=h)
    assert r.status_code == 400 and "chỉ còn 2" in r.json()["detail"]


def test_mock_card_payment():
    h = register()
    ok = client.post("/api/orders", json=order_payload(payment_method="card", card_number="4242 4242 4242 4242"),
                     headers=h)
    assert ok.status_code == 201 and ok.json()["payment_status"] == "paid"
    declined = client.post("/api/orders", json=order_payload(payment_method="card", card_number="4000000000000002"),
                           headers=h)
    assert declined.status_code == 402


def test_admin_permissions_and_status_flow():
    h = register()
    assert client.get("/api/admin/stats", headers=h).status_code == 403
    code = client.post("/api/orders", json=order_payload(), headers=h).json()["code"]
    ah = admin_headers()
    order = client.get("/api/admin/orders", headers=ah).json()["items"][0]
    assert order["code"] == code
    bad = client.patch(f"/api/admin/orders/{order['id']}/status", json={"status": "completed"}, headers=ah)
    assert bad.status_code == 400  # không nhảy cóc pending -> completed
    for s in ("shipping", "completed"):
        r = client.patch(f"/api/admin/orders/{order['id']}/status", json={"status": s}, headers=ah)
        assert r.status_code == 200
    assert r.json()["payment_status"] == "paid"
    stats = client.get("/api/admin/stats", headers=ah).json()
    assert stats["total_revenue"] == 430000 and stats["total_customers"] == 1


def test_admin_product_crud():
    ah = admin_headers()
    r = client.post("/api/admin/products", json={"name": "Cold Brew", "price": 45000, "stock": 5, "category_id": 1},
                    headers=ah)
    assert r.status_code == 201 and r.json()["slug"] == "cold-brew"
    pid = r.json()["id"]
    assert client.patch(f"/api/admin/products/{pid}", json={"stock": 0}, headers=ah).json()["in_stock"] is False
    assert client.delete(f"/api/admin/products/{pid}", headers=ah).status_code == 204
    assert client.get(f"/api/products/{pid}").status_code == 404


def complete_order(h, **kw):
    """Đặt đơn rồi admin giao + hoàn thành."""
    order = client.post("/api/orders", json=order_payload(**kw), headers=h).json()
    ah = admin_headers()
    for s in ("shipping", "completed"):
        client.patch(f"/api/admin/orders/{order['id']}/status", json={"status": s}, headers=ah)
    return order


def test_only_buyers_can_review():
    h = register()
    r = client.post("/api/products/1/reviews", json={"rating": 5, "comment": "Ảo"}, headers=h)
    assert r.status_code == 403
    assert client.get("/api/products/1/review-eligibility", headers=h).json() == {"can_review": False}
    complete_order(h)
    assert client.get("/api/products/1/review-eligibility", headers=h).json() == {"can_review": True}


def test_qr_payment_must_be_confirmed_before_shipping():
    h = register()
    order = client.post("/api/orders", json=order_payload(payment_method="qr"), headers=h).json()
    assert order["payment_status"] == "unpaid"
    ah = admin_headers()
    r = client.patch(f"/api/admin/orders/{order['id']}/status", json={"status": "shipping"}, headers=ah)
    assert r.status_code == 400
    assert client.post(f"/api/orders/{order['code']}/pay", headers=h).json()["payment_status"] == "paid"
    r = client.patch(f"/api/admin/orders/{order['id']}/status", json={"status": "shipping"}, headers=ah)
    assert r.status_code == 200


def test_review_updates_rating():
    h = register()
    complete_order(h)
    client.post("/api/products/1/reviews", json={"rating": 4, "comment": "Ngon"}, headers=h)
    client.post("/api/products/1/reviews", json={"rating": 2, "comment": "Đổi ý"}, headers=h)  # cập nhật, không tạo mới
    p = client.get("/api/products/1").json()
    assert p["rating_count"] == 1 and p["rating_avg"] == 2


def create_variant_product():
    ah = admin_headers()
    r = client.post("/api/admin/products", headers=ah, json={
        "name": "Arabica Biến Thể", "price": 1, "category_id": 1, "has_grind_option": True,
        "variants": [{"label": "250g", "price": 100000, "stock": 5}, {"label": "1kg", "price": 350000, "stock": 1}],
    })
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["price"] == 100000 and p["stock"] == 6  # giá "từ" thấp nhất, tồn kho = tổng
    return p


def test_variant_order_uses_variant_price_and_stock():
    p = create_variant_product()
    v250, v1kg = p["variants"]
    h = register()
    base = order_payload()
    # Thiếu variant_id -> lỗi
    r = client.post("/api/orders", headers=h, json={**base, "items": [{"product_id": p["id"], "quantity": 1}]})
    assert r.status_code == 400
    # Kiểu xay không hợp lệ -> lỗi
    r = client.post("/api/orders", headers=h, json={**base, "items": [
        {"product_id": p["id"], "variant_id": v250["id"], "grind": "Xay bừa", "quantity": 1}]})
    assert r.status_code == 400
    # Vượt tồn kho biến thể 1kg
    r = client.post("/api/orders", headers=h, json={**base, "items": [
        {"product_id": p["id"], "variant_id": v1kg["id"], "quantity": 2}]})
    assert r.status_code == 400
    r = client.post("/api/orders", headers=h, json={**base, "items": [
        {"product_id": p["id"], "variant_id": v1kg["id"], "grind": "Xay phin", "quantity": 1}]})
    assert r.status_code == 201, r.text
    item = r.json()["items"][0]
    assert item["unit_price"] == 350000 and item["variant_label"] == "1kg · Xay phin"
    fresh = client.get(f"/api/products/{p['id']}").json()
    assert fresh["stock"] == 5 and [v["stock"] for v in fresh["variants"]] == [5, 0]
    # Hủy -> hoàn kho đúng biến thể
    client.post(f"/api/orders/{r.json()['code']}/cancel", headers=h)
    assert [v["stock"] for v in client.get(f"/api/products/{p['id']}").json()["variants"]] == [5, 1]


def create_drink():
    """Tạo 1 đồ uống size S/M + 2 topping qua API admin."""
    ah = admin_headers()
    t1 = client.post("/api/admin/toppings", headers=ah, json={"name": "Trân châu đen", "price": 8000}).json()
    t2 = client.post("/api/admin/toppings", headers=ah, json={"name": "Kem cheese", "price": 12000}).json()
    d = client.post("/api/admin/products", headers=ah, json={
        "name": "Bạc Xỉu", "price": 1, "category_id": 1, "is_drink": True, "allow_toppings": True,
        "variants": [{"label": "S", "price": 30000, "stock": 50}, {"label": "M", "price": 36000, "stock": 50}],
    }).json()
    return d, t1, t2


def test_drink_options_priced_by_server():
    d, t1, t2 = create_drink()
    h = register()
    size_m = d["variants"][1]["id"]
    line = {"product_id": d["id"], "variant_id": size_m, "sugar": "50%", "ice": "Ít đá", "quantity": 2,
            "toppings": [{"topping_id": t1["id"], "quantity": 2}, {"topping_id": t2["id"], "quantity": 1}]}
    r = client.post("/api/orders", headers=h, json={**order_payload(), "items": [line]})
    assert r.status_code == 201, r.text
    item = r.json()["items"][0]
    # (36.000 + 2×8.000 + 12.000) × 2 ly
    assert item["unit_price"] == 64000 and item["line_total"] == 128000
    assert item["variant_label"] == "M · Ít đá · 50% đường · +2 Trân châu đen · +1 Kem cheese"
    assert item["options"]["toppings"][0] == {"id": t1["id"], "name": "Trân châu đen", "price": 8000, "quantity": 2}
    # Không chọn đá/đường -> mặc định
    r = client.post("/api/orders", headers=h, json={**order_payload(), "items": [
        {"product_id": d["id"], "variant_id": size_m, "quantity": 1}]})
    assert r.json()["items"][0]["variant_label"] == "M · Vừa đá · 100% đường"


def test_drink_options_validation():
    d, t1, _ = create_drink()
    h = register()
    v = d["variants"][0]["id"]
    bad_lines = [
        {"product_id": d["id"], "variant_id": v, "sugar": "42%", "quantity": 1},                       # mức đường lạ
        {"product_id": d["id"], "variant_id": v, "toppings": [{"topping_id": 999, "quantity": 1}], "quantity": 1},
        {"product_id": d["id"], "variant_id": v, "quantity": 1, "toppings": [                           # quá 5 phần
            {"topping_id": t1["id"], "quantity": 3}, {"topping_id": t1["id"] + 1, "quantity": 3}]},
        {"product_id": 1, "sugar": "50%", "quantity": 1},                                              # hạt cà phê không có đường
        {"product_id": 1, "toppings": [{"topping_id": t1["id"], "quantity": 1}], "quantity": 1},       # không cho topping
    ]
    for line in bad_lines:
        r = client.post("/api/orders", headers=h, json={**order_payload(), "items": [line]})
        assert r.status_code == 400, (line, r.text)
    meta = client.get("/api/meta").json()
    assert "Ít đá" in meta["ice_options"] and len(meta["toppings"]) == 2


def test_chat_offline_understands_drink_options(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    d, t1, _ = create_drink()
    r = client.post("/api/chat", json={"messages": [
        {"role": "user", "content": "thêm 2 ly bạc xỉu size M ít đá 50% đường thêm trân châu đen vào giỏ"}]}).json()
    assert len(r["actions"]) == 1, r
    a = r["actions"][0]
    assert a["quantity"] == 2 and a["ice"] == "Ít đá" and a["sugar"] == "50%"
    assert a["variant_id"] == d["variants"][1]["id"] and a["toppings"] == [{"topping_id": t1["id"], "quantity": 1}]


def test_wishlist():
    h = register()
    assert client.post("/api/wishlist/1", headers=h).status_code == 204
    client.post("/api/wishlist/1", headers=h)  # thêm lần 2 không bị trùng
    assert client.get("/api/wishlist/ids", headers=h).json() == [1]
    assert client.get("/api/wishlist", headers=h).json()[0]["id"] == 1
    client.delete("/api/wishlist/1", headers=h)
    assert client.get("/api/wishlist/ids", headers=h).json() == []


def test_forgot_and_reset_password_single_use():
    register()
    r = client.post("/api/auth/forgot-password", json={"email": "khach@test.vn"}).json()
    token = r["demo_reset_url"].split("token=")[1]
    # Email không tồn tại vẫn trả cùng thông báo, không lộ link
    assert "demo_reset_url" not in client.post("/api/auth/forgot-password", json={"email": "nobody@test.vn"}).json()
    # Token đặt lại không dùng thay access token được
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "moi123"}).status_code == 204
    assert client.post("/api/auth/login", json={"email": "khach@test.vn", "password": "moi123"}).status_code == 200
    # Dùng lại lần 2 -> bị từ chối
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "khac123"}).status_code == 400


def test_export_orders_csv():
    h = register()
    client.post("/api/orders", json=order_payload(), headers=h)
    r = client.get("/api/admin/orders/export", headers=admin_headers())
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    text = r.content.decode("utf-8-sig")
    assert text.startswith("Mã đơn") and "Arabica Cầu Đất x2" in text and "Đang xử lý" in text


def test_chat_offline_fallback(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "Mình muốn cà phê đậm dưới 150k"}]})
    body = r.json()
    assert r.status_code == 200 and body["provider"] == "offline"
    assert [p["name"] for p in body["products"]] == ["Robusta Đậm"]


def test_chat_add_to_cart_by_voice_is_validated(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    # Xin 5 cái nhưng kho chỉ còn 2 -> server tự giới hạn
    r = client.post("/api/chat", json={"messages": [{"role": "user", "content": "thêm 5 gói robusta đậm vào giỏ"}]}).json()
    assert len(r["actions"]) == 1
    assert r["actions"][0]["product"]["name"] == "Robusta Đậm" and r["actions"][0]["quantity"] == 2
    assert "Đã thêm" in r["reply"]


def test_chat_resolve_requires_variant():
    from app.routers.chat import ChatContext, resolve_add_to_cart
    from app.models import ProductVariant
    from datetime import datetime
    p = Product(id=99, name="Arabica", slug="a", price=1, stock=3, has_grind_option=True, is_drink=False,
                allow_toppings=False, description="",
                image_url="", images="", is_featured=False, is_active=True, sold_count=0, rating_avg=0,
                rating_count=0, created_at=datetime.now(),
                variants=[ProductVariant(id=1, label="250g", price=100, stock=3)])
    ctx = ChatContext(products=[p], coupons=[], user_name=None, cart_text="")
    action, msg = resolve_add_to_cart(ctx, {"product_id": 99, "quantity": 1})
    assert action is None and "250g" in msg  # hỏi lại phân loại
    action, _ = resolve_add_to_cart(ctx, {"product_id": 99, "quantity": 1, "variant": "250G", "grind": "Xay bừa"})
    assert action.variant_id == 1 and action.grind == "Nguyên hạt"


def test_chat_stream_sse(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    with client.stream("POST", "/api/chat/stream", json={"messages": [{"role": "user", "content": "xin chào"}]}) as r:
        assert r.headers["content-type"].startswith("text/event-stream")
        import json as _json
        events = [_json.loads(line[5:]) for line in r.iter_lines() if line.startswith("data:")]
    assert events[-1] == {"type": "done", "provider": "offline"}
    assert "".join(e["text"] for e in events if e["type"] == "delta").startswith("Chào bạn")
