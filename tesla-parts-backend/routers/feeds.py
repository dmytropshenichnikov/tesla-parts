import logging
import xml.sax.saxutils as saxutils
from typing import List
from fastapi import APIRouter, Depends, Response, HTTPException
from sqlmodel import Session, select
from sqlalchemy.orm import selectinload
from database import get_session
from models import Product, Category, Subcategory
from services.pricing import get_exchange_rate, compute_price_fields
from services import part_numbers
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)
GOOGLE_CATEGORY = "5613"
GOOGLE_PRODUCT_TYPE = "Автозапчастини"


router = APIRouter(prefix="/feed", tags=["feeds"])

# Base URL for the shop - should ideally be in environment variables
SHOP_BASE_URL = "https://teslapartscenter.com.ua"

async def get_active_products(session: Session) -> List[Product]:
    """
    Fetches all products from the database.
    In a production scenario, you might want to filter by 'is_active' or similar.
    """
    statement = select(Product).options(selectinload(Product.images))
    results = session.exec(statement)
    return results.all()

@router.get("/google-merchant.xml")
async def get_google_merchant_feed(session: Session = Depends(get_session)):
    """
    Generates a dynamic XML feed for Google Merchant Center in RSS 2.0 format.
    """
    try:
        products = await get_active_products(session)
        rate = get_exchange_rate(session)

        # XML Header and Channel metadata
        xml_output = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
            '<channel>',
            f'<title>{saxutils.escape("Tesla Parts Center")}</title>',
            f'<link>{SHOP_BASE_URL}</link>',
            f'<description>{saxutils.escape("Запчастини для Tesla з доставкою по Україні")}</description>'
        ]

        for product in products:
            # Calculate current prices based on exchange rate
            _, price_uah = compute_price_fields(product, rate)
            
            # Google required fields mapping
            p_id = saxutils.escape(str(product.id))
            p_title = saxutils.escape(part_numbers.feed_title(product.name, product.detail_number))
            p_description = saxutils.escape(product.description or product.name)
            p_link = f"{SHOP_BASE_URL}/product/{product.id}"
            p_image_link = saxutils.escape(product.image) if product.image else ""
            p_price = f"{price_uah:.2f} UAH"
            p_availability = "in_stock" if product.inStock else "out_of_stock"
            p_condition = "new" # Default for Tesla Parts shop
            p_brand = saxutils.escape("Tesla")

            additional_images_xml = ""
            if hasattr(product, "images") and product.images:
                added_images = 0
                for img in product.images:
                    if added_images >= 10:
                        break
                    if img.url != product.image:
                        additional_images_xml += f"\n            <g:additional_image_link>{saxutils.escape(img.url)}</g:additional_image_link>"
                        added_images += 1

            # Construct item XML
            item_xml = f"""
        <item>
            <g:id>{p_id}</g:id>
            <g:title>{p_title}</g:title>
            <g:description>{p_description}</g:description>
            <g:link>{p_link}</g:link>
            <g:image_link>{p_image_link}</g:image_link>{additional_images_xml}
            <g:condition>{p_condition}</g:condition>
            <g:availability>{p_availability}</g:availability>
            <g:price>{p_price}</g:price>
            <g:brand>{p_brand}</g:brand>
            <g:product_type>{GOOGLE_PRODUCT_TYPE}</g:product_type>
            <g:google_product_category>{GOOGLE_CATEGORY}</g:google_product_category>    
        </item>"""
            xml_output.append(item_xml)

        # Close tags
        xml_output.append('</channel>')
        xml_output.append('</rss>')

        full_xml = "".join(xml_output)

        return Response(content=full_xml, media_type="application/xml")

    except Exception as e:
        logger.error(f"Failed to generate Google Merchant feed: {str(e)}", exc_info=True)
        # Return 500 without crashing the server
        raise HTTPException(status_code=500, detail="Internal Server Error: Failed to generate feed")

