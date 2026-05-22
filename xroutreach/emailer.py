from __future__ import annotations

import requests

from xroutreach.config import Settings, require


class Emailer:
    endpoint = "https://api.brevo.com/v3/smtp/email"

    def __init__(self, settings: Settings):
        if settings.email_provider != "brevo":
            raise RuntimeError(f"Unsupported EMAIL_PROVIDER: {settings.email_provider}")
        require(
            [
                ("BREVO_API_KEY", settings.brevo_api_key),
                ("BREVO_FROM_EMAIL", settings.brevo_from_email),
            ]
        )
        self.api_key = settings.brevo_api_key
        self.from_email = settings.brevo_from_email
        self.from_name = settings.brevo_from_name

    def send(self, to_email: str, subject: str, body: str) -> None:
        response = requests.post(
            self.endpoint,
            headers={
                "accept": "application/json",
                "api-key": self.api_key,
                "content-type": "application/json",
            },
            json={
                "sender": {"name": self.from_name, "email": self.from_email},
                "to": [{"email": to_email}],
                "subject": subject,
                "textContent": body,
            },
            timeout=20,
        )
        response.raise_for_status()
