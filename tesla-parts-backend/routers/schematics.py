import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload

from database import get_session
from models import Schematic, SchematicHotspot, Product, Category, Subcategory
from schemas import (
    SchematicRead,
    SchematicSummary,
    SchematicCreate,
    SchematicUpdate,
    SchematicHotspotRead,
    HotspotVariant,
    ProductRead
)
from dependencies import get_current_admin
from services.image_uploader import image_uploader

router = APIRouter(prefix="/schematics", tags=["schematics"])

def _format_hotspot(
    hotspot: SchematicHotspot,
    products_by_id: Optional[dict] = None
) -> SchematicHotspotRead:
    variants = []
    if hotspot.variants_json:
        try:
            parsed = json.loads(hotspot.variants_json)
            if isinstance(parsed, list):
                variants = [HotspotVariant(**v) for v in parsed]
        except Exception:
            variants = []

    # Варіант, привʼязаний до товару каталогу, показує АКТУАЛЬНІ ціну й
    # наявність із каталогу, а не знімок на момент привʼязки. Саме тому зміна
    # ціни в каталозі одразу видна на схемах. Назву, тип і стан НЕ чіпаємо —
    # це підписи адміністратора (напр. «Оригінал б/у (Осталось мало)»).
    if products_by_id:
        for variant in variants:
            product = products_by_id.get(variant.product_id) if variant.product_id else None
            if not product:
                continue
            variant.priceUAH = product.priceUAH or 0.0
            if product.priceUSD:
                variant.priceUSD = product.priceUSD
            variant.inStock = product.inStock
    
    product_read = None
    if hotspot.product:
        product_read = ProductRead(
            id=hotspot.product.id,
            name=hotspot.product.name,
            category=hotspot.product.category,
            priceUSD=hotspot.product.priceUSD,
            priceUAH=hotspot.product.priceUAH,
            image=hotspot.product.image,
            description=hotspot.product.description,
            inStock=hotspot.product.inStock,
            detail_number=hotspot.product.detail_number,
            cross_number=hotspot.product.cross_number,
            part_type=hotspot.product.part_type,
            created_at=hotspot.product.created_at,
            images=[img.url for img in hotspot.product.images] if hotspot.product.images else []
        )

    return SchematicHotspotRead(
        id=hotspot.id,
        schematic_id=hotspot.schematic_id,
        number=hotspot.number,
        x=hotspot.x,
        y=hotspot.y,
        part_number=hotspot.part_number,
        name=hotspot.name,
        product_id=hotspot.product_id,
        variants_json=hotspot.variants_json,
        sort_order=hotspot.sort_order,
        product=product_read,
        variants=variants
    )

