import requests
from models import Order, Product, Settings
from sqlmodel import Session
from database import engine
from services.pricing import get_exchange_rate

def _get_setting_value(session: Session, key: str) -> str | None:
    setting = session.get(Settings, key)
    return setting.value if setting else None

def send_plain_message(text: str) -> bool:
    """Надіслати довільний текст у чат власника. True якщо відправлено."""
    try:
        with Session(engine) as session:
            bot_token = _get_setting_value(session, "telegram_bot_token")
            chat_id = _get_setting_value(session, "telegram_chat_id")
        if not bot_token or not chat_id or "YOUR_" in bot_token:
            print("Telegram credentials not set, skipping message")
            return False
        url = "https://api.telegram.org/bot%s/sendMessage" % bot_token
        requests.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=15,
        )
        return True
    except Exception as e:
        print("Failed to send telegram message: %s" % e)
        return False


def notify_admin_new_client(client_email: str) -> None:
    """Сповіщення власнику в Telegram про нового зареєстрованого клієнта."""
    try:
        send_plain_message(
            "<b>Новий клієнт зареєструвався</b>
%s" % client_email
        )
    except Exception as e:
        print("admin tg notify failed: %s" % e)


def send_telegram_notification(order: Order):
    with Session(engine) as session:
        bot_token = _get_setting_value(session, "telegram_bot_token")
        chat_id = _get_setting_value(session, "telegram_chat_id")
        rate = get_exchange_rate(session)

        if not bot_token or not chat_id or "YOUR_" in bot_token:
            print("Telegram credentials not set, skipping notification")
            return

        created = order.created_at.strftime("%d.%m.%Y %H:%M") if order.created_at else ""
        message = f"<b>Нове замовлення #{order.id}</b>\n"
        if created:
            message += f"<b>Створено</b>: {created}\n"
        total_usd = order.totalUSD or 0
        legacy_mode = total_usd <= 0
        if legacy_mode:
            legacy_total = 0.0
            for item in order.items:
                price = item.price_at_purchase or 0
                legacy_total += (price / rate if rate else price) * item.quantity
            total_usd = round(legacy_total, 2)
        total_uah = round(total_usd * rate, 2)
        message += f"<b>Покупець</b>: {order.customer_first_name} {order.customer_last_name}\n"
        message += f"<b>Телефон</b>: {order.customer_phone}\n"
        message += f"<b>Доставка</b>: {order.delivery_city}, {order.delivery_branch}\n"
        message += f"<b>Сума</b>: {total_usd:.2f} USD ({total_uah} UAH)\n"
        message += f"<b>Оплата</b>: {order.payment_method}\n"
        if order.note:
            message += f"<b>Коментар</b>: {order.note}\n"
        message += "<b>Товари</b>:\n"

        for item in order.items:
            usd_price = item.price_at_purchase or 0
            if legacy_mode:
                usd_price = usd_price / rate if rate else usd_price
            uah_price = round(usd_price * rate, 2)
            
            detail_number = item.product_detail_number or "N/A"
            product_name = item.product_name
            
            if item.quantity > 1:
                item_total_usd = usd_price * item.quantity
                item_total_uah = uah_price * item.quantity
                price_str = f"{item_total_usd:.2f} USD ({item_total_uah:.2f} UAH)"
            else:
                price_str = f"{usd_price:.2f} USD ({uah_price:.2f} UAH)"
            
            message += (
                f"- <b>{detail_number}</b> {product_name} <b>{item.quantity} шт.</b> "
                f"(<b>{price_str}</b>)\n"
            )

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }
    try:
        requests.post(url, json=payload)
    except Exception as e:
        print(f"Failed to send telegram notification: {e}")