@router.get("/prom-ua.xml")
async def get_prom_ua_feed(session: Session = Depends(get_session)):
    """
    Generates a dynamic XML feed for Prom.ua in YML format.
    """
    try:
        products = await get_active_products(session)
        categories = session.exec(select(Category)).all()
        subcategories = session.exec(select(Subcategory)).all()
        rate = get_exchange_rate(session)
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M")

        xml_output = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<!DOCTYPE yml_catalog SYSTEM "shops.dtd">',
            f'<yml_catalog date="{current_time}">',
            '<shop>',
            '<name>Tesla Parts Center</name>',
            '<company>Tesla Parts Center</company>',
            f'<url>{SHOP_BASE_URL}</url>',
            '<currencies>',
            '<currency id="UAH" rate="1"/>',
            '</currencies>',
            '<categories>'
        ]

        # Add top-level categories
        for cat in categories:
            # Multiply category ID by 1,000,000 to avoid ID collisions with subcategories
            cat_id = cat.id * 1000000
            xml_output.append(f'<category id="{cat_id}">{saxutils.escape(cat.name)}</category>')
        
        # Add subcategories
        for sub in subcategories:
            if sub.parent_id:
                parent_id = sub.parent_id
            else:
                parent_id = sub.category_id * 1000000
            xml_output.append(f'<category id="{sub.id}" parentId="{parent_id}">{saxutils.escape(sub.name)}</category>')
            
        xml_output.append('</categories>')
        xml_output.append('<offers>')

        for product in products:
            _, price_uah = compute_price_fields(product, rate)
            p_id = saxutils.escape(str(product.id))
            p_title = saxutils.escape(product.name)
            
            # handle CDATA for description
            desc = product.description or product.name
            desc = desc.replace(']]>', ']]]]><![CDATA[>')
            p_description = f"<![CDATA[{desc}]]>"
            
            p_link = f"{SHOP_BASE_URL}/product/{product.id}"
            p_image_link = saxutils.escape(product.image) if product.image else ""
            p_price = f"{price_uah:.2f}"
            available_str = "true" if product.inStock else "false"
            in_stock_str = "true" if product.inStock else "false"

            # Category ID for the product
            # Use product.subcategory_id. If missing, fallback to a top level category if exists, or "1".
            if product.subcategory_id:
                p_cat_id = str(product.subcategory_id)
            elif categories:
                p_cat_id = str(categories[0].id * 1000000)
            else:
                p_cat_id = "1"

            item_xml = [
                f'<offer id="{p_id}" available="{available_str}" in_stock="{in_stock_str}">',
                f'<name>{p_title}</name>',
                f'<categoryId>{p_cat_id}</categoryId>',
                f'<price>{p_price}</price>',
                '<currencyId>UAH</currencyId>'
            ]
            
            if p_image_link:
                item_xml.append(f'<picture>{p_image_link}</picture>')
            
            # Handle additional images (Prom allows up to 10 pictures total)
            if hasattr(product, "images") and product.images:
                added_images = 1 if p_image_link else 0
                for img in product.images:
                    if added_images >= 10:
                        break
                    # Avoid duplicate of main image if it happens to be in the images list
                    if img.url != product.image:
                        item_xml.append(f'<picture>{saxutils.escape(img.url)}</picture>')
                        added_images += 1

            item_xml.append(f'<description>{p_description}</description>')
            
            if product.detail_number:
                item_xml.append(f'<vendorCode>{saxutils.escape(product.detail_number)}</vendorCode>')
            
            item_xml.append('<vendor>Tesla</vendor>')
            item_xml.append('</offer>')
            
            xml_output.append("".join(item_xml))
            
        xml_output.append('</offers>')
        xml_output.append('</shop>')
        xml_output.append('</yml_catalog>')

        full_xml = "".join(xml_output)

        return Response(content=full_xml, media_type="application/xml")

    except Exception as e:
        logger.error(f"Failed to generate Prom.ua feed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error: Failed to generate feed")
