import re
import json
import urllib.request
import urllib.parse
from fastapi import APIRouter, HTTPException, Query
from schemas import VinDecodeResult, PlateLookupResult
from services.vin_decoder import decode_tesla_vin

router = APIRouter(prefix="/vin", tags=["vin"])

CYRILLIC_TO_LATIN = {
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'І': 'I',
    'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X',
    'а': 'A', 'в': 'B', 'с': 'C', 'е': 'E', 'н': 'H', 'і': 'I',
    'к': 'K', 'м': 'M', 'о': 'O', 'р': 'P', 'т': 'T', 'х': 'X'
}

def normalize_ukrainian_plate(plate: str) -> str:
    cleaned = re.sub(r'[^a-zA-Zа-яА-ЯіІїЇ0-9]', '', plate).upper()
    result = []
    for char in cleaned:
        result.append(CYRILLIC_TO_LATIN.get(char, char))
    return "".join(result)

def format_plate_display(plate: str) -> str:
    # Typical Ukrainian format: AA 1234 BB or AA 1234
    if len(plate) == 8 and plate[:2].isalpha() and plate[2:6].isdigit() and plate[6:].isalpha():
        return f"{plate[:2]} {plate[2:6]} {plate[6:]}"
    elif len(plate) >= 6:
        return f"{plate[:2]} {plate[2:]}"
    return plate

@router.get("/lookup-by-plate", response_model=PlateLookupResult)
def lookup_by_plate(plate: str = Query(..., min_length=2, max_length=15, description="Державний номер авто")):
    normalized = normalize_ukrainian_plate(plate)
    if len(normalized) < 4:
        raise HTTPException(
            status_code=400,
            detail="Введіть коректний номерний знак авто (наприклад, КА1234АА)"
        )

    url = "https://hotline.finance/api/insurance/osago/carDataByNumber/find"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://hotline.finance/ua/osago",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    }
    payload = urllib.parse.urlencode({"number": normalized, "traffic": "1"}).encode('utf-8')

    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status != 200:
                raise HTTPException(
                    status_code=502,
                    detail="Сервіс перевірки номерів тимчасово недоступний. Спробуйте пізніше або введіть VIN вручну."
                )
            res_data = json.loads(resp.read().decode('utf-8'))
    except urllib.error.URLError:
        raise HTTPException(
            status_code=502,
            detail="Помилка з'єднання із сервісом перевірки авто. Спробуйте пізніше або введіть VIN вручну."
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Не вдалося обробити відповідь сервісу перевірки. Спробуйте пізніше або введіть VIN вручну."
        )

    if not res_data.get("status") or not res_data.get("data"):
        raise HTTPException(
            status_code=404,
            detail="Автомобіль за вказаним номером не знайдено в реєстрах. Перевірте правильність номера або введіть VIN-код вручну."
        )

    car_data = res_data["data"]
    vin = (car_data.get("vin") or "").strip().upper()
    if not vin or len(vin) < 11:
        raise HTTPException(
            status_code=404,
            detail="Не вдалося отримати повний VIN-код для цього автомобіля. Введіть VIN вручну."
        )

    mark = (car_data.get("markName") or "").strip()
    model = (car_data.get("modelName") or "").strip()
    year = int(car_data.get("prodYear") or 0)
    formatted_plate = format_plate_display(normalized)

    is_tesla = (
        "TESLA" in mark.upper()
        or "TESLA" in model.upper()
        or vin.startswith(("5YJ", "7SA", "LRW", "XP7", "7G2"))
    )

    if not is_tesla:
        raise HTTPException(
            status_code=400,
            detail="Автомобіль за цим номером не є Tesla. Пошук за номером підтримує виключно автомобілі Tesla."
        )

    tesla_specs = decode_tesla_vin(vin)

    return PlateLookupResult(
        plate=formatted_plate,
        vin=vin,
        mark="TESLA",
        model=tesla_specs.model if tesla_specs else (model or "Tesla"),
        year=year,
        is_tesla=True,
        tesla_specs=tesla_specs,
        message=None
    )

@router.get("/decode", response_model=VinDecodeResult)
def decode_vin(vin: str = Query(..., min_length=17, max_length=17, description="17-digit Tesla VIN")):
    result = decode_tesla_vin(vin)
    if not result:
        raise HTTPException(
            status_code=400,
            detail="Недійсний VIN-номер Tesla. Перевірте правильність введеного 17-значного коду."
        )
    return result

@router.get("/models")
def get_supported_models():
    """Returns supported models and generations for manual selection in My Garage."""
    return [
        {
            "id": "model_3",
            "name": "Model 3",
            "generations": [
                {
                    "id": "highland",
                    "name": "Highland (2024-...)",
                    "years": [2026, 2025, 2024],
                    "trims": ["Rear-Wheel Drive (RWD)", "Long Range AWD", "Performance AWD"]
                },
                {
                    "id": "classic",
                    "name": "Classic (2017-2023)",
                    "years": [2023, 2022, 2021, 2020, 2019, 2018, 2017],
                    "trims": ["Standard Range Plus RWD", "Long Range AWD", "Performance AWD", "Mid Range RWD"]
                }
            ]
        },
        {
            "id": "model_y",
            "name": "Model Y",
            "generations": [
                {
                    "id": "classic",
                    "name": "Classic (2020-2024)",
                    "years": [2024, 2023, 2022, 2021, 2020],
                    "trims": ["Rear-Wheel Drive (RWD)", "Long Range AWD", "Performance AWD"]
                },
                {
                    "id": "juniper",
                    "name": "Juniper (2025-...)",
                    "years": [2026, 2025],
                    "trims": ["Rear-Wheel Drive (RWD)", "Long Range AWD", "Performance AWD"]
                }
            ]
        },
        {
            "id": "model_s",
            "name": "Model S",
            "generations": [
                {
                    "id": "refresh",
                    "name": "Plaid / Refresh (2021-...)",
                    "years": [2025, 2024, 2023, 2022, 2021],
                    "trims": ["Long Range Dual Motor AWD", "Plaid Tri-Motor AWD"]
                },
                {
                    "id": "facelift",
                    "name": "Facelift (2016-2020)",
                    "years": [2020, 2019, 2018, 2017, 2016],
                    "trims": ["75D", "100D", "P100D", "Standard Range", "Long Range"]
                },
                {
                    "id": "classic",
                    "name": "Classic (2012-2016)",
                    "years": [2016, 2015, 2014, 2013, 2012],
                    "trims": ["60", "85", "85D", "P85D", "90D", "P90D"]
                }
            ]
        },
        {
            "id": "model_x",
            "name": "Model X",
            "generations": [
                {
                    "id": "refresh",
                    "name": "Plaid / Refresh (2021-...)",
                    "years": [2025, 2024, 2023, 2022, 2021],
                    "trims": ["Long Range Dual Motor AWD", "Plaid Tri-Motor AWD"]
                },
                {
                    "id": "classic",
                    "name": "Classic (2015-2020)",
                    "years": [2020, 2019, 2018, 2017, 2016, 2015],
                    "trims": ["75D", "90D", "100D", "P100D", "Long Range"]
                }
            ]
        },
        {
            "id": "cybertruck",
            "name": "Cybertruck",
            "generations": [
                {
                    "id": "gen1",
                    "name": "1st Gen (2023-...)",
                    "years": [2025, 2024, 2023],
                    "trims": ["All-Wheel Drive (AWD)", "Cyberbeast Tri-Motor AWD", "Rear-Wheel Drive (RWD)"]
                }
            ]
        }
    ]
