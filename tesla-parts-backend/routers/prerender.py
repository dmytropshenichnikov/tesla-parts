import os
import time
from collections import OrderedDict
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlmodel import Session

from database import get_session
from services import seo_render

router = APIRouter(tags=["prerender"])

# HTML сторінки залежить лише від БД, а зміни в адмінці не потребують
# миттєвої видимості. Кеш на кілька секунд прибирає з TTFB запити до БД і
# тримати сторінку в теплому стані для LCP.
CACHE_TTL = float(os.getenv("PRERENDER_CACHE_TTL", "30"))
CACHE_MAX = int(os.getenv("PRERENDER_CACHE_MAX", "300"))
_cache: "OrderedDict[str, tuple[float, int, str]]" = OrderedDict()


def _cache_get(key: str):
    hit = _cache.get(key)
    if not hit:
        return None
    expires_at, status_code, html = hit
    if expires_at < time.monotonic():
        _cache.pop(key, None)
        return None
    _cache.move_to_end(key)
    return status_code, html


def _cache_set(key: str, status_code: int, html: str) -> None:
    _cache[key] = (time.monotonic() + CACHE_TTL, status_code, html)
    _cache.move_to_end(key)
    while len(_cache) > CACHE_MAX:
        _cache.popitem(last=False)


@router.get("/prerender/{path:path}", response_class=HTMLResponse, include_in_schema=False)
def prerender_page(path: str, session: Session = Depends(get_session)):
    cached = _cache_get(path)
    if cached:
        status_code, html = cached
        return HTMLResponse(html, status_code=status_code)

    try:
        index_html = seo_render.load_index_html()
    except Exception:
        # 502 -> шлюз віддасть звичайний index.html магазину
        raise HTTPException(status_code=502, detail="shop index unavailable")

    seo = seo_render.resolve(session, path)
    if seo:
        page = seo_render.render(index_html, seo)
        _cache_set(path, 200, page)
        return HTMLResponse(page)

    target = seo_render.legacy_redirect(session, path)
    if target:
        return RedirectResponse(quote(target), status_code=301)

    # сторінки немає: React покаже свій екран, Google отримає 404
    page = seo_render.render(index_html, seo_render.PageSeo(canonical=""))
    _cache_set(path, 404, page)
    return HTMLResponse(page, status_code=404)
