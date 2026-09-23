from pydantic import BaseModel
from typing import List
from datetime import datetime

class ProductBase(BaseModel):
    id: str
    name: str
    category: str
    priceUSD: float | None = None
    priceUAH: float
    image: str
    description: str
    inStock: bool
    sort_order: int | None = 0
    detail_number: str | None = None
    cross_number: str | None = None # Made optional
    search_keywords: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    is_popular: bool = False
    part_type: str | None = None
    created_at: datetime | None = None


class CartItem(ProductBase):
    quantity: int

class Customer(BaseModel):
    firstName: str
    lastName: str
    phone: str

class Delivery(BaseModel):
    city: str
    branch: str

class ProductCreate(ProductBase):
    subcategory_id: int | None = None

class ProductRead(ProductBase):
    subcategory_id: int | None = None
    subcategory_ids: List[int] = []
    images: List[str] = []
    created_at: datetime | None = None

class SubcategoryRead(BaseModel):
    id: int
    name: str
    code: str | None = None
    image: str | None = None
    category_id: int
    parent_id: int | None = None
    sort_order: int | None = None
    products: List[ProductRead] = []
    subcategories: List["SubcategoryRead"] = []

class CategoryRead(BaseModel):
    id: int
    name: str
    image: str | None = None
    sort_order: int
    meta_title: str | None = None
    meta_description: str | None = None
    subcategories: List[SubcategoryRead] = []

class CategoryCreate(BaseModel):
    name: str
    image: str | None = None
    sort_order: int | None = None
    meta_title: str | None = None
    meta_description: str | None = None

class SubcategoryCreate(BaseModel):
    name: str
    code: str | None = None
    image: str | None = None
    category_id: int
    parent_id: int | None = None
    sort_order: int | None = None


class SubcategoryTransferRequest(BaseModel):
    target_category_id: int
    target_parent_id: int | None = None

class OrderCreate(BaseModel):
    items: List[CartItem]
    totalUSD: float | None = None
    customer: Customer
    delivery: Delivery
    paymentMethod: str
    ttn: str | None = None # Added TTN field
    note: str | None = None
    promocode: str | None = None

class OrderItemRead(BaseModel):
    product_id: str | None = None
    product_name: str | None = None
    product_image: str | None = None
    product_detail_number: str | None = None
    quantity: int
    price_at_purchase: float

class OrderRead(BaseModel):
    id: int
    status: str
    totalUSD: float
    totalUAH: float = 0.0
    customer_first_name: str
    customer_last_name: str
    customer_phone: str
    delivery_city: str
    delivery_branch: str
    payment_method: str
    ttn: str | None = None # Added TTN field
    note: str | None = None
    created_at: datetime
    items: List[OrderItemRead]


class ProductBulkDeleteRequest(BaseModel):
    product_ids: List[str]

class ProductReorderRequest(BaseModel):
    product_ids: List[str]

class SocialLinks(BaseModel):
    instagram: str | None = None
    telegram: str | None = None
    viber: str | None = None

class StaticPageSEOBase(BaseModel):
    slug: str
    meta_title: str | None = None
    meta_description: str | None = None

class StaticPageSEORead(StaticPageSEOBase):
    id: int

class StaticPageSEOUpdate(BaseModel):
    meta_title: str | None = None
    meta_description: str | None = None


# --- Optimized Schemas for Lazy Loading ---

class SubcategoryNoProducts(BaseModel):
    id: int
    name: str
    code: str | None = None
    image: str | None = None
    category_id: int
    parent_id: int | None = None
    sort_order: int | None = None
    subcategories: List["SubcategoryNoProducts"] = []

class CategoryListSchema(BaseModel):
    id: int
    name: str
    image: str | None = None
    sort_order: int
    meta_title: str | None = None
    meta_description: str | None = None
    # Показувати модель у «Схемах запчастин (EPC)». Без цього поля адмінка
    # завжди показувала «увімкнено», хоч би що було в базі.
    show_in_schematics: bool = True

class CategoryDetailSchema(CategoryListSchema):
    subcategories: List[SubcategoryNoProducts] = []

class ReviewCreate(BaseModel):
    image_url: str
    sort_order: int | None = 0

class ReviewRead(BaseModel):
    id: int
    image_url: str
    created_at: datetime
    sort_order: int

class ReviewReorderRequest(BaseModel):
    review_ids: List[int]

class CustomerRegisterRequest(BaseModel):
    email: str

class CustomerVerifyRequest(BaseModel):
    verification_token: str
    password: str
    confirm_password: str

class CustomerLoginRequest(BaseModel):
    email: str
    password: str

class CustomerProfileUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    default_address: str | None = None
    cart_data: str | None = None

class CustomerProfileRead(BaseModel):
    email: str
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    default_address: str | None = None
    discount_type: str | None = None
    discount_value: float | None = None
    cart_data: str | None = None

