from typing import Optional, Dict, Any

YEAR_CODES = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014, 'F': 2015,
    'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021,
    'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025, 'T': 2026, 'V': 2027
}

PLANT_CODES = {
    'F': 'Fremont, California (USA)',
    'A': 'Gigafactory Texas (Austin, USA)',
    'C': 'Gigafactory Shanghai (China)',
    'B': 'Gigafactory Berlin-Brandenburg (Germany)',
    'P': 'Palo Alto, California (USA)',
    'N': 'Gigafactory Nevada (USA)'
}

MODEL_CODES = {
    'S': 'Model S',
    '3': 'Model 3',
    'X': 'Model X',
    'Y': 'Model Y',
    'T': 'Cybertruck',
    'R': 'Roadster'
}

def decode_tesla_vin(vin: str) -> Optional[Dict[str, Any]]:
    clean_vin = vin.strip().upper()
    if len(clean_vin) != 17:
        return None
    
    # 1-3 WMI check
    wmi = clean_vin[0:3]
    known_wmis = {'5YJ', '7SA', 'LRW', 'XP7', '7G2', 'SFZ'}
    
    # 4th digit: Model
    model_char = clean_vin[3]
    model = MODEL_CODES.get(model_char)
    if not model and wmi not in known_wmis:
        return None
    if not model:
        model = "Tesla Vehicle"
        
    # 10th digit: Year
    year_char = clean_vin[9]
    year = YEAR_CODES.get(year_char, 2024)
    
    # 11th digit: Plant
    plant_char = clean_vin[10]
    plant = PLANT_CODES.get(plant_char, 'Fremont, USA')
    
    # 7th digit: Motor / Drive
    motor_char = clean_vin[6]
    drive = "Dual Motor AWD"
    if motor_char in ['1', 'A', 'D']:
        drive = "Rear-Wheel Drive (RWD)"
    elif motor_char in ['3', '4', 'C', 'F']:
        drive = "Performance AWD"
    elif motor_char in ['K', 'P']:
        drive = "Tri-Motor AWD (Plaid / Cyberbeast)"
    elif motor_char in ['2', 'B', 'E', 'J']:
        drive = "Dual Motor AWD"

    # Generation deduction
    generation = "Classic"
    if model == "Model 3":
        if year >= 2024:
            generation = "Highland (2024-...)"
        else:
            generation = "Classic (2017-2023)"
    elif model == "Model Y":
        if year >= 2025:
            generation = "Juniper (2025-...)"
        else:
            generation = "Classic (2020-2024)"
    elif model == "Model S":
        if year >= 2021:
            generation = "Plaid / Refresh (2021-...)"
        elif year >= 2016:
            generation = "Facelift (2016-2020)"
        else:
            generation = "Classic (2012-2016)"
    elif model == "Model X":
        if year >= 2021:
            generation = "Plaid / Refresh (2021-...)"
        else:
            generation = "Classic (2015-2020)"
    elif model == "Cybertruck":
        generation = "1st Gen (2023-...)"

    body_type = "Sedan"
    if model in ["Model Y", "Model X"]:
        body_type = "SUV / Crossover"
    elif model == "Cybertruck":
        body_type = "Pickup Truck"

    description = f"Tesla {model} {generation.split(' (')[0]} {year} {drive}"

    return {
        "vin": clean_vin,
        "is_valid": True,
        "make": "Tesla",
        "model": model,
        "generation": generation,
        "year": year,
        "plant": plant,
        "drive": drive,
        "body_type": body_type,
        "description": description
    }
