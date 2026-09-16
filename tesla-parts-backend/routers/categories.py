from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from pydantic import BaseModel
from database import get_session
from models import Category, Subcategory, Product, ProductSubcategoryLink
from schemas import (
    CategoryRead,
    CategoryCreate,
    SubcategoryRead,
    SubcategoryCreate,
    SubcategoryTransferRequest,
    CategoryListSchema,
    CategoryDetailSchema,
    SubcategoryNoProducts,
)
from services.image_uploader import image_uploader
from services.pricing import get_exchange_rate, compute_price_fields
from dependencies import get_current_admin # Import get_current_admin

router = APIRouter(prefix="/categories", tags=["categories"])


def _get_next_category_sort_order(session: Session) -> int:
    result = session.exec(select(func.max(Category.sort_order))).first()
    if result is None:
        return 0
    if isinstance(result, tuple):
        result = result[0]
    if result is None:
        return 0
    return int(result) + 1


def _get_next_subcategory_sort_order(
    session: Session, category_id: int, parent_id: Optional[int]
) -> int:
    stmt = select(func.max(Subcategory.sort_order)).where(
        Subcategory.category_id == category_id
    )
    if parent_id is None:
        stmt = stmt.where(Subcategory.parent_id.is_(None))
    else:
        stmt = stmt.where(Subcategory.parent_id == parent_id)
    result = session.exec(stmt).first()
    if result is None:
        return 0
    if isinstance(result, tuple):
        result = result[0]
    if result is None:
        return 0
    return int(result) + 1


def _sort_subcategories(subs: List[Subcategory]) -> List[Subcategory]:
    return sorted(subs, key=lambda s: (-(s.sort_order or 0), s.id or 0))


