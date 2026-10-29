"""Створити -480/-160 WEBP-варіанти для всіх фото категорій.

Навіщо: плитки моделей на головній (LCP) і іконки в шапці показуються шириною
~400 px / 56 px, тому 900-піксельний оригінал — це зайві десятки кілобайт на
кожну картку. Шаблон srcset (`<uuid>-480.webp 480w`) роздає сайт, тому файли
мають існувати.

Нові завантаження створюються автоматично (services/image_uploader.py →
make_width_variants), цей скрипт — для вже наявних файлів.

Запуск (всередині контейнера бекенду):
    docker compose exec -T backend python scripts/make_category_variants.py
"""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.image_uploader import CATEGORY_FOLDER, make_width_variants  # noqa: E402

FOLDER = Path("static/images") / CATEGORY_FOLDER


def main() -> int:
    if not FOLDER.is_dir():
        print(f"немає теки {FOLDER}")
        return 1
    originals = [
        p
        for p in sorted(FOLDER.glob("*.webp"))
        if not any(p.stem.endswith(f"-{w}") for w in (160, 480))
    ]
    created = 0
    for path in originals:
        created += len(make_width_variants(path))
    print(f"категорій: {len(originals)}, створено варіантів: {created}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