@router.get("", response_model=List[SchematicSummary])
def list_schematics(
    model: Optional[str] = None,
    generation: Optional[str] = None,
    section: Optional[str] = None,
    subsystem: Optional[str] = None,
    q: Optional[str] = None,
    session: Session = Depends(get_session)
):
    query = select(Schematic)
    if model and model != "all" and model != "Всі моделі":
        clean_model = model.strip()
        # Модель може бути назвою категорії-варіанта («Model 3 Highland»,
        # «Model Y Juniper», «Model 3 Classic»...). Тоді базову модель і
        # покоління визначаємо за категоріями каталогу, а не хардкодом.
        category_names = [
            c.name for c in session.exec(select(Category)).all() if c.name
        ]
        base_category = _base_category_name(clean_model, category_names)
        if base_category:
            variant = clean_model[len(base_category):].strip()
            clean_model = base_category
            if not generation or generation == "Всі покоління":
                generation = variant
        else:
            # Це БАЗОВА категорія, під якою є окремі категорії-варіанти
            # («Model 3 Highland», «Model Y Juniper»). Категорії не змішуємо:
            # під «Model 3» показуємо лише те, що не належить варіантам.
            for name in category_names:
                if name.lower().startswith(clean_model.lower() + " "):
                    variant_keyword = name[len(clean_model):].strip().lower()
                    if variant_keyword:
                        query = query.where(
                            ~func.lower(Schematic.generation).like(f"%{variant_keyword}%")
                        )

        query = query.where(func.lower(Schematic.model) == clean_model.lower())

    if generation and generation != "Всі покоління":
        gen_clean = generation.strip().lower()
        if "highland" in gen_clean:
            query = query.where(func.lower(Schematic.generation).like("%highland%"))
        elif "juniper" in gen_clean:
            query = query.where(func.lower(Schematic.generation).like("%juniper%"))
        elif "classic" in gen_clean:
            query = query.where(func.lower(Schematic.generation).like("%classic%"))
        else:
            query = query.where(func.lower(Schematic.generation).like(f"%{gen_clean}%"))
    if section:
        query = query.where(Schematic.section == section)
    if subsystem:
        query = query.where(Schematic.subsystem == subsystem)
    if q:
        search_pattern = f"%{q.strip().lower()}%"
        query = query.where(
            func.lower(Schematic.title).like(search_pattern) |
            func.lower(Schematic.subsystem).like(search_pattern)
        )
    
    query = query.order_by(Schematic.sort_order, Schematic.id)
    schematics = session.exec(query).all()
    
    results = []
    for s in schematics:
        count = session.exec(
            select(func.count(SchematicHotspot.id)).where(SchematicHotspot.schematic_id == s.id)
        ).first() or 0
        results.append(
            SchematicSummary(
                id=s.id,
                title=s.title,
                model=s.model,
                generation=s.generation,
                section=s.section,
                subsystem=s.subsystem,
                image_url=s.image_url,
                sort_order=s.sort_order,
                created_at=s.created_at,
                hotspots_count=count
            )
        )
    return results

