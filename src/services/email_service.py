import asyncio
import smtplib
from email.message import EmailMessage

from src.config import get_settings


def _send_password_reset_otp_sync(*, recipient: str, otp: str) -> None:
    settings = get_settings()
    if not settings.smtp_username or not settings.smtp_password:
        raise RuntimeError("SMTP chưa được cấu hình. Hãy đặt SMTP_USERNAME và SMTP_PASSWORD.")

    sender = settings.smtp_from_email or settings.smtp_username
    message = EmailMessage()
    message["Subject"] = "Mã đặt lại mật khẩu - Career Assistant X"
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        f"Mã OTP để đặt lại mật khẩu của bạn là: {otp}\n\n"
        f"Mã có hiệu lực trong {settings.password_reset_otp_expire_minutes} phút. "
        "Không cung cấp mã này cho bất kỳ ai."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as client:
        client.ehlo()
        client.starttls()
        client.ehlo()
        client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)


async def send_password_reset_otp(*, recipient: str, otp: str) -> None:
    await asyncio.to_thread(_send_password_reset_otp_sync, recipient=recipient, otp=otp)
