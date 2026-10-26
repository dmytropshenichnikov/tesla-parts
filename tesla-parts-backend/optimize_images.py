"""Одноразова оптимізація зображень статики (WebP ≤ max-side).

Проблема: у `static/images/tesla-parts` лежать оригінали до 4000×4000 / 6.9 МБ
(усього ~900 МБ). На сайті вони показуються у картці 300–480 px, на мобільному
Slow 4G це катастрофа для LCP і трафіку.

Що робить скрипт:
  1. бере файли більші за `--min-bytes` АБО більші за `--max-side` по стороні;
  2. зменшує до `--max-side` і перепаковує в WebP поруч з оригіналом
     (`<uuid>.webp`); ОРИГІНАЛ НЕ ВИДАЛЯЄТЬСЯ (кнопка «показати оригінал»
     і відкат залишаються можливими);
  3. з `--update-db` у всіх текстових колонках усіх таблиць мінить
     старі імена на нові, щоб product.image / галерея / категорії / відгуки
     / схеми / HTML-сторінки посилалися вже на стиснутий файл.

Запуск (у контейнері бекенду, де є Pillow та DATABASE_URL):
    python optimize_images.py                 # dry-run: лише підсумок
    python optimize_images.py --apply         # генерує .webp
    python optimize_images.py --apply --update-db
    python optimize_images.py --verify        # чи не лишилось старих посилань
"""
import argparse
import os
import sys
from pathlib import Path

from PIL import Image
from sqlalchemy import inspect, text
from sqlalchemy.types import String, Text

Image.MAX_IMAGE_PIXELS = 200_000_000

BASE = Path(__file__).resolve().parent / "static" / "images" / "tesla-parts"
# схеми (креслення EPC) люди часто збільшують — їм більший запас
FOLDERS = {
    "products": 1600,
    "subcategories": 1600,
    "categories": 1600,
    "reviews": 1600,
    "schematics": 2400,
}
SKIP_SUFFIXES = {".avif", ".heic", ".gif", ".svg", ".ico"}


def optimize(args):
    """Повний прохід по файлах. У dry-run те саме, але з тимчасовим файлом:
    рахуємо реальний розмір WebP і видаляємо, нічого не залишаючи."""
    apply = args.apply
    pairs = []  # (стара назва, нова назва)
    before = after = 0
    made = skipped = failed = 0

    for folder, default_side in FOLDERS.items():
        root = BASE / folder
        if not root.is_dir():
            continue
        max_side = args.max_side or default_side
        for path in sorted(root.iterdir()):
            if not path.is_file():
                continue
            suffix = path.suffix.lower()
            if suffix in SKIP_SUFFIXES:
                continue

            try:
                im = Image.open(path)
                im.load()
            except Exception as exc:  # noqa: BLE001 — биті/непідтримувані файли просто пропускаємо
                print(f"  ! не вдалося прочитати {path.relative_to(BASE)}: {exc}")
                failed += 1
                continue

            orig_bytes = path.stat().st_size
            too_big = orig_bytes > args.min_bytes
            too_wide = max(im.size) > max_side
            if suffix == ".webp":
                # вже WebP: якщо завеликий — перепаковуємо на місці (БД не чіпаємо)
                if not (too_big or too_wide):
                    skipped += 1
                    continue
                target = path
            else:
                if not (too_big or too_wide):
                    skipped += 1
                    continue
                target = path.with_suffix(".webp")
                if target != path and target.exists():
                    skipped += 1
                    continue

            before += orig_bytes
            work = im
            if too_wide:
                work = im.copy()
                work.thumbnail((max_side, max_side), Image.LANCZOS)
            if work.mode not in ("RGB", "RGBA"):
                work = work.convert("RGBA" if "A" in work.getbands() else "RGB")

            tmp = target.with_suffix(target.suffix + ".tmp")
            try:
                work.save(tmp, format="WEBP", quality=args.quality, method=4)
            except Exception as exc:  # noqa: BLE001
                print(f"  ! не вдалося записати {target.name}: {exc}")
                failed += 1
                tmp.unlink(missing_ok=True)
                continue

            new_bytes = tmp.stat().st_size
            # якщо виграш незначний (наприклад, дуже маленький файл) — кидаємо
            if target != path and new_bytes >= orig_bytes * 0.95:
                tmp.unlink(missing_ok=True)
                skipped += 1
                before -= orig_bytes
                continue

            after += new_bytes
            if apply:
                tmp.replace(target)
            else:
                tmp.unlink(missing_ok=True)
            made += 1
            if target != path:
                pairs.append((path.name, target.name))
            print(
                f"  {path.relative_to(BASE)}: {orig_bytes // 1024}KB "
                f"{im.size[0]}x{im.size[1]} -> {new_bytes // 1024}KB "
                f"{work.size[0]}x{work.size[1]} ({target.name})"
            )

    label = "Створено/перепаковано" if apply else "Було б створено (dry-run)"
    print(
        f"\n{label}: {made}, пропущено: {skipped}, "
        f"помилок: {failed}, пар для БД: {len(pairs)}"
    )
    if before:
        print(f"Байти до/після: {before // (1024 * 1024)}МБ -> {after // (1024 * 1024)}МБ")
    return pairs