@router.get("/sections")
def get_schematic_sections(
    model: Optional[str] = None,
    generation: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """Дерево «розділ → підсистеми» для схем обраної моделі.

    Потрібне, щоб у магазині шлях до схеми був як у каталозі:
    авто → розділ (КУЗОВ, НАРУЖНЫЕ КРЕПЛЕНИЯ...) → підсистема → схема.
    """
    query = select(Schematic)
    if model and model != "all" and model != "Всі моделі":
        clean_model = model.strip()
        category_names = [
            c.name for c in session.exec(select(Category)).all() if c.name
        ]
        base_category = _base_category_name(clean_model, category_names)
        if base_category:
            variant = clean_model[len(base_category):].strip()
            clean_model = base_category
            if not generation or generation == "Всі покоління":
                generation = variant
        query = query.where(func.lower(Schematic.model) == clean_model.lower())

    if generation and generation != "Всі покоління":
        query = query.where(func.lower(Schematic.generation).like(f"%{generation.strip().lower()}%"))

    schematics = session.exec(query.order_by(Schematic.sort_order, Schematic.id)).all()

    grouped: dict = {}
    for item in schematics:
        section_name = (item.section or "Інше").strip()
        subsystem_name = (item.subsystem or "Інше").strip()
        bucket = grouped.setdefault(section_name, {"section": section_name, "count": 0, "subsystems": {}})
        bucket["count"] += 1
        bucket["subsystems"][subsystem_name] = bucket["subsystems"].get(subsystem_name, 0) + 1

    # Картинку розділу беремо з однойменної підкатегорії каталогу
    section_images: dict = {}
    for sub in session.exec(select(Subcategory)).all():
        if sub.image:
            section_images.setdefault(sub.name.strip().lower(), sub.image)

    sections = []
    for bucket in grouped.values():
        sections.append({
            "section": bucket["section"],
            "image": section_images.get(bucket["section"].strip().lower()),
            "count": bucket["count"],
            "subsystems": [
                {"subsystem": name, "count": count}
                for name, count in sorted(bucket["subsystems"].items())
            ],
        })

    sections.sort(key=lambda item: (-item["count"], item["section"]))
    return {"sections": sections, "total": len(schematics)}


def _section_and_subsystem_for_subcategory(
    subcategory: Subcategory,
    by_id: dict
) -> tuple:
    """Як підкатегорія каталогу співвідноситься з полями схеми.

    Верхній рівень підкатегорій — це «розділ» схеми, їхні діти — «підсистема».
    Тобто «ЗАХИСТИ ПЕРЕДНІ» (id 142, батько «ЗОВНІШНЄ ОЗДОБЛЕННЯ») → схема
    з section = «ЗОВНІШНЄ ОЗДОБЛЕННЯ» і subsystem = «ЗАХИСТИ ПЕРЕДНІ».
    """
    if subcategory.parent_id:
        parent = by_id.get(subcategory.parent_id)
        if parent:
            return parent.name, subcategory.name
    return subcategory.name, ""


@router.get("/for-subcategory/{subcategory_id}")
def get_schematics_for_subcategory(
    subcategory_id: int,
    session: Session = Depends(get_session)
):
    """Схеми, які відповідають підкатегорії каталогу.

    Потрібно, щоб у каталозі поруч із товарами підкатегорії була кнопка
    «Схема» — як в інших каталогах запчастин.
    """
    subcategory = session.get(Subcategory, subcategory_id)
    if not subcategory:
        return {"schematics": [], "subcategory": None}

    all_subcategories = session.exec(select(Subcategory)).all()
    by_id = {item.id: item for item in all_subcategories}
    section, subsystem = _section_and_subsystem_for_subcategory(subcategory, by_id)

    query = select(Schematic).where(Schematic.section == section)
    if subsystem:
        query = query.where(Schematic.subsystem == subsystem)

    schematics = session.exec(query.order_by(Schematic.sort_order, Schematic.id)).all()
    results = []
    for item in schematics:
        hotspots_count = session.exec(
            select(func.count(SchematicHotspot.id)).where(SchematicHotspot.schematic_id == item.id)
        ).first() or 0
        results.append({
            "id": item.id,
            "title": item.title,
            "model": item.model,
            "generation": item.generation,
            "section": item.section,
            "subsystem": item.subsystem,
            "image_url": item.image_url,
            "hotspots_count": hotspots_count,
        })

    return {
        "subcategory": {"id": subcategory.id, "name": subcategory.name},
        "section": section,
        "subsystem": subsystem,
        "schematics": results,
    }


@router.get("/subsystem-info")
def get_subsystem_info(
    model: Optional[str] = None,
    section: Optional[str] = None,
    subsystem: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """Підкатегорія каталогу, яка відповідає підсистемі схеми.

    Дає магазину id підкатегорії, щоб на кроці «підсистема» показати деталі
    саме цього вузла, а не весь каталог.
    """
    if not subsystem:
        return {"subcategory_id": None}

    subcategories = session.exec(select(Subcategory)).all()
    wanted = subsystem.strip().lower()

    # 1) спершу шукаємо в межах категорії обраної моделі
    category_ids = []
    if model:
        category = session.exec(
            select(Category).where(func.lower(Category.name) == model.strip().lower())
        ).first()
        if category:
            category_ids.append(category.id)
        else:
            for category in session.exec(select(Category)).all():
                if model.strip().lower().startswith(category.name.strip().lower()):
                    category_ids.append(category.id)

    by_id = {item.id: item for item in subcategories}
    section_name = (section or "").strip().lower()

    def find_in(scope):
        # Якщо відомий розділ — шукаємо саме в ньому: схема живе за точним
        # шляхом каталогу (категорія → розділ → підсистема)
        if section_name:
            for item in subcategories:
                if scope is not None and item.category_id not in scope:
                    continue
                if item.name.strip().lower() != wanted:
                    continue
                parent = by_id.get(item.parent_id) if item.parent_id else None
                if parent and parent.name.strip().lower() == section_name:
                    return item
        for item in subcategories:
            if scope is not None and item.category_id not in scope:
                continue
            if item.name.strip().lower() == wanted:
                return item
        return None

    match = find_in(category_ids) if category_ids else None
    if not match:
        match = find_in(None)

    if not match:
        return {"subcategory_id": None}

    return {
        "subcategory_id": match.id,
        "subcategory_name": match.name,
        "category_id": match.category_id,
    }


@router.get("/by-product/{product_id}")
def get_schematics_by_product(
    product_id: str,
    session: Session = Depends(get_session)
):
    """Схеми, у яких використовується ця деталь.

    Зворотний бік екосистеми: на сторінці товару показуємо, у яких вузлах
    він стоїть, щоб клієнт міг піти від деталі до схеми.
    """
    # Префільтр по БД, далі точна перевірка JSON — так не тягнемо всі схеми
    hotspots = session.exec(
        select(SchematicHotspot).where(
            (SchematicHotspot.product_id == product_id)
            | (func.coalesce(SchematicHotspot.variants_json, "").like(f"%{product_id}%"))
        )
    ).all()

    def matches(hotspot: SchematicHotspot) -> bool:
        if hotspot.product_id == product_id:
            return True
        if not hotspot.variants_json:
            return False
        try:
            for raw in json.loads(hotspot.variants_json):
                if isinstance(raw, dict) and raw.get("product_id") == product_id:
                    return True
        except Exception:
            return False
        return False

    hits = [h for h in hotspots if matches(h)]
    if not hits:
        return {"schematics": []}

    schematic_ids = {h.schematic_id for h in hits}
    schematics = session.exec(
        select(Schematic).where(Schematic.id.in_(schematic_ids))
    ).all()
    by_id = {s.id: s for s in schematics}

    results = []
    for hotspot in sorted(hits, key=lambda h: (h.schematic_id, h.number, h.sort_order)):
        schematic = by_id.get(hotspot.schematic_id)
        if not schematic:
            continue
        results.append({
            "schematic_id": schematic.id,
            "title": schematic.title,
            "model": schematic.model,
            "generation": schematic.generation,
            "section": schematic.section,
            "subsystem": schematic.subsystem,
            "number": hotspot.number,
            "part_number": hotspot.part_number,
        })

    return {"schematics": results}


@router.get("/section-options")
def get_section_options(
    category_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    """Розділи й підсистеми для схем — з підкатегорій КАТАЛОГУ.

    Щоб «КУЗОВ», «Кузов» і «кузов» не розповзались на три різні розділи,
    адміністратор обирає значення зі списку каталогу, а не вписує текст.
    Верхній рівень підкатегорій = розділ схеми, їхні діти = підсистема.
    """
    if not category_id:
        return {"sections": []}

    rows = session.exec(
        select(Subcategory)
        .where(Subcategory.category_id == category_id)
        .order_by(Subcategory.sort_order.desc(), Subcategory.id)
    ).all()

    children: dict = {}
    tops = []
    for item in rows:
        if item.parent_id is None:
            tops.append(item)
        else:
            children.setdefault(item.parent_id, []).append(item.name)

    return {
        "sections": [
            {"section": top.name, "subsystems": children.get(top.id, [])}
            for top in tops
        ]
    }


@router.get("/meta/filters")
def get_schematic_filters(session: Session = Depends(get_session)):
    schematics = session.exec(select(Schematic)).all()
    models = sorted(list(set(s.model for s in schematics if s.model)))
    generations = sorted(list(set(s.generation for s in schematics if s.generation)))
    sections = sorted(list(set(s.section for s in schematics if s.section)))
    subsystems = sorted(list(set(s.subsystem for s in schematics if s.subsystem)))
    return {
        "models": models,
        "generations": generations,
        "sections": sections,
        "subsystems": subsystems
    }

# --- Опції «Модель / Покоління» для схем -------------------------------------
# Джерело істини — категорії каталогу (таблиця category). Жодних хардкод-списків
# у фронтенді: і адмінка, і магазин беруть ці опції звідси.
#
# Категорія-варіант (напр. «Model 3 Highland») — це базова модель («Model 3»)
# плюс уточнення покоління. Для таких категорій покоління визначається
# автоматично, тому в редакторі схем воно підставляється й не «висить» окремо.

# Покоління за замовчуванням для категорії, під якою ще немає жодної схеми.
DEFAULT_GENERATION = "Стандартна"
# Категорії-аксесуари не прив'язані до конкретного авто.
ACCESSORY_GENERATION = "Універсальні"
ACCESSORY_KEYWORDS = ("аксесуар", "аксессуар", "accessor")


def _is_accessory_category(name: str) -> bool:
    low = (name or "").strip().lower()
    return any(keyword in low for keyword in ACCESSORY_KEYWORDS)


def _base_category_name(name: str, all_names: List[str]) -> Optional[str]:
    """Повертає базову категорію, якщо name є її варіантом.

    «Model 3 Highland» → «Model 3»;  «Model 3» → None.
    Беріться найдовший збіг, щоб «Model 3 Highland» не злипалося з «Model».
    """
    low = (name or "").strip().lower()
    if not low:
        return None
    base: Optional[str] = None
    for candidate in all_names:
        cand = (candidate or "").strip()
        if not cand or cand.lower() == low:
            continue
        if low.startswith(cand.lower() + " ") and (base is None or len(cand) > len(base)):
            base = cand
    return base


@router.get("/model-options")
def get_schematic_model_options(session: Session = Depends(get_session)):
    """Опції моделей і поколінь для редактора схем — побудовані з категорій."""
    categories = session.exec(
        select(Category).order_by(Category.sort_order, Category.id)
    ).all()
    names = [c.name for c in categories if c.name]

    known_rows = session.exec(select(Schematic.model, Schematic.generation)).all()
    generations_by_model: dict = {}
    for model, generation in known_rows:
        if not model or not generation:
            continue
        bucket = generations_by_model.setdefault(model.strip().lower(), [])
        if generation not in bucket:
            bucket.append(generation)

    vehicles: List[dict] = []
    accessories: List[dict] = []

    for category in categories:
        name = (category.name or "").strip()
        if not name:
            continue

        base = _base_category_name(name, names)
        existing = generations_by_model.get((base or name).lower(), [])

        if base:
            # Категорія-варіант: покоління визначається категорією.
            variant = name[len(base):].strip()
            generations = [g for g in existing if variant.lower() in g.lower()]
            if not generations:
                generations = [variant]
            option = {
                "category": name,
                "category_id": category.id,
                "image": category.image,
                "model": base,
                "generation": generations[0],
                "generations": generations,
                "pinned_generation": True,
                "is_accessory": False,
            }
            schematics_count = session.exec(
                select(func.count(Schematic.id)).where(
                    func.lower(Schematic.model) == base.lower(),
                    func.lower(Schematic.generation).like(f"%{variant.lower()}%"),
                )
            ).first() or 0
        elif _is_accessory_category(name):
            option = {
                "category": name,
                "category_id": category.id,
                "image": category.image,
                "model": name,
                "generation": ACCESSORY_GENERATION,
                "generations": [ACCESSORY_GENERATION],
                "pinned_generation": True,
                "is_accessory": True,
            }
            schematics_count = session.exec(
                select(func.count(Schematic.id)).where(
                    func.lower(Schematic.model) == name.lower()
                )
            ).first() or 0
        else:
            # Базова модель: покоління беремо з уже наявних схем цієї моделі.
            generations = list(existing) or [DEFAULT_GENERATION]
            option = {
                "category": name,
                "category_id": category.id,
                "image": category.image,
                "model": name,
                "generation": generations[0],
                "generations": generations,
                "pinned_generation": len(generations) == 1,
                "is_accessory": False,
            }
            schematics_count = session.exec(
                select(func.count(Schematic.id)).where(
                    func.lower(Schematic.model) == name.lower()
                )
            ).first() or 0

        option["schematics_count"] = schematics_count
        (accessories if option["is_accessory"] else vehicles).append(option)

    return {"options": vehicles + accessories}


@router.get("/{schematic_id}", response_model=SchematicRead)
def get_schematic(schematic_id: int, session: Session = Depends(get_session)):
    schematic = session.exec(
        select(Schematic)
        .where(Schematic.id == schematic_id)
        .options(
            selectinload(Schematic.hotspots).selectinload(SchematicHotspot.product).selectinload(Product.images)
        )
    ).first()
    
    if not schematic:
        raise HTTPException(status_code=404, detail="Схему не знайдено")
    
    sorted_hotspots = sorted(schematic.hotspots, key=lambda h: (h.number, h.sort_order))

    # Збираємо всі товари, до яких привʼязані варіанти точок, одним запитом —
    # щоб віддати на фронт актуальні ціни з каталогу.
    variant_product_ids = set()
    for hotspot in sorted_hotspots:
        if not hotspot.variants_json:
            continue
        try:
            for raw in json.loads(hotspot.variants_json):
                if isinstance(raw, dict) and raw.get("product_id"):
                    variant_product_ids.add(raw["product_id"])
        except Exception:
            continue

    products_by_id = {}
    if variant_product_ids:
        rows = session.exec(
            select(Product).where(Product.id.in_(variant_product_ids))
        ).all()
        products_by_id = {row.id: row for row in rows}

    formatted_hotspots = [_format_hotspot(h, products_by_id) for h in sorted_hotspots]

    return SchematicRead(
        id=schematic.id,
        title=schematic.title,
        model=schematic.model,
        generation=schematic.generation,
        section=schematic.section,
        subsystem=schematic.subsystem,
        image_url=schematic.image_url,
        sort_order=schematic.sort_order,
        created_at=schematic.created_at,
        hotspots=formatted_hotspots
    )

@router.post("", response_model=SchematicRead, dependencies=[Depends(get_current_admin)])
def create_schematic(payload: SchematicCreate, session: Session = Depends(get_session)):
    schematic = Schematic(
        title=payload.title,
        model=payload.model,
        generation=payload.generation,
        section=payload.section,
        subsystem=payload.subsystem,
        image_url=payload.image_url,
        sort_order=payload.sort_order
    )
    session.add(schematic)
    session.commit()
    session.refresh(schematic)
    
    for h in payload.hotspots:
        hotspot = SchematicHotspot(
            schematic_id=schematic.id,
            number=h.number,
            x=h.x,
            y=h.y,
            part_number=h.part_number,
            name=h.name,
            product_id=h.product_id,
            variants_json=h.variants_json,
            sort_order=h.sort_order
        )
        session.add(hotspot)
    
    session.commit()
    return get_schematic(schematic.id, session)

@router.put("/{schematic_id}", response_model=SchematicRead, dependencies=[Depends(get_current_admin)])
def update_schematic(schematic_id: int, payload: SchematicUpdate, session: Session = Depends(get_session)):
    schematic = session.get(Schematic, schematic_id)
    if not schematic:
        raise HTTPException(status_code=404, detail="Схему не знайдено")
    
    if payload.title is not None:
        schematic.title = payload.title
    if payload.model is not None:
        schematic.model = payload.model
    if payload.generation is not None:
        schematic.generation = payload.generation
    if payload.section is not None:
        schematic.section = payload.section
    if payload.subsystem is not None:
        schematic.subsystem = payload.subsystem
    if payload.image_url is not None:
        schematic.image_url = payload.image_url
    if payload.sort_order is not None:
        schematic.sort_order = payload.sort_order
        
    session.add(schematic)
    session.commit()
    
    # If hotspots were provided, replace them
    if payload.hotspots is not None:
        existing_hotspots = session.exec(
            select(SchematicHotspot).where(SchematicHotspot.schematic_id == schematic_id)
        ).all()
        for eh in existing_hotspots:
            session.delete(eh)
        session.commit()
        
        for h in payload.hotspots:
            hotspot = SchematicHotspot(
                schematic_id=schematic.id,
                number=h.number,
                x=h.x,
                y=h.y,
                part_number=h.part_number,
                name=h.name,
                product_id=h.product_id,
                variants_json=h.variants_json,
                sort_order=h.sort_order
            )
            session.add(hotspot)
        session.commit()
        
    return get_schematic(schematic.id, session)

@router.delete("/{schematic_id}", dependencies=[Depends(get_current_admin)])
def delete_schematic(schematic_id: int, session: Session = Depends(get_session)):
    schematic = session.get(Schematic, schematic_id)
    if not schematic:
        raise HTTPException(status_code=404, detail="Схему не знайдено")
    session.delete(schematic)
    session.commit()
    return {"message": "Схему успішно видалено"}

@router.post("/upload-image", dependencies=[Depends(get_current_admin)])
async def upload_schematic_image(file: UploadFile = File(...)):
    url = await image_uploader.upload_image(file, folder="tesla-parts/schematics")
    if not url:
        raise HTTPException(status_code=500, detail="Помилка завантаження зображення")
    return {"image_url": url}
