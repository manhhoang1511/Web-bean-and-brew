"""Pub/sub trong bộ nhớ để đẩy sự kiện realtime (VD: đơn hàng mới) tới trang admin qua SSE.

Router tạo đơn chạy trong threadpool (hàm sync) nên publish phải chuyển sự kiện về event loop
bằng call_soon_threadsafe. Đủ dùng cho 1 tiến trình; chạy nhiều tiến trình thì thay bằng Redis pub/sub.
"""
import asyncio
import threading


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[tuple[asyncio.AbstractEventLoop, asyncio.Queue]] = set()
        self._lock = threading.Lock()

    def subscribe(self) -> tuple[asyncio.AbstractEventLoop, asyncio.Queue]:
        sub = (asyncio.get_running_loop(), asyncio.Queue(maxsize=100))
        with self._lock:
            self._subscribers.add(sub)
        return sub

    def unsubscribe(self, sub) -> None:
        with self._lock:
            self._subscribers.discard(sub)

    def publish(self, event: dict) -> None:
        """Gọi được từ cả thread thường lẫn event loop."""
        with self._lock:
            subs = list(self._subscribers)
        for loop, queue in subs:
            try:
                loop.call_soon_threadsafe(queue.put_nowait, event)
            except (RuntimeError, asyncio.QueueFull):
                pass  # loop đã đóng hoặc client đọc quá chậm -> bỏ qua


broker = EventBroker()
