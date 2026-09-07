from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select, delete, or_, col
from typing import List, Optional
import shutil
import os
import re
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from database import get_session
from models import Product, ProductImage, ProductSubcategoryLink, Category
from schemas import ProductCreate, ProductRead, ProductBulkDeleteRequest, ProductReorderRequest
from services.image_uploader import image_uploader
from services.pricing import get_exchange_rate, compute_price_fields
from dependencies import get_current_admin

router = APIRouter(prefix="/products", tags=["products"])

PLACEHOLDER_IMAGE_URL = "https://via.placeholder.com/300"


def _slugify(value: str) -> str:
    """
    Simple slugify implementation matching frontend logic:
    lowercase, trim, replace spaces with dashes.
    """
    if not value:
        return ""
    value = value.lower().strip()
    return re.sub(r'\s+', '-', value)


def _split_categories(category_str: Optional[str]) -> List[str]:
    if not category_str:
        return []
    return [c.strip() for c in category_str.split(",") if c.strip()]


def _collect_subcategory_ids(product: Product) -> List[int]:
    ids: List[int] = []
    if product.subcategory_id:
        ids.append(product.subcategory_id)
    if product.linked_subcategories:
        for sub in product.linked_subcategories:
            if sub.id and sub.id not in ids:
                ids.append(sub.id)
    return ids


def _build_product_response(product: Product, rate: float) -> ProductRead:
    price_usd, price_uah = compute_price_fields(product, rate)
    p_data = product.model_dump()
    p_data["priceUSD"] = price_usd
    p_data["priceUAH"] = price_uah
    p_data["images"] = [img.url for img in product.images]
    p_data["subcategory_ids"] = _collect_subcategory_ids(product)
    # Ensure created_at is handled as ISO format string for frontend if needed, 
    # but Pydantic's datetime field handles this naturally.
    if product.created_at:
        p_data["created_at"] = product.created_at.isoformat()
    return ProductRead(**p_data)


def _normalize_subcategory_selection(
    primary_subcategory_id: Optional[int],
    extra_subcategory_ids: Optional[List[int]],
) -> List[int]:
    normalized: List[int] = []

    if primary_subcategory_id:
        normalized.append(primary_subcategory_id)

    if extra_subcategory_ids:
        for sub_id in extra_subcategory_ids:
            if sub_id and sub_id not in normalized:
                normalized.append(sub_id)

    return normalized


def _sync_linked_subcategories(
    session: Session, product_id: str, link_ids: List[int]
):
    session.exec(
        delete(ProductSubcategoryLink).where(
            ProductSubcategoryLink.product_id == product_id
        )
    )
    for sub_id in link_ids:
        session.add(
            ProductSubcategoryLink(
                product_id=product_id,
                subcategory_id=sub_id,
            )
        )
    session.commit()

