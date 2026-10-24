"""Другий варіант артикула Tesla: 161086600A <-> 1610866-00-A.

У базі нічого не змінюється — варіант будується з поля при показі.
Та сама логіка — у tesla-parts-shop/utils/partNumbers.ts.
"""
import re
from typing import List, Optional, Tuple

_PLAIN = re.compile(r"^(\d{7})([A-Z0-9]{2})([A-Z])$")
_HYPHEN = re.compile(r"^(\d{7})-([A-Z0-9]{2})-([A-Z])$")


def alternate(number: str) -> Optional[str]:
    number = number.strip()
    m = _PLAIN.match(number)
    if m:
        return "-".join(m.groups())
    m = _HYPHEN.match(number)
    if m:
        return "".join(m.groups())
    return None


def split_numbers(value: Optional[str]) -> List[str]:
    if not value or value.strip().lower() == "null":
        return []
    return [n.strip() for n in value.split(",") if n.strip()]


def pairs(value: Optional[str]) -> List[Tuple[str, Optional[str]]]:
    return [(n, alternate(n)) for n in split_numbers(value)]


def display(value: Optional[str]) -> str:
    # "161086600A / 1610866-00-A, 5163001"
    return ", ".join(f"{n} / {alt}" if alt else n for n, alt in pairs(value))


def alternates(*values: Optional[str]) -> List[str]:
    out = []
    for value in values:
        for _, alt in pairs(value):
            if alt and alt not in out:
                out.append(alt)
    return out


def hyphenated(value: Optional[str]) -> Optional[str]:
    # перший номер Tesla з поля у форматі з дефісами — для mpn у розмітці
    for n, alt in pairs(value):
        if alt:
            return alt if "-" in alt else n
    return None


def with_alternates(text: str, detail_number: Optional[str], cross_number: Optional[str]) -> str:
    alts = alternates(detail_number, cross_number)
    return f"{text} {', '.join(alts)}" if alts else text


def feed_title(name: str, detail_number: Optional[str], limit: int = 150) -> str:
    alts = alternates(detail_number)
    if not alts:
        return name[:limit]
    first = split_numbers(detail_number)[0] if split_numbers(detail_number) else ""
    if first and name.lower().startswith(first.lower()):
        title = f"{name[:len(first)]} {' '.join(alts)}{name[len(first):]}"
    else:
        title = f"{name} {' '.join(alts)}"
    return title[:limit].rstrip()
