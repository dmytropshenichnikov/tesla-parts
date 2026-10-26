"""Людиночитані URL товарів.

Задача: замінити `/product/prod-2147187f` на стабільний slug з назви товару
(транслітерація української/російської) + артикул, наприклад:

    /product/obmezhuvach-perednoi-dverky-lh-tesla-model-3-highland-original-108950700d

Slug генерується один раз (при створенні товару або бекфілі БД) і надалі не
залежить від редагування назви — щоб не ламати індексацію та зовнішні посилання.
"""
import re
from typing import Iterable, Optional

# Українська + російська транслітерація (спрощена, стабільна).
_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e",
    "є": "ie", "ж": "zh", "з": "z", "и": "y", "і": "i", "ї": "i", "й": "i",
    "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch",
    "ш": "sh", "щ": "shch", "ь": "", "ю": "iu", "я": "ia",
    "ы": "y", "э": "e", "ё": "e", "ъ": "",
    # латинські діакритики, які трапляються в назвах
    "ü": "u", "ö": "o", "ä": "a", "é": "e", "è": "e", "ê": "e", "á": "a",
    "à": "a", "ç": "c", "ñ": "n", "ł": "l", "ś": "s", "ż": "z", "ź": "z",
    "ć": "c", "ń": "n", "ó": "o", "ą": "a", "ę": "e",
}

_MAX_BASE = 90
_FALLBACK_ID = re.compile(r"[^a-z0-9]+")


def clean_title(name: Optional[str], detail_number: Optional[str] = None) -> str:
    """Прибирає артикул на початку назви (як cleanTitle у магазині)."""
    value = (name or "").strip()
    number = (detail_number or "").strip()
    if number and value.lower().startswith(number.lower()):
        value = re.sub(r"^[\s\-–—:]+", "", value[len(number):])
    return value.strip() or (name or "").strip()


def transliterate(value: Optional[str]) -> str:
    if not value:
        return ""
    out = []
    for char in value.lower():
        if char in _TRANSLIT:
            out.append(_TRANSLIT[char])
        elif char.isascii() and (char.isalnum() or char in "-_"):
            out.append(char)
        else:
            out.append(" ")
    return "".join(out)


def _words(value: Optional[str]) -> str:
    text = transliterate(value).replace("_", " ")
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def number_slug(detail_number: Optional[str]) -> str:
    """`1044331-00-C` -> `1044331-00-c`, `108950700D` -> `108950700d`."""
    return _words(detail_number)


def _short_id(product_id: Optional[str]) -> str:
    raw = (product_id or "").lower()
    if raw.startswith("prod-"):
        raw = raw[5:]
    return _FALLBACK_ID.sub("", raw)[:8]


def build_slug(
    name: Optional[str],
    detail_number: Optional[str],
    product_id: Optional[str],
    taken: Optional[Iterable[str]] = None,
) -> str:
    """Повертає унікальний slug для товару.

    `taken` — уже зайняті slug-и (для бекфілу пачкою). Для створення одного
    товару можна не передавати: тоді унікальність забезпечує хеш id.
    """
    taken_set = {s for s in (taken or ()) if s}
    title = clean_title(name, detail_number)
    base = _words(title)
    number = number_slug(detail_number)

    if number and number not in base:
        base = f"{base}-{number}" if base else number

    if len(base) > _MAX_BASE:
        base = base[:_MAX_BASE].rsplit("-", 1)[0].strip("-") or base[:_MAX_BASE]

    if not base:
        short = _short_id(product_id)
        base = f"product-{short}" if short else "product"

    if base not in taken_set:
        return base

    suffix = _short_id(product_id) or "copy"
    candidate = f"{base}-{suffix}"
    counter = 2
    while candidate in taken_set:
        candidate = f"{base}-{suffix}-{counter}"
        counter += 1
    return candidate
