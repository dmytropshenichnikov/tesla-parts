import json
from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import Schematic, SchematicHotspot, Product

def seed():
    create_db_and_tables()
    with Session(engine) as session:
        existing = session.exec(
            select(Schematic).where(Schematic.title == "Передняя защита днища")
        ).first()
        
        if existing:
            print(f"Schematic already exists (ID {existing.id})")
            return existing.id

        # Also find or link products in catalog if any
        p1 = session.exec(select(Product).where(Product.detail_number.like("%1499151%"))).first()

        schematic = Schematic(
            title="Передняя защита днища",
            model="Model 3",
            generation="Highland (2024-...)",
            section="НАРУЖНЫЕ КРЕПЛЕНИЯ",
            subsystem="Защита днища и диффузор",
            image_url="/static/images/schematics/model3_highland_underbody.png",
            sort_order=1
        )
        session.add(schematic)
        session.commit()
        session.refresh(schematic)

        # Hotspots matching user Image 1
        hotspots_data = [
            {
                "number": 1,
                "x": 24.5,
                "y": 51.5,
                "part_number": "1771474-00-K",
                "name": "Защита переднего бампера",
                "sort_order": 1,
                "variants": [
                    {
                        "name": "Оригинал новый",
                        "type": "original",
                        "condition": "new",
                        "priceUAH": 1582,
                        "priceUSD": 38.5,
                        "inStock": True
                    },
                    {
                        "name": "Аналог новый",
                        "type": "analog",
                        "condition": "new",
                        "priceUAH": 2712,
                        "priceUSD": 66.0,
                        "inStock": True
                    }
                ]
            },
            {
                "number": 2,
                "x": 92.0,
                "y": 64.0,
                "part_number": "1499151-00-C",
                "name": "Защита переднего подрамника пластик (з дефектом)",
                "sort_order": 2,
                "product_id": p1.id if p1 else None,
                "variants": [
                    {
                        "name": "Оригинал б/у (Осталось мало)",
                        "type": "original",
                        "condition": "used",
                        "priceUAH": 2260,
                        "priceUSD": 55.0,
                        "inStock": True
                    },
                    {
                        "name": "Оригинал новый (В наличии)",
                        "type": "original",
                        "condition": "new",
                        "priceUAH": 2938,
                        "priceUSD": 71.5,
                        "inStock": True
                    },
                    {
                        "name": "Аналог новый (В наличии)",
                        "type": "analog",
                        "condition": "new",
                        "priceUAH": 1582,
                        "priceUSD": 38.5,
                        "inStock": True
                    }
                ]
            },
            {
                "number": 3,
                "x": 12.0,
                "y": 54.0,
                "part_number": "1499153-00-B",
                "name": "Боковой кронштейн защиты днища передний",
                "sort_order": 3,
                "variants": [
                    {
                        "name": "Оригинал новый",
                        "type": "original",
                        "condition": "new",
                        "priceUAH": 1640,
                        "priceUSD": 40.0,
                        "inStock": True
                    }
                ]
            },
            {
                "number": 4,
                "x": 44.5,
                "y": 63.5,
                "part_number": "1499154-00-B",
                "name": "Кронштейн пластиковый центральный",
                "sort_order": 4,
                "variants": [
                    {
                        "name": "Оригинал новый",
                        "type": "original",
                        "condition": "new",
                        "priceUAH": 1120,
                        "priceUSD": 27.0,
                        "inStock": True
                    }
                ]
            },
            {
                "number": 5,
                "x": 49.0,
                "y": 61.5,
                "part_number": "1004417-00-A",
                "name": "Винт крепления защиты M6x20 с шайбой",
                "sort_order": 5,
                "variants": [
                    {
                        "name": "Оригинал новый",
                        "type": "original",
                        "condition": "new",
                        "priceUAH": 120,
                        "priceUSD": 3.0,
                        "inStock": True
                    }
                ]
            },
            {
                "number": 6,
                "x": 77.0,
                "y": 35.0,
                "part_number": "1006521-00-A",
                "name": "Клипса крепления пыльника пластиковая (пистон)",
                "sort_order": 6,
                "variants": [
                    {
                        "name": "Оригинал новый",
                        "type": "original",
                        "condition": "new",
                        "priceUAH": 80,
                        "priceUSD": 2.0,
                        "inStock": True
                    }
                ]
            },
            {
                "number": 7,
                "x": 29.0,
                "y": 82.5,
                "part_number": "1004418-00-A",
                "name": "Закладная гайка подрамника M6",
                "sort_order": 7,
                "variants": [
                    {
                        "name": "Оригинал новый",
                        "type": "original",
                        "condition": "new",
                        "priceUAH": 95,
                        "priceUSD": 2.3,
                        "inStock": True
                    }
                ]
            }
        ]

        for h in hotspots_data:
            hs = SchematicHotspot(
                schematic_id=schematic.id,
                number=h["number"],
                x=h["x"],
                y=h["y"],
                part_number=h["part_number"],
                name=h["name"],
                product_id=h.get("product_id"),
                variants_json=json.dumps(h["variants"], ensure_ascii=False),
                sort_order=h["sort_order"]
            )
            session.add(hs)
        
        session.commit()
        print(f"Successfully seeded schematic ID {schematic.id} with {len(hotspots_data)} hotspots!")
        return schematic.id

if __name__ == "__main__":
    seed()
