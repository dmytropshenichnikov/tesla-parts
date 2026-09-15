from fastapi import APIRouter, HTTPException, Query
from schemas import VinDecodeResult
from services.vin_decoder import decode_tesla_vin

router = APIRouter(prefix="/vin", tags=["vin"])

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
