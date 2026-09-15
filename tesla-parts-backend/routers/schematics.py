import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlmodel import Session, select, func
from sqlalchemy.orm import selectinload

from database import get_session
from models import Schematic, SchematicHotspot, Product
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

def _format_hotspot(hotspot: SchematicHotspot) -> SchematicHotspotRead:
    variants = []
    if hotspot.variants_json:
        try:
            parsed = json.loads(hotspot.variants_json)
            if isinstance(parsed, list):
                variants = [HotspotVariant(**v) for v in parsed]
        except Exception:
            variants = []
    
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
    q: Optional[str] = None,
    session: Session = Depends(get_session)
):
    query = select(Schematic)
    if model and model != "all" and model != "Всі моделі":
        clean_model = model.strip()
        # Handle compound names like "Model 3 Highland" or "Model Y Juniper"
        if "highland" in clean_model.lower():
            clean_model = "Model 3"
            if not generation or generation == "Всі покоління":
                generation = "Highland"
        elif "juniper" in clean_model.lower():
            clean_model = "Model Y"
            if not generation or generation == "Всі покоління":
                generation = "Juniper"

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
    formatted_hotspots = [_format_hotspot(h) for h in sorted_hotspots]
    
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
