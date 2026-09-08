from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, ForeignKey, String
from datetime import datetime
from zoneinfo import ZoneInfo

def get_kyiv_time():
    return datetime.now(ZoneInfo("Europe/Kyiv")).replace(tzinfo=None)

class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    image: Optional[str] = None
    sort_order: int = Field(default=0, index=True)
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    
    subcategories: List["Subcategory"] = Relationship(back_populates="category")

class ProductSubcategoryLink(SQLModel, table=True):
    product_id: str = Field(foreign_key="product.id", primary_key=True)
    subcategory_id: int = Field(foreign_key="subcategory.id", primary_key=True)


class Subcategory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    code: Optional[str] = None
    image: Optional[str] = None
    category_id: int = Field(foreign_key="category.id")
    parent_id: Optional[int] = Field(default=None, foreign_key="subcategory.id")
    sort_order: int = Field(default=0, index=True)
    
    category: Category = Relationship(back_populates="subcategories")
    parent: Optional["Subcategory"] = Relationship(back_populates="children", sa_relationship_kwargs={"remote_side": "Subcategory.id"})
    children: List["Subcategory"] = Relationship(back_populates="parent")
    products: List["Product"] = Relationship(back_populates="subcategory")
    linked_products: List["Product"] = Relationship(
        back_populates="linked_subcategories",
        link_model=ProductSubcategoryLink,
    )

class Product(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    category: str # Deprecated, keeping for backward compatibility
    subcategory_id: Optional[int] = Field(default=None, foreign_key="subcategory.id")
    priceUAH: float
    priceUSD: float = Field(default=0.0)
    image: str
    description: str
    inStock: bool
    sort_order: int = Field(default=0, index=True)
    detail_number: Optional[str] = None
    cross_number: Optional[str] = None # Made optional
    search_keywords: Optional[str] = None # Hidden synonyms/keywords for search
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    is_popular: bool = Field(default=False, index=True)
    part_type: Optional[str] = Field(default=None, index=True) # 'original', 'analog', or None (auto)
    created_at: datetime = Field(default_factory=get_kyiv_time)
    
    subcategory: Optional[Subcategory] = Relationship(back_populates="products")
    linked_subcategories: List[Subcategory] = Relationship(
        back_populates="linked_products",
        link_model=ProductSubcategoryLink,
    )
    images: List["ProductImage"] = Relationship(back_populates="product", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class ProductImage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: str = Field(foreign_key="product.id")
    url: str
    
    product: Product = Relationship(back_populates="images")

class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    customer_first_name: str
    customer_last_name: str
    customer_phone: str
    delivery_city: str
    delivery_branch: str
    payment_method: str
    totalUSD: float
    created_at: datetime = Field(default_factory=get_kyiv_time)
    status: str = Field(default="new")
    ttn: Optional[str] = None # Added TTN field
    note: Optional[str] = None # Added note field
    customer_id: Optional[int] = Field(default=None, foreign_key="customer.id")
    
    items: List["OrderItem"] = Relationship(back_populates="order")

class OrderItem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: Optional[int] = Field(default=None, foreign_key="order.id")
    product_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String, ForeignKey("product.id", ondelete="SET NULL"), nullable=True)
    )
    product_name: str = Field(default="Unknown Product")
    product_image: Optional[str] = None
    product_detail_number: Optional[str] = None
    quantity: int
    price_at_purchase: float
    
    order: Optional[Order] = Relationship(back_populates="items")
    product: Optional["Product"] = Relationship()

class Settings(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str

class Page(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    title: str
    content: str
    is_published: bool = Field(default=True)
    location: str = Field(default="footer") # header, footer, both, none

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    refresh_token: Optional[str] = None # New field for refresh token

class StaticPageSEO(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

class Review(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    image_url: str
    created_at: datetime = Field(default_factory=get_kyiv_time)
    sort_order: int = Field(default=0, index=True)

class CustomerPromoCodeLink(SQLModel, table=True):
    customer_id: int = Field(foreign_key="customer.id", primary_key=True)
    promocode_id: int = Field(foreign_key="promocode.id", primary_key=True)

class CustomerEmailListLink(SQLModel, table=True):
    customer_id: int = Field(foreign_key="customer.id", primary_key=True)
    email_list_id: int = Field(foreign_key="emaillist.id", primary_key=True)

class EmailList(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=get_kyiv_time)

    customers: List["Customer"] = Relationship(
        back_populates="email_lists", link_model=CustomerEmailListLink
    )

class Customer(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email_hash: str = Field(unique=True, index=True)
    encrypted_email: str
    encrypted_first_name: Optional[str] = None
    encrypted_last_name: Optional[str] = None
    encrypted_phone: Optional[str] = None
    encrypted_default_address: Optional[str] = None
    hashed_password: Optional[str] = None
    is_verified: bool = Field(default=False)
    verification_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    reset_token_hash: Optional[str] = None
    reset_token_expires: Optional[datetime] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    cart_data: Optional[str] = None
    created_at: datetime = Field(default_factory=get_kyiv_time)

    promocodes: List["PromoCode"] = Relationship(
        back_populates="customers", link_model=CustomerPromoCodeLink
    )
    email_lists: List["EmailList"] = Relationship(
        back_populates="customers", link_model=CustomerEmailListLink
    )

class PromoCode(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True)
    discount_type: str # 'percent', 'usd', 'uah'
    discount_value: float
    scope: str # 'everyone', 'selected'
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=get_kyiv_time)

    customers: List[Customer] = Relationship(
        back_populates="promocodes", link_model=CustomerPromoCodeLink
    )

