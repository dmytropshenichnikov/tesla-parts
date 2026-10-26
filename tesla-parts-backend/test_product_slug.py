from services.product_slug import build_slug, clean_title, transliterate


def test_transliterates_ukrainian_and_russian():
    assert transliterate("Обмежувач передньої дверки") == "obmezhuvach perednoi dverky"
    assert transliterate("Піввісь задня") == "pivvis zadnia"
    assert transliterate("Ёлка") == "elka"


def test_cleans_part_number_prefix():
    assert clean_title("108950700D - Обмежувач дверки", "108950700D") == "Обмежувач дверки"
    assert clean_title("Обмежувач дверки", "108950700D") == "Обмежувач дверки"


def test_build_slug_uses_name_and_detail_number():
    slug = build_slug(
        "108950700D - Обмежувач передньої дверки LH Tesla Model 3, Highland. Оригінал",
        "108950700D",
        "prod-2147187f",
    )
    assert slug == (
        "obmezhuvach-perednoi-dverky-lh-tesla-model-3-highland-oryhinal-108950700d"
    )


def test_build_slug_is_unique():
    taken = {"bolt"}
    slug = build_slug("Болт", None, "prod-abcd1234", taken)
    assert slug == "bolt-abcd1234"


def test_build_slug_shortens_long_names():
    slug = build_slug("Дуже " * 80 + "довга назва", None, "prod-1")
    assert len(slug) <= 100
    assert slug.startswith("duzhe-duzhe")


def test_build_slug_falls_back_to_product_id():
    assert build_slug("", None, "prod-2147187f") == "product-2147187f"