@router.get("/", response_model=List[ProductRead])
def read_products(
    category_slug: Optional[str] = None,
    subcategory_id: Optional[int] = None,
    search: Optional[str] = None,
    is_popular: Optional[bool] = None,
    limit: int = 100,
    offset: int = 0,
    session: Session = Depends(get_session)
):
    query = select(Product).options(
        selectinload(Product.images),
        selectinload(Product.linked_subcategories),
    )

    # 0. Filter by Popularity
    if is_popular is not None:
        query = query.where(Product.is_popular == is_popular)
    # We need to find the category name from the slug to support legacy 'Product.category' field
    if category_slug:
        # Fetch all categories to match slug (since we don't have slug column)
        all_categories = session.exec(select(Category)).all()
        target_category = next(
            (c for c in all_categories if _slugify(c.name) == category_slug), 
            None
        )
        
        if target_category:
            # Filter by legacy category name field
            # AND/OR filter by subcategories belonging to this category
            # For now, adhering to existing pattern using the string field as primary
            # FIX 1: Use contains for partial match (comma-separated)
            query = query.where(col(Product.category).contains(target_category.name))
            
            # FIX 2: If we are in "parent category view" (no subcategory_id),
            # hide products that belong to a subcategory.
            if not subcategory_id:
                query = query.where(Product.subcategory_id.is_(None))
                # Also exclude if they are linked to any subcategory
                query = query.where(~Product.linked_subcategories.any())
        else:
            # If slug doesn't match any category, return empty or handle as 404? 
            # Returning empty list is safer for list endpoint
            return []

    # 2. Filter by Subcategory ID
    if subcategory_id:
        # Check both primary subcategory_id AND linked_subcategories
        # This requires a join or a complex condition. 
        # Simpler approach: Product.subcategory_id == id OR Product.linked_subcategories.any(id=id)
        # But SQLModel/SQLAlchemy 'any' relationship query:
        query = query.where(
            or_(
                Product.subcategory_id == subcategory_id,
                Product.linked_subcategories.any(ProductSubcategoryLink.subcategory_id == subcategory_id)
            )
        )

    # 3. Search Filter (Word-by-word tokenized search with normalisation)
    if search:
        # Split search into individual words/tokens, ignoring extra spaces
        tokens = [t.strip() for t in search.split() if t.strip()]
        for token in tokens:
            search_term = f"%{token}%"
            search_term_clean = f"%{token.replace('-', '')}%"
            query = query.where(
                or_(
                    col(Product.name).ilike(search_term),
                    func.replace(Product.detail_number, "-", "").ilike(search_term_clean),
                    col(Product.cross_number).ilike(search_term_clean),
                    col(Product.search_keywords).ilike(search_term),
                    col(Product.category).ilike(search_term),
                    col(Product.description).ilike(search_term)
                )
            )

    # 4. Sorting
    # Priority: Sort Order (DESC), In Stock (DESC), then Name (ASC)
    query = query.order_by(
        col(Product.sort_order).asc(),
        col(Product.inStock).desc(), 
        col(Product.name).asc()
    )

    # 5. Pagination
    query = query.offset(offset).limit(limit)
    
    products = session.exec(query).all()
    rate = get_exchange_rate(session)
    return [_build_product_response(p, rate) for p in products]

@router.get("/{product_id}", response_model=ProductRead)
def read_product(product_id: str, session: Session = Depends(get_session)):
    product = session.exec(
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.images),
            selectinload(Product.linked_subcategories),
        )
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    rate = get_exchange_rate(session)
    return _build_product_response(product, rate)

@router.get("/labels", tags=["labels"])
def read_labels(session: Session = Depends(get_session)):
    products = session.exec(select(Product)).all()
    categories = list(set(p.category for p in products))
    return categories

@router.post("/", response_model=ProductRead, dependencies=[Depends(get_current_admin)])
async def create_product(
    id: Optional[str] = Form(None),
    name: str = Form(...),
    category: str = Form(...),
    subcategory_id: Optional[int] = Form(None),
    subcategory_ids: List[int] = Form(None),
    priceUAH: float = Form(...),
    priceUSD: float = Form(...),
    description: str = Form(...),
    inStock: bool = Form(...),
    sort_order: Optional[int] = Form(None),
    detail_number: Optional[str] = Form(None),
    cross_number: Optional[str] = Form(None),
    search_keywords: Optional[str] = Form(None),
    meta_title: Optional[str] = Form(None),
    meta_description: Optional[str] = Form(None),
    is_popular: bool = Form(False),
    image: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    session: Session = Depends(get_session)
):
    product_id = id or f"prod-{os.urandom(4).hex()}"
    image_urls = []
    
    # Handle multiple file uploads using the image uploader service
    if files:
        for file in files:
            if file.filename:
                url = await image_uploader.upload_image(file, folder="tesla-parts/products")
                if url:
                    image_urls.append(url)
    
    # Determine main image
    main_image = image
    if not main_image and image_urls:
        main_image = image_urls[0]
    if not main_image:
        main_image = PLACEHOLDER_IMAGE_URL

    normalized_subcategories = _normalize_subcategory_selection(
        subcategory_id,
        subcategory_ids,
    )
    primary_subcategory_id = (
        normalized_subcategories[0] if normalized_subcategories else None
    )

    if sort_order is None:
        # Find current max sort_order within the group to place at bottom
        if primary_subcategory_id:
            query = select(func.max(Product.sort_order)).where(Product.subcategory_id == primary_subcategory_id)
        else:
            # For products directly in category name
            # We assume the first category name in the list is the primary one
            first_cat = _split_categories(category)[0] if category else None
            if first_cat:
                query = select(func.max(Product.sort_order)).where(col(Product.category).contains(first_cat)).where(Product.subcategory_id == None)
            else:
                query = select(func.max(Product.sort_order))

        max_val = session.exec(query).one()
        sort_order = (max_val + 1) if max_val is not None else 0
    rate = get_exchange_rate(session)

    product_data = Product(
        id=product_id,
        name=name,
        category=category,
        subcategory_id=primary_subcategory_id,
        priceUAH=priceUAH,
        priceUSD=priceUSD,
        description=description,
        inStock=inStock,
        sort_order=sort_order,
        detail_number=detail_number,
        cross_number=cross_number,
        search_keywords=search_keywords,
        meta_title=meta_title,
        meta_description=meta_description,
        is_popular=is_popular,
        image=main_image
    )
    if priceUSD:
        product_data.priceUAH = round(priceUSD * rate, 2)

    session.add(product_data)
    session.commit()
    session.refresh(product_data)

    _sync_linked_subcategories(
        session,
        product_id,
        normalized_subcategories[1:] if normalized_subcategories else [],
    )
    
    # Save additional images to ProductImage table
    for url in image_urls:
        product_image = ProductImage(product_id=product_id, url=url)
        session.add(product_image)
    
    session.commit()
    session.refresh(product_data) # Refresh to get relationships
    
    session.commit()
    session.refresh(product_data) # Refresh to get relationships
    
    # Construct response manually to avoid modifying the SQLModel relationship with strings
    return _build_product_response(product_data, rate)

