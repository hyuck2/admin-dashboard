import base64
import hashlib

from cryptography.fernet import Fernet

from config import FERNET_KEY, JWT_SECRET


def _get_fernet() -> Fernet:
    if FERNET_KEY:
        key = FERNET_KEY.encode() if isinstance(FERNET_KEY, str) else FERNET_KEY
    else:
        # Derive a Fernet-compatible key from JWT_SECRET via SHA-256 → base64
        digest = hashlib.sha256(JWT_SECRET.encode()).digest()
        key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_password(plain: str) -> str:
    if not plain:
        return ""
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_password(enc: str) -> str:
    if not enc:
        return ""
    return _get_fernet().decrypt(enc.encode()).decode()
