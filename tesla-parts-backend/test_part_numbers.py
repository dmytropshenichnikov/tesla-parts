from services import part_numbers as pn


def test_alternate_both_ways():
    assert pn.alternate("161086600A") == "1610866-00-A"
    assert pn.alternate("1108905S0A") == "1108905-S0-A"
    assert pn.alternate("1610866-00-A") == "161086600A"
    assert pn.alternate(" 1588184S0A ") == "1588184-S0-A"


def test_non_tesla_numbers_left_alone():
    for number in ["AA01500001", "5163001", "5163-001", "602195708", "106953401А", ""]:
        assert pn.alternate(number) is None


def test_display_keeps_original_first():
    assert pn.display("161086600A") == "161086600A / 1610866-00-A"
    assert pn.display("110454000B, 110454100B") == "110454000B / 1104540-00-B, 110454100B / 1104541-00-B"
    assert pn.display("109503800A, AA01500001") == "109503800A / 1095038-00-A, AA01500001"
    assert pn.display(None) == ""
    assert pn.display("null") == ""


def test_hyphenated():
    assert pn.hyphenated("161086600A") == "1610866-00-A"
    assert pn.hyphenated("1044331-00-C") == "1044331-00-C"
    assert pn.hyphenated("AA01500001, 109503800A") == "1095038-00-A"
    assert pn.hyphenated("5163001") is None


def test_with_alternates_appends_once():
    text = pn.with_alternates("Панель передня", "161086600A", "108350100B, 161086600A")
    assert text == "Панель передня 1610866-00-A, 1083501-00-B"
    assert pn.with_alternates("Масло ZF", "AA01500001", None) == "Масло ZF"


def test_feed_title():
    name = "161086600A - Панель передня (телевізор) рестайлінг Tesla Model 3. Оригінал"
    assert pn.feed_title(name, "161086600A") == (
        "161086600A 1610866-00-A - Панель передня (телевізор) рестайлінг Tesla Model 3. Оригінал"
    )
    assert pn.feed_title("Комплект кронштейнів", "110454000B, 110454100B") == (
        "Комплект кронштейнів 1104540-00-B 1104541-00-B"
    )
    assert pn.feed_title("AA01500001 - Масло ZF", "AA01500001") == "AA01500001 - Масло ZF"
    assert pn.feed_title("110454000B, 110454100B - Комплект", "110454000B, 110454100B") == (
        "110454000B, 110454100B 1104540-00-B 1104541-00-B - Комплект"
    )
    assert len(pn.feed_title("161086600A " + "x" * 200, "161086600A")) == 150