def _string_columns(engine):
    insp = inspect(engine)
    out = []
    for table in insp.get_table_names():
        for col in insp.get_columns(table):
            if isinstance(col["type"], (String, Text)) or str(col["type"]).upper().startswith(
                ("VARCHAR", "TEXT", "CHAR")
            ):
                out.append((table, col["name"]))
    return out


def update_db(engine, pairs, verify_only=False):
    """Замінює старі назви файлів на нові в УСІХ текстових колонках усіх таблиць."""
    if not pairs:
        print("Немає пар для оновлення.")
        return 0

    remaining = 0
    with engine.begin() as conn:
        for table, col in _string_columns(engine):
            where = " OR ".join(f"{col} LIKE :p{i}" for i in range(len(pairs)))
            params = {f"p{i}": f"%{old}%" for i, (old, _) in enumerate(pairs)}
            try:
                hit = conn.execute(
                    text(f'SELECT 1 FROM "{table}" WHERE {where} LIMIT 1'), params
                ).first()
            except Exception as exc:  # noqa: BLE001
                print(f"  ! {table}.{col}: {exc}")
                continue
            if not hit:
                continue

            if verify_only:
                n = conn.execute(
                    text(f'SELECT COUNT(*) FROM "{table}" WHERE {where}'), params
                ).scalar()
                if n:
                    print(f"  {table}.{col}: {n} рядків ще зі старими іменами")
                    remaining += n
                continue

            # заміна партіями по 40: глибокий вкладений replace() в іншому
            # випадку робить один велетенський вираз
            for start in range(0, len(pairs), 40):
                chunk = pairs[start:start + 40]
                expr = col
                upd = {}
                for i, (old, new) in enumerate(chunk):
                    expr = f'replace({expr}, :o{i}, :n{i})'
                    upd[f"o{i}"] = old
                    upd[f"n{i}"] = new
                w = " OR ".join(f"{col} LIKE :q{i}" for i in range(len(chunk)))
                upd.update({f"q{i}": f"%{old}%" for i, (old, _) in enumerate(chunk)})
                conn.execute(
                    text(f'UPDATE "{table}" SET "{col}" = {expr} WHERE {w}'), upd
                )
            print(f"  оновлено {table}.{col}")
    return remaining


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="створювати .webp (без цього — dry-run)")
    parser.add_argument("--update-db", action="store_true", help="замінити посилання в БД (потребує --apply)")
    parser.add_argument("--verify", action="store_true", help="лише перевірити, чи не лишилось старих посилань")
    parser.add_argument("--max-side", type=int, default=None, help="перевизначити макс. сторону")
    parser.add_argument("--quality", type=int, default=82)
    parser.add_argument("--min-bytes", type=int, default=150 * 1024, help="менші файли не чіпаємо")
    args = parser.parse_args()

    if not BASE.is_dir():
        sys.exit(f"Не знайдено {BASE}")

    from database import engine  # noqa: WPS433 — після аргументів, бо тягне налаштування

    if args.verify:
        pairs = [(p.name, p.with_suffix(".webp").name) for p in BASE.rglob("*") if p.is_file() and p.suffix.lower() != ".webp" and (p.with_suffix(".webp")).exists()]
        left = update_db(engine, pairs, verify_only=True)
        print(f"Залишилось старих посилань: {left}")
        return

    if not args.apply:
        print("DRY-RUN: файли не пишуться (тимчасові рахуються і видаляються).\n")

    pairs = optimize(args)
    if args.update_db:
        if not args.apply:
            sys.exit("--update-db потребує --apply (спочатку генеруємо файли)")
        print("\nОновлюємо посилання в БД...")
        update_db(engine, pairs)
        print("Перевірка...")
        update_db(engine, pairs, verify_only=True)
        print("Готово.")


if __name__ == "__main__":
    main()
