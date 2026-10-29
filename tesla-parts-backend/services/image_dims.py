"""Розміри зображення за його URL (для width/height у розмітці).

Навіщо: схема позиціонує точки у відсотках від КОНТЕЙНЕРА. Якщо контейнер
вищий за саму картинку (наприклад, через min-height), усі точки з'їжджають.
Тому фронт має знати реальні пропорції ще до завантаження файлу.
"""
import os
from functools import lru_cache
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

STATIC_ROOT = Path("static")


def _local_path(url: str) -> Optional[Path]:
    if not url:
        return None
    path = urlparse(url).path if url.startswith("http") else url
    marker = "/static/"
    idx = path.find(marker)
    if idx < 0:
        return None
    return STATIC_ROOT / path[idx + len(marker):]


@lru_cache(maxsize=2048)
def image_size(url: str) -> Optional[tuple[int, int]]:
    local = _local_path(url)
    if not local or not local.exists():
        return None
    try:
        from PIL import Image

        with Image.open(local) as im:
            return im.size
    except Exception:  # noqa: BLE001 — розміри не мають ламати відповідь API
        return None
