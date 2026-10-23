from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlmodel import Session

from database import get_session
from services import seo_render

router = APIRouter(tags=["prerender"])


@router.get("/prerender/{path:path}", response_class=HTMLResponse, include_in_schema=False)
def prerender_page(path: str, session: Session = Depends(get_session)):
    try:
        index_html = seo_render.load_index_html()
    except Exception:
        # 502 -> шлюз віддасть звичайний index.html магазину
        raise HTTPException(status_code=502, detail="shop index unavailable")
    seo = seo_render.resolve(session, path) or seo_render.PageSeo()
    return HTMLResponse(seo_render.render(index_html, seo))
