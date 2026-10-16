import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def _cipher() -> Fernet:
    secret = os.getenv("SECRET_KEY")
    if not secret:
        raise RuntimeError("SECRET_KEY must be configured to store encrypted settings")
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    return _cipher().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str) -> str:
    try:
        return _cipher().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as error:
        raise RuntimeError("Unable to decrypt a stored secret; verify SECRET_KEY") from error