@router.put("/{product_id}", response_model=ProductRead, dependencies=[Depends(get_current_admin)])
async def update_product(
    product_id: str,
    name: str = Form(...),
    category: str = Form(...),
    subcategory_id: Optional[int] = Form(None),
    subcategory_ids: List[int] = Form(None),
    priceUAH: float = Form(...),
    priceUSD: float = Form(...),
    description: str = Form(...),
    inStock: bool = Form(...),
    sort_order: int = Form(0),
    detail_number: Optional[str] = Form(None),
    cross_number: Optional[str] = Form(None),
    search_keywords: Optional[str] = Form(None),
    meta_title: Optional[str] = Form(None),
    meta_description: Optional[str] = Form(None),
    is_popular: bool = Form(False),
    image: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    kept_images: List[str] = Form(None),
    session: Session = Depends(get_session)
):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Update basic fields
    product.name = name
    product.category = category
    product.priceUAH = priceUAH
    product.priceUSD = priceUSD
    product.description = description
    product.inStock = inStock
    product.sort_order = sort_order
    product.detail_number = detail_number
    product.cross_number = cross_number
    product.search_keywords = search_keywords
    product.meta_title = meta_title
    product.meta_description = meta_description
    product.is_popular = is_popular
    
    # Update main image if provided
    if image:
        product.image = image
    
    # Handle image deletion (kept_images)
    # If kept_images is provided (even empty list), we sync the gallery.
    # If it's None, we assume no changes to existing gallery unless files are added.
    # However, Form(None) for list might be tricky. Let's assume frontend sends it if it wants to manage images.
    if kept_images is not None:
        normalized_kept = [url for url in kept_images if url]
        # Get current images
        current_images = session.exec(select(ProductImage).where(ProductImage.product_id == product_id)).all()
        for img in current_images:
            if img.url not in normalized_kept:
                session.delete(img)
    
    # Handle new file uploads
    new_image_urls = []
    if files:
        for file in files:
            if file.filename:
                url = await image_uploader.upload_image(file, folder="tesla-parts/products")
                if url:
                    new_image_urls.append(url)

    normalized_subcategories = _normalize_subcategory_selection(
        subcategory_id,
        subcategory_ids,
    )
    product.subcategory_id = (
        normalized_subcategories[0] if normalized_subcategories else None
    )

    rate = get_exchange_rate(session)
    if priceUSD:
        product.priceUAH = round(priceUSD * rate, 2)

    session.add(product)
    session.commit()

    _sync_linked_subcategories(
        session,
        product_id,
        normalized_subcategories[1:] if normalized_subcategories else [],
    )
    
    # Add new images to gallery
    for url in new_image_urls:
        product_image = ProductImage(product_id=product_id, url=url)
        session.add(product_image)
        
    session.commit()
    session.refresh(product)
    
    updated_images = session.exec(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.id)
    ).all()

    new_primary_url = updated_images[0].url if updated_images else None
    image_updated = False

    if new_primary_url and product.image != new_primary_url:
        product.image = new_primary_url
        image_updated = True
    elif not new_primary_url and not product.image:
        product.image = PLACEHOLDER_IMAGE_URL
        image_updated = True

    if image_updated:
        session.add(product)
        session.commit()
        session.refresh(product)

    product.images = updated_images
    return _build_product_response(product, rate)

@router.post("/{product_id}/copy", response_model=ProductRead, dependencies=[Depends(get_current_admin)])
def copy_product(
    product_id: str,
    session: Session = Depends(get_session)
):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    new_id = f"prod-{os.urandom(4).hex()}"
    rate = get_exchange_rate(session)
    
    new_product = Product(
        id=new_id,
        name=f"{product.name} (Копія)",
        category=product.category,
        subcategory_id=product.subcategory_id,
        priceUAH=product.priceUAH,
        priceUSD=product.priceUSD,
        description=product.description,
        inStock=product.inStock,
        sort_order=product.sort_order,
        detail_number=product.detail_number,
        cross_number=product.cross_number,
        meta_title=product.meta_title,
        meta_description=product.meta_description,
        is_popular=product.is_popular,
        image=product.image,
    )
    session.add(new_product)
    session.commit()
    
    links = session.exec(select(ProductSubcategoryLink).where(ProductSubcategoryLink.product_id == product_id)).all()
    for link in links:
        session.add(ProductSubcategoryLink(product_id=new_id, subcategory_id=link.subcategory_id))
        
    images = session.exec(select(ProductImage).where(ProductImage.product_id == product_id)).all()
    for img in images:
        session.add(ProductImage(product_id=new_id, url=img.url))
        
    session.commit()
    
    full_new_product = session.exec(
        select(Product)
        .where(Product.id == new_id)
        .options(
            selectinload(Product.images),
            selectinload(Product.linked_subcategories),
        )
    ).first()
    
    return _build_product_response(full_new_product, rate)

@router.delete("/{product_id}", dependencies=[Depends(get_current_admin)])
def delete_product(product_id: str, session: Session = Depends(get_session)):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    session.exec(
        delete(ProductSubcategoryLink).where(
            ProductSubcategoryLink.product_id == product_id
        )
    )
    session.delete(product)
    session.commit()
    return {"ok": True}


@router.post("/reorder", dependencies=[Depends(get_current_admin)])
def reorder_products(
    request: ProductReorderRequest,
    session: Session = Depends(get_session)
):
    products = session.exec(
        select(Product).where(col(Product.id).in_(request.product_ids))
    ).all()
    
    product_map = {p.id: p for p in products}
    
    for index, prod_id in enumerate(request.product_ids):
        if prod_id in product_map:
            product_map[prod_id].sort_order = index
            session.add(product_map[prod_id])
            
    session.commit()
    return {"message": "Successfully reordered"}

@router.post("/bulk-delete", dependencies=[Depends(get_current_admin)])
def bulk_delete_products(
    request: ProductBulkDeleteRequest,
    session: Session = Depends(get_session),
):
    if not request.product_ids:
        return {"deleted": 0}

    session.exec(
        delete(ProductSubcategoryLink).where(
            ProductSubcategoryLink.product_id.in_(request.product_ids)
        )
    )

    products = session.exec(
        select(Product).where(Product.id.in_(request.product_ids))
    ).all()

    for product in products:
        session.delete(product)

    session.commit()
    return {"deleted": len(products)}

@router.post("/{product_id}/toggle-popular", dependencies=[Depends(get_current_admin)])
def toggle_popular(
    product_id: str,
    session: Session = Depends(get_session)
):
    product = session.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.is_popular = not product.is_popular
    session.add(product)
    session.commit()
    session.refresh(product)
    
    rate = get_exchange_rate(session)
    return _build_product_response(product, rate)