def _split_categories(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _join_categories(categories: List[str]) -> str:
    unique: List[str] = []
    for category in categories:
        if category not in unique:
            unique.append(category)
    return ", ".join(unique)


def _ensure_category_present(
    product: Product,
    category_name: str,
    session: Session,
):
    categories = _split_categories(product.category)
    if category_name not in categories:
        categories.append(category_name)
        product.category = _join_categories(categories)
        session.add(product)


def _replace_category(
    product: Product,
    old_category_name: Optional[str],
    new_category_name: str,
    session: Session,
):
    categories = _split_categories(product.category)
    if old_category_name:
        categories = [c for c in categories if c != old_category_name]
    if new_category_name not in categories:
        categories.append(new_category_name)
    if not categories:
        categories = [new_category_name]
    product.category = _join_categories(categories)
    session.add(product)


def _ensure_product_link(
    session: Session,
    product_id: str,
    subcategory_id: int,
):
    existing = session.get(ProductSubcategoryLink, (product_id, subcategory_id))
    if not existing:
        session.add(
            ProductSubcategoryLink(
                product_id=product_id,
                subcategory_id=subcategory_id,
            )
        )


def _get_products_for_subcategory(
    session: Session,
    subcategory_id: int,
) -> List[Product]:
    direct_products = session.exec(
        select(Product)
        .where(Product.subcategory_id == subcategory_id)
        .options(
            selectinload(Product.images),
            selectinload(Product.linked_subcategories),
        )
    ).all()

    linked_products = session.exec(
        select(Product)
        .join(
            ProductSubcategoryLink,
            ProductSubcategoryLink.product_id == Product.id,
        )
        .where(ProductSubcategoryLink.subcategory_id == subcategory_id)
        .options(
            selectinload(Product.images),
            selectinload(Product.linked_subcategories),
        )
    ).all()

    merged: dict[str, Product] = {product.id: product for product in direct_products}
    for product in linked_products:
        merged.setdefault(product.id, product)

    return list(merged.values())


def _collect_subcategory_ids(product: Product) -> List[int]:
    ids: List[int] = []
    if product.subcategory_id:
        ids.append(product.subcategory_id)
    if product.linked_subcategories:
        for sub in product.linked_subcategories:
            if sub.id and sub.id not in ids:
                ids.append(sub.id)
    return ids


def _serialize_product(product: Product, rate: float) -> dict:
    price_usd, price_uah = compute_price_fields(product, rate)
    prod_data = product.model_dump()
    prod_data["priceUSD"] = price_usd
    prod_data["priceUAH"] = price_uah
    prod_data["images"] = [img.url for img in product.images]
    prod_data["subcategory_ids"] = _collect_subcategory_ids(product)
    return prod_data

@router.get("/", response_model=List[CategoryListSchema])
def get_categories(session: Session = Depends(get_session)):
    categories = session.exec(
        select(Category)
        .order_by(Category.sort_order.desc(), Category.id)
    ).all()
    return categories

class ReorderItem(BaseModel):
    id: int
    sort_order: int


@router.post("/reorder", dependencies=[Depends(get_current_admin)])
def reorder_categories(
    payload: List[ReorderItem],
    session: Session = Depends(get_session)
):
    """Зберігає новий порядок категорій після перетягування в адмінці."""
    updated = 0
    for item in payload:
        category = session.get(Category, item.id)
        if not category:
            continue
        category.sort_order = item.sort_order
        session.add(category)
        updated += 1
    session.commit()
    return {"updated": updated}


@router.post("/subcategories/reorder", dependencies=[Depends(get_current_admin)])
def reorder_subcategories(
    payload: List[ReorderItem],
    session: Session = Depends(get_session)
):
    """Новий порядок підкатегорій (розділів) після перетягування."""
    updated = 0
    for item in payload:
        subcategory = session.get(Subcategory, item.id)
        if not subcategory:
            continue
        subcategory.sort_order = item.sort_order
        session.add(subcategory)
        updated += 1
    session.commit()
    return {"updated": updated}


@router.get("/tree")
def get_categories_tree(session: Session = Depends(get_session)):
    """Уся структура каталогу одним легким запитом.

    Категорії (моделі) + усі їхні підкатегорії з `parent_id`. Потрібно, щоб
    адмінка могла мапити товар → модель і → розділ схеми без десяти запитів
    і без здогадок по вільному тексту.
    """
    categories = session.exec(
        select(Category).order_by(Category.sort_order.desc(), Category.id)
    ).all()
    subcategories = session.exec(
        select(Subcategory).order_by(Subcategory.sort_order.desc(), Subcategory.id)
    ).all()

    by_category: dict = {}
    for sub in subcategories:
        by_category.setdefault(sub.category_id, []).append({
            "id": sub.id,
            "name": sub.name,
            "parent_id": sub.parent_id,
            "category_id": sub.category_id,
            "sort_order": sub.sort_order,
        })

    return {
        "categories": [
            {
                "id": category.id,
                "name": category.name,
                "sort_order": category.sort_order,
                "subcategories": by_category.get(category.id, []),
            }
            for category in categories
        ]
    }


@router.get("/{category_id}", response_model=CategoryDetailSchema)
def get_category_details(category_id: int, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
        
    # Load subcategories without products
    subcategories = session.exec(
        select(Subcategory)
        .where(Subcategory.category_id == category_id)
        .order_by(Subcategory.sort_order.desc(), Subcategory.id)
    ).all()

    # Filter for top-level subcategories (no parent)
    root_subs = _sort_subcategories([s for s in subcategories if s.parent_id is None])
    
    cat_data = category.model_dump()
    cat_data["subcategories"] = [
        _serialize_subcategory_tree_no_products(sub, subcategories) 
        for sub in root_subs
    ]
    
    return CategoryDetailSchema(**cat_data)

def _validate_target_parent(
    session: Session,
    target_parent_id: Optional[int],
    target_category_id: int,
    moving_subcategory_id: Optional[int] = None,
) -> Optional[Subcategory]:
    if target_parent_id is None:
        return None

    if moving_subcategory_id is not None and target_parent_id == moving_subcategory_id:
        raise HTTPException(status_code=400, detail="Cannot set a subcategory as its own parent")

    parent = session.get(Subcategory, target_parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Target parent subcategory not found")

    if parent.category_id != target_category_id:
        raise HTTPException(status_code=400, detail="Target parent belongs to another category")

    # Ensure we are not assigning a descendant as parent
    if moving_subcategory_id:
        current = parent
        while current:
            if current.id == moving_subcategory_id:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot move subcategory inside its own descendant",
                )
            if current.parent_id is None:
                break
            current = session.get(Subcategory, current.parent_id)

    return parent


def _update_subtree_category(
    session: Session,
    subcategory: Subcategory,
    new_category_id: int,
    new_category_name: str,
    old_category_name: Optional[str] = None,
):
    subcategory.category_id = new_category_id
    session.add(subcategory)

    products = _get_products_for_subcategory(session, subcategory.id)
    for product in products:
        _replace_category(product, old_category_name, new_category_name, session)

    children = session.exec(
        select(Subcategory).where(Subcategory.parent_id == subcategory.id)
    ).all()
    for child in children:
        _update_subtree_category(
            session,
            child,
            new_category_id,
            new_category_name,
            old_category_name,
        )


def _clone_subcategory_tree(
    session: Session,
    source_subcategory: Subcategory,
    target_category_id: int,
    target_category_name: str,
    parent_id: Optional[int],
) -> Subcategory:
    new_subcategory = Subcategory(
        name=source_subcategory.name,
        code=source_subcategory.code,
        image=source_subcategory.image,
        category_id=target_category_id,
        parent_id=parent_id,
        sort_order=source_subcategory.sort_order,
    )
    session.add(new_subcategory)
    session.flush()  # Get ID for children

    products = _get_products_for_subcategory(session, source_subcategory.id)
    for product in products:
        _ensure_category_present(product, target_category_name, session)
        _ensure_product_link(session, product.id, new_subcategory.id)

    children = session.exec(
        select(Subcategory).where(Subcategory.parent_id == source_subcategory.id)
    ).all()
    for child in children:
        _clone_subcategory_tree(
            session,
            child,
            target_category_id,
            target_category_name,
            new_subcategory.id,
        )

    return new_subcategory


def _load_subcategories_for_category(
    session: Session, category_id: int
) -> List[Subcategory]:
    return session.exec(
        select(Subcategory)
        .where(Subcategory.category_id == category_id)
        .order_by(Subcategory.sort_order.desc(), Subcategory.id)
        .options(selectinload(Subcategory.products))
    ).all()


def _serialize_subcategory_tree(
    root: Subcategory, all_subs: List[Subcategory], session: Session, rate: float
) -> SubcategoryRead:
    sub_data = root.model_dump()
    products = _get_products_for_subcategory(session, root.id)
    sub_data["products"] = [_serialize_product(product, rate) for product in products]

    children = _sort_subcategories([sub for sub in all_subs if sub.parent_id == root.id])
    sub_data["subcategories"] = [
        _serialize_subcategory_tree(child, all_subs, session, rate)
        for child in children
    ]
    return SubcategoryRead(**sub_data)


def _serialize_subcategory_tree_no_products(
    root: Subcategory, all_subs: List[Subcategory]
) -> SubcategoryNoProducts:
    sub_data = root.model_dump()
    
    children = _sort_subcategories([sub for sub in all_subs if sub.parent_id == root.id])
    sub_data["subcategories"] = [
        _serialize_subcategory_tree_no_products(child, all_subs)
        for child in children
    ]
    return SubcategoryNoProducts(**sub_data)


def _build_subcategory_response(
    session: Session, subcategory_id: int, rate: float
) -> SubcategoryRead:
    subcategory = session.exec(
        select(Subcategory)
        .where(Subcategory.id == subcategory_id)
        .options(selectinload(Subcategory.products))
    ).one()
    all_subs = _load_subcategories_for_category(session, subcategory.category_id)
    return _serialize_subcategory_tree(subcategory, all_subs, session, rate)

def _build_category_read_response(session: Session, category: Category) -> CategoryRead:
    rate = get_exchange_rate(session)
    
    # Reload category with subcategories and products for full serialization
    category_with_relations = session.exec(
        select(Category)
        .where(Category.id == category.id)
        .options(
            selectinload(Category.subcategories).selectinload(Subcategory.products).selectinload(Product.images),
            selectinload(Category.subcategories).selectinload(Subcategory.children)
        )
    ).first()

    if not category_with_relations:
        raise HTTPException(status_code=404, detail="Category not found after refresh")

    cat_data = category_with_relations.model_dump()
    
    # Filter for top-level subcategories (no parent)
    root_subs = [s for s in category_with_relations.subcategories if s.parent_id is None]
    
    # Build tree for each root subcategory
    cat_data["subcategories"] = [
        _serialize_subcategory_tree(sub, category_with_relations.subcategories, session, rate)
        for sub in root_subs
    ]
        
    return CategoryRead(**cat_data)

@router.post("/", response_model=CategoryRead, dependencies=[Depends(get_current_admin)])
async def create_category(
    name: str = Form(...),
    image: str = Form(None),
    file: UploadFile = File(None),
    sort_order: Optional[int] = Form(None),
    meta_title: Optional[str] = Form(None),
    meta_description: Optional[str] = Form(None),
    session: Session = Depends(get_session)
):
    # Handle file upload
    image_url = image
    if file and file.filename:
        image_url = await image_uploader.upload_image(file, folder="tesla-parts/categories")

    if sort_order is None:
        min_order = session.exec(select(func.min(Category.sort_order))).one()
        sort_order = (min_order - 10) if min_order is not None else 1000

    db_category = Category(
        name=name,
        image=image_url,
        sort_order=sort_order,
        meta_title=meta_title or None,
        meta_description=meta_description or None,
    )
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return _build_category_read_response(session, db_category) # Use helper for response

@router.post("/{category_id}/subcategories/", response_model=SubcategoryRead, dependencies=[Depends(get_current_admin)])
async def create_subcategory(
    category_id: int,
    name: str = Form(...),
    code: Optional[str] = Form(None),
    parent_id: Optional[int] = Form(None),
    image: Optional[str] = Form(None),
    file: UploadFile = File(None),
    sort_order: Optional[int] = Form(None),
    session: Session = Depends(get_session)
):
    # Handle file upload
    image_url = image
    if file and file.filename:
        image_url = await image_uploader.upload_image(file, folder="tesla-parts/subcategories")

    parent_value = parent_id if parent_id is not None else None
    
    if sort_order is None:
        query = select(func.min(Subcategory.sort_order)).where(Subcategory.category_id == category_id)
        if parent_value is None:
            query = query.where(Subcategory.parent_id.is_(None))
        else:
            query = query.where(Subcategory.parent_id == parent_value)
        
        min_order = session.exec(query).one()
        sort_order = (min_order - 10) if min_order is not None else 1000

    db_subcategory = Subcategory(
        name=name,
        code=code,
        category_id=category_id,
        parent_id=parent_value,
        image=image_url,
        sort_order=sort_order,
    )
    session.add(db_subcategory)
    session.commit()
    rate = get_exchange_rate(session)
    return _build_subcategory_response(session, db_subcategory.id, rate)

@router.put("/{category_id}", response_model=CategoryRead, dependencies=[Depends(get_current_admin)])
async def update_category(
    category_id: int,
    name: str = Form(...),
    image: str = Form(None),
    file: UploadFile = File(None),
    sort_order: Optional[int] = Form(None),
    meta_title: Optional[str] = Form(None),
    meta_description: Optional[str] = Form(None),
    session: Session = Depends(get_session)
):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category.name = name
    if sort_order is not None:
        category.sort_order = sort_order
    if meta_title is not None:
        category.meta_title = meta_title or None
    if meta_description is not None:
        category.meta_description = meta_description or None
    
    # Handle file upload
    if file and file.filename:
        image_url = await image_uploader.upload_image(file, folder="tesla-parts/categories")
        if image_url:
            category.image = image_url
    elif image:
        category.image = image
        
    session.add(category)
    session.commit()
    session.refresh(category)
    return _build_category_read_response(session, category) # Use helper for response

@router.put("/subcategories/{subcategory_id}", response_model=SubcategoryRead, dependencies=[Depends(get_current_admin)])
async def update_subcategory(
    subcategory_id: int,
    name: str = Form(...),
    code: Optional[str] = Form(None),
    parent_id: Optional[int] = Form(None),
    image: Optional[str] = Form(None),
    file: UploadFile = File(None),
    sort_order: Optional[int] = Form(None),
    session: Session = Depends(get_session)
):
    subcategory = session.get(Subcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
        
    subcategory.name = name
    subcategory.code = code
    # Only update parent_id if it's provided (or explicitly None if we want to move to root, but Form(None) makes it hard to distinguish missing vs null. 
    # For now assume if provided it changes. If not provided (None), keep existing? 
    # Actually Form(None) means it defaults to None if not sent. 
    # Let's assume we send current value if not changing.
    if parent_id is not None:
        subcategory.parent_id = parent_id
    if sort_order is not None:
        subcategory.sort_order = sort_order
        
    # Handle file upload
    if file and file.filename:
        image_url = await image_uploader.upload_image(file, folder="tesla-parts/subcategories")
        if image_url:
            subcategory.image = image_url
    elif image:
        subcategory.image = image
        
    session.add(subcategory)
    session.commit()
    rate = get_exchange_rate(session)
    return _build_subcategory_response(session, subcategory.id, rate)

@router.post("/subcategories/{subcategory_id}/move", response_model=SubcategoryRead, dependencies=[Depends(get_current_admin)])
def move_subcategory(
    subcategory_id: int,
    transfer: SubcategoryTransferRequest,
    session: Session = Depends(get_session),
):
    subcategory = session.get(Subcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    target_category = session.get(Category, transfer.target_category_id)
    if not target_category:
        raise HTTPException(status_code=404, detail="Target category not found")
    source_category = session.get(Category, subcategory.category_id)
    old_category_name = source_category.name if source_category else None

    _validate_target_parent(
        session,
        transfer.target_parent_id,
        transfer.target_category_id,
        moving_subcategory_id=subcategory_id,
    )

    _update_subtree_category(
        session,
        subcategory,
        transfer.target_category_id,
        target_category.name,
        old_category_name,
    )
    subcategory.parent_id = transfer.target_parent_id

    session.add(subcategory)
    session.commit()
    rate = get_exchange_rate(session)
    return _build_subcategory_response(session, subcategory.id, rate)


@router.post("/subcategories/{subcategory_id}/copy", response_model=SubcategoryRead, dependencies=[Depends(get_current_admin)])
def copy_subcategory(
    subcategory_id: int,
    transfer: SubcategoryTransferRequest,
    session: Session = Depends(get_session),
):
    source_subcategory = session.get(Subcategory, subcategory_id)
    if not source_subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")

    target_category = session.get(Category, transfer.target_category_id)
    if not target_category:
        raise HTTPException(status_code=404, detail="Target category not found")

    _validate_target_parent(
        session,
        transfer.target_parent_id,
        transfer.target_category_id,
        moving_subcategory_id=None,
    )

    new_subcategory = _clone_subcategory_tree(
        session,
        source_subcategory,
        transfer.target_category_id,
        target_category.name,
        transfer.target_parent_id,
    )
    session.commit()
    rate = get_exchange_rate(session)
    return _build_subcategory_response(session, new_subcategory.id, rate)


def _has_products(session: Session, subcategory_id: int) -> bool:
    # Check direct assignment
    count_direct = session.exec(
        select(func.count(Product.id)).where(Product.subcategory_id == subcategory_id)
    ).one()
    if count_direct > 0:
        return True
        
    # Check linked assignment
    count_linked = session.exec(
        select(func.count(ProductSubcategoryLink.product_id)).where(ProductSubcategoryLink.subcategory_id == subcategory_id)
    ).one()
    if count_linked > 0:
        return True
        
    return False

def _collect_descendant_ids(session: Session, subcategory_id: int) -> List[int]:
    ids = [subcategory_id]
    children = session.exec(select(Subcategory).where(Subcategory.parent_id == subcategory_id)).all()
    for child in children:
        ids.extend(_collect_descendant_ids(session, child.id))
    return ids

@router.delete("/{category_id}", dependencies=[Depends(get_current_admin)])
def delete_category(category_id: int, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Get all subcategories
    subcategories = session.exec(
        select(Subcategory).where(Subcategory.category_id == category_id)
    ).all()
    
    subcategory_ids = [s.id for s in subcategories]
    
    # Check for products in any subcategory
    for sub_id in subcategory_ids:
        if _has_products(session, sub_id):
            raise HTTPException(
                status_code=400, 
                detail="Категорія не пуста. Видалення неможливе"
            )
            
    if subcategory_ids:
        # 1. Break parent/child relationships to avoid FK constraints during deletion
        # It is safer to update them to NULL first
        session.exec(
            select(Subcategory).where(Subcategory.category_id == category_id)
        ) 
        # Actually, simple update statement is better
        # But SQLModel/SQLAlchemy update syntax:
        for sub in subcategories:
            sub.parent_id = None
            session.add(sub)
        session.flush()

        # 2. Delete links
        session.exec(
            delete(ProductSubcategoryLink).where(
                ProductSubcategoryLink.subcategory_id.in_(subcategory_ids)
            )
        )
        
        # 3. Delete subcategories
        for sub in subcategories:
            session.delete(sub)
            
    session.delete(category)
    session.commit()
    return {"ok": True}

@router.delete("/subcategories/{subcategory_id}", dependencies=[Depends(get_current_admin)])
def delete_subcategory(subcategory_id: int, session: Session = Depends(get_session)):
    subcategory = session.get(Subcategory, subcategory_id)
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategory not found")
        
    # Collect all descendants (including self)
    target_ids = _collect_descendant_ids(session, subcategory_id)
    
    # Check products
    for tid in target_ids:
        if _has_products(session, tid):
            raise HTTPException(
                status_code=400, 
                detail="Категорія не пуста. Видалення неможливе"
            )
    
    # Safe delete
    # 1. Break parent relationships for the tree (or just for those being deleted)
    # Finding objects to delete
    targets = session.exec(select(Subcategory).where(Subcategory.id.in_(target_ids))).all()
    
    for t in targets:
        t.parent_id = None
        session.add(t)
    session.flush()
    
    # 2. Delete links
    session.exec(
        delete(ProductSubcategoryLink).where(
            ProductSubcategoryLink.subcategory_id.in_(target_ids)
        )
    )
    
    # 3. Delete subcategories
    for t in targets:
        session.delete(t)
        
    session.commit()
    return {"ok": True}
