import httpx
import logging

logger = logging.getLogger("email_service")
EMAIL_SERVICE_URL = "https://email-service-coral-beta.vercel.app/api/send-mail"

async def send_email(recipient: str, subject: str, text_content: str, html_content: str) -> bool:
    """
    Sends email via custom email service API endpoint.
    Payload expected by endpoint:
    {
        "recipient": recipient_email,
        "subject": subject_text,
        "text_content": plain_text,
        "html_content": html_text
    }
    """
    payload = {
        "recipient": recipient,
        "subject": subject,
        "text_content": text_content,
        "html_content": html_content
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(EMAIL_SERVICE_URL, json=payload)
            if res.status_code == 200:
                logger.info(f"Email sent successfully to {recipient}")
                return True
            else:
                logger.warning(f"Email service returned HTTP {res.status_code}: {res.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to dispatch email to {recipient}: {e}")
        return False
