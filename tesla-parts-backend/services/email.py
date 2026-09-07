import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
import os
from dotenv import load_dotenv
from sqlmodel import Session, select
from database import engine
from models import Settings

load_dotenv()

SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SENDER_NAME = "TESLA PARTS CENTER"

def get_from_header() -> str:
    if SMTP_EMAIL:
        return formataddr((SENDER_NAME, SMTP_EMAIL))
    return ""
FRONTEND_URL = os.getenv("WEBSITE_URL", "http://localhost:3000")
API_URL = os.getenv("API_URL", "http://localhost:8000")

def get_email_header():
    return f"""
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td style="padding-right: 12px; vertical-align: middle;">
              <img src="{API_URL}/static/images/tesla-logo.png" alt="Tesla Logo" style="height: 40px; width: auto; display: block;" />
            </td>
            <td style="vertical-align: middle; font-family: Arial, sans-serif;">
              <div style="color: #E31937; font-weight: bold; font-size: 20px; line-height: 1.1; margin: 0; padding: 0;">TESLA</div>
              <div style="color: #000000; font-weight: bold; font-size: 20px; line-height: 1.1; margin: 0; padding: 0;">PARTS</div>
              <div style="color: #000000; font-weight: bold; font-size: 20px; line-height: 1.1; margin: 0; padding: 0;">CENTER</div>
            </td>
          </tr>
        </table>
    """

def get_email_footer():
    try:
        with Session(engine) as session:
            setting = session.exec(select(Settings).where(Settings.key == "email_footer")).first()
            if setting and setting.value:
                return f'<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">{setting.value}</div>'
    except Exception as e:
        print(f"Failed to fetch footer: {e}")
    return ""

def send_verification_email(to_email: str, token: str):
    verification_link = f"{FRONTEND_URL}/verify?token={token}"
    
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"--- EMAIL DISPATCH FALLBACK ---")
        print(f"To: {to_email}")
        print(f"Subject: Verify your account")
        print(f"Link: {verification_link}")
        print(f"-------------------------------")
        return
        
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Підтвердження електронної пошти"
    msg["From"] = get_from_header()
    msg["To"] = to_email
    
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif;">
        {get_email_header()}
        <h2>Вітаємо в Tesla Parts Shop!</h2>
        <p>Будь ласка, натисніть кнопку нижче, щоб підтвердити свою електронну пошту та встановити пароль:</p>
        <a href="{verification_link}" style="display:inline-block;padding:10px 20px;background-color:#E31937;color:#ffffff;text-decoration:none;border-radius:5px;">Підтвердити пошту</a>
        {get_email_footer()}
      </body>
    </html>
    """
    
    part = MIMEText(html, "html")
    msg.attach(part)
    
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"Failed to send email: {e}")
        # Fallback to console print if SMTP fails
        print(f"--- EMAIL DISPATCH FALLBACK ---")
        print(f"Link: {verification_link}")
        print(f"-------------------------------")

def send_reset_password_email(to_email: str, token: str):
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"--- EMAIL DISPATCH FALLBACK ---")
        print(f"To: {to_email}")
        print(f"Subject: Reset your password")
        print(f"Link: {reset_link}")
        print(f"-------------------------------")
        return
        
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Скидання пароля"
    msg["From"] = get_from_header()
    msg["To"] = to_email
    
    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif;">
        {get_email_header()}
        <h2>Запит на скидання пароля</h2>
        <p>Будь ласка, натисніть кнопку нижче, щоб скинути свій пароль:</p>
        <a href="{reset_link}" style="display:inline-block;padding:10px 20px;background-color:#E31937;color:#ffffff;text-decoration:none;border-radius:5px;">Скинути пароль</a>
        <p>Якщо ви не робили цей запит, будь ласка, проігноруйте цей лист.</p>
        {get_email_footer()}
      </body>
    </html>
    """
    
    part = MIMEText(html, "html")
    msg.attach(part)
    
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"Failed to send email: {e}")
        print(f"--- EMAIL DISPATCH FALLBACK ---")
        print(f"Link: {reset_link}")
        print(f"-------------------------------")

def send_custom_email(to_email: str, subject: str, body: str):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"--- EMAIL DISPATCH FALLBACK ---")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body: {body}")
        print(f"-------------------------------")
        return
        
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = get_from_header()
    msg["To"] = to_email
    
    full_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif;">
        {get_email_header()}
        {body}
        {get_email_footer()}
      </body>
    </html>
    """
    
    part = MIMEText(full_body, "html")
    msg.attach(part)
    
    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"Failed to send custom email to {to_email}: {e}")
        print(f"--- EMAIL DISPATCH FALLBACK ---")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(f"Body: {body}")
        print(f"-------------------------------")

def send_bulk_emails(recipients: list[str], subject: str, body: str):
    for to_email in recipients:
        send_custom_email(to_email, subject, body)