class CustomerForgotPasswordRequest(BaseModel):
    email: str


class GarageCarBase(BaseModel):
    vin: str | None = None
    plate: str | None = None
    model: str
    generation: str | None = None
    year: int | None = None
    drive: str | None = None
    plant: str | None = None
    body_type: str | None = None
    description: str | None = None


class GarageCarCreate(GarageCarBase):
    """Додавання авто. `make_active` — зробити його активним для підбору."""

    make_active: bool = True


class GarageCarUpdate(BaseModel):
    plate: str | None = None
    model: str | None = None
    generation: str | None = None
    year: int | None = None
    drive: str | None = None
    description: str | None = None
    is_active: bool | None = None


class GarageCarRead(GarageCarBase):
    id: int
    is_active: bool
    created_at: datetime | None = None


class GarageImportRequest(BaseModel):
    """Перенесення гаража, який лежав у браузері, в акаунт при вході."""

    cars: list[GarageCarBase] = []
    active_vin: str | None = None

class CustomerResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class AdminDiscountUpdateRequest(BaseModel):
    discount_type: str | None = None
    discount_value: float | None = None

class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    scope: str
    is_active: bool = True
    customer_ids: List[int] | None = None

class PromoCodeRead(BaseModel):
    id: int
    code: str
    discount_type: str
    discount_value: float
    scope: str
    is_active: bool
    created_at: datetime
    customer_ids: List[int] = []

class PromoCodeValidateRequest(BaseModel):
    code: str

class PromoCodeValidateResponse(BaseModel):
    valid: bool
    discount_type: str | None = None
    discount_value: float | None = None
    message: str | None = None

class EmailListCreate(BaseModel):
    name: str
    customer_ids: List[int] = []

class EmailListUpdate(BaseModel):
    name: str | None = None
    customer_ids: List[int] | None = None

class CustomerBasicRead(BaseModel):
    id: int
    email: str
    first_name: str | None = None
    last_name: str | None = None

class EmailListRead(BaseModel):
    id: int
    name: str
    created_at: datetime
    customers: List[CustomerBasicRead] = []

class EmailCampaignSendRequest(BaseModel):
    subject: str
    body: str

class DirectEmailCampaignRequest(BaseModel):
    subject: str
    body: str
    customer_ids: List[int] = []
    emails: List[str] = []


class HotspotVariant(BaseModel):
    id: str | None = None
    name: str
    type: str | None = "original"
    condition: str | None = "used"
    priceUAH: float = 0.0
    priceUSD: float = 0.0
    inStock: bool = True
    product_id: str | None = None
    # Фото товару з каталогу — щоб у кошику була картинка деталі, а не креслення
    image: str | None = None


class SchematicHotspotBase(BaseModel):
    number: int
    x: float
    y: float
    part_number: str | None = None
    name: str
    product_id: str | None = None
    variants_json: str | None = None
    sort_order: int = 0


class SchematicHotspotCreate(SchematicHotspotBase):
    pass


class SchematicHotspotRead(SchematicHotspotBase):
    id: int
    schematic_id: int
    product: ProductRead | None = None
    variants: List[HotspotVariant] = []


class SchematicBase(BaseModel):
    title: str
    model: str
    generation: str
    section: str
    subsystem: str
    image_url: str
    sort_order: int = 0


class SchematicCreate(SchematicBase):
    hotspots: List[SchematicHotspotCreate] = []


class SchematicUpdate(BaseModel):
    title: str | None = None
    model: str | None = None
    generation: str | None = None
    section: str | None = None
    subsystem: str | None = None
    image_url: str | None = None
    sort_order: int | None = None
    hotspots: List[SchematicHotspotCreate] | None = None


class SchematicRead(SchematicBase):
    id: int
    created_at: datetime | None = None
    hotspots: List[SchematicHotspotRead] = []


class SchematicMatchedPart(BaseModel):
    """Деталь схеми, що збіглася з пошуковим запитом.

    Потрібно, щоб у магазині було видно ПРИЧИНУ: зайшов за кодом товару —
    бачиш, на якій точці схеми ця деталь стоїть.
    """
    number: int
    part_number: str | None = None
    name: str | None = None
    product_id: str | None = None


class SchematicSummary(SchematicBase):
    id: int
    created_at: datetime | None = None
    hotspots_count: int = 0
    matched_parts: List[SchematicMatchedPart] = []


class VinDecodeResult(BaseModel):
    vin: str
    is_valid: bool
    make: str = "Tesla"
    model: str
    generation: str
    year: int
    plant: str
    drive: str
    trim: str | None = None
    body_type: str
    description: str


class PlateLookupResult(BaseModel):
    plate: str
    vin: str
    mark: str
    model: str
    year: int
    is_tesla: bool
    tesla_specs: VinDecodeResult | None = None
    message: str | None = None

