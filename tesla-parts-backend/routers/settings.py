from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select
from database import get_session
from models import Settings, User
from pydantic import BaseModel
from typing import List
from schemas import SocialLinks
from auth import verify_token
import os
from dependencies import get_current_admin

# Keys the public storefront is allowed to read without a token.
# Everything else (telegram_bot_token, telegram_chat_id, ...) is admin-only:
# this endpoint used to return any key to anyone, which leaked the bot token.
PUBLIC_SETTING_KEYS = frozenset(
    {
        "contact_email",
        "contact_phone",
        "footer_description",
        "footer_text",
        "exchange_rate",
        "working_hours",
        "instagram_link",
        "telegram_link",
        "viber_link",
        "email_footer",
    }
)


def _admin_from_request(request: Request, session: Session) -> User | None:
    """Best-effort admin lookup from the Authorization header (None if absent/invalid)."""
    header = request.headers.get("Authorization") or ""
    if not header.startswith("Bearer "):
        return None
    payload = verify_token(header.split(" ", 1)[1])
    if not payload:
        return None
    username = payload.get("sub")
    if not username:
        return None
    return session.exec(select(User).where(User.username == username)).first()



router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)

class SettingUpdate(BaseModel):
    value: str

@router.get("/social-links", response_model=SocialLinks)
def get_social_links(session: Session = Depends(get_session)):
    instagram_link = session.get(Settings, "instagram_link")
    telegram_link = session.get(Settings, "telegram_link")
    viber_link = session.get(Settings, "viber_link")
    return SocialLinks(
        instagram=instagram_link.value if instagram_link else "",
        telegram=telegram_link.value if telegram_link else "",
        viber=viber_link.value if viber_link else ""
    )

@router.post("/social-links", dependencies=[Depends(get_current_admin)])
def update_social_links(links: SocialLinks, session: Session = Depends(get_session)):
    instagram_link = session.get(Settings, "instagram_link")
    if not instagram_link:
        instagram_link = Settings(key="instagram_link", value=links.instagram or "")
        session.add(instagram_link)
    else:
        instagram_link.value = links.instagram or ""
        session.add(instagram_link)

    telegram_link = session.get(Settings, "telegram_link")
    if not telegram_link:
        telegram_link = Settings(key="telegram_link", value=links.telegram or "")
        session.add(telegram_link)
    else:
        telegram_link.value = links.telegram or ""
        session.add(telegram_link)

    viber_link = session.get(Settings, "viber_link")
    if not viber_link:
        viber_link = Settings(key="viber_link", value=links.viber or "")
        session.add(viber_link)
    else:
        viber_link.value = links.viber or ""
        session.add(viber_link)

    session.commit()
    return {"message": "Social links updated successfully"}


@router.get("/", dependencies=[Depends(get_current_admin)])
def get_all_settings(session: Session = Depends(get_session)):
    settings = session.exec(select(Settings)).all()
    return settings

@router.get("/{key}")
def get_setting(key: str, request: Request, session: Session = Depends(get_session)):
    if key not in PUBLIC_SETTING_KEYS and not _admin_from_request(request, session):
        # Same response as a missing key: anonymous visitors cannot probe secrets.
        raise HTTPException(status_code=404, detail="Setting not found")
    setting = session.get(Settings, key)
    if not setting:
        # Return defaults if not found
        if key == "exchange_rate":
            return {"key": key, "value": "40.0"}
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

@router.post("/{key}", dependencies=[Depends(get_current_admin)])
def update_setting(key: str, update: SettingUpdate, session: Session = Depends(get_session)):
    setting = session.get(Settings, key)
    if not setting:
        setting = Settings(key=key, value=update.value)
        session.add(setting)
    else:
        setting.value = update.value
        session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting
