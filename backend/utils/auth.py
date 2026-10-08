from datetime import datetime, timedelta, timezone

import os
import secrets
import hashlib
import bcrypt

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from database.connection import users_collection
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60

REFRESH_TOKEN_EXPIRE_DAYS = 30


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)


def hash_password(password: str):
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str
):
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


def create_access_token(data: dict):

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({
        "exp": expire,
        "type": "access"
    })

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


def create_refresh_token():

    token = secrets.token_urlsafe(64)

    token_hash = hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()

    expiry = datetime.now(timezone.utc) + timedelta(
        days=REFRESH_TOKEN_EXPIRE_DAYS
    )

    return token, token_hash, expiry


def save_refresh_token(
    user_id,
    token_hash,
    expiry
):

    users_collection.update_one(
        {
            "_id": user_id
        },
        {
            "$set": {
                "refresh_token_hash": token_hash,
                "refresh_token_expiry": expiry
            }
        }
    )


def get_refresh_token_user(
    refresh_token: str
):

    token_hash = hashlib.sha256(
        refresh_token.encode("utf-8")
    ).hexdigest()

    user = users_collection.find_one({
        "refresh_token_hash": token_hash
    })

    if user is None:
        return None

    expiry = user.get(
        "refresh_token_expiry"
    )

    if expiry is None:
        return None

    if expiry.tzinfo is None:
        expiry = expiry.replace(
            tzinfo=timezone.utc
        )

    if expiry < datetime.now(timezone.utc):

        users_collection.update_one(
            {
                "_id": user["_id"]
            },
            {
                "$unset": {
                    "refresh_token_hash": "",
                    "refresh_token_expiry": ""
                }
            }
        )

        return None

    if user.get(
        "is_deleted",
        False
    ):
        return None

    if not user.get(
        "is_active",
        True
    ):
        return None

    return user


def revoke_refresh_token(
    user_id
):

    users_collection.update_one(
        {
            "_id": user_id
        },
        {
            "$unset": {
                "refresh_token_hash": "",
                "refresh_token_expiry": ""
            }
        }
    )


def get_current_user(
    token: str = Depends(oauth2_scheme)
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        }
    )

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        if payload.get(
            "type",
            "access"
        ) != "access":

            raise credentials_exception

        user_id = payload.get("sub")

        if user_id is None:

            raise credentials_exception

    except JWTError:

        raise credentials_exception

    user = users_collection.find_one({
        "email": user_id
    })

    if user is None:

        raise credentials_exception

    if user.get(
        "is_deleted",
        False
    ):

        raise HTTPException(
            status_code=403,
            detail="User account is in trash"
        )

    if not user.get(
        "is_active",
        True
    ):

        raise HTTPException(
            status_code=403,
            detail="User account is inactive"
        )

    user["id"] = str(
        user["_id"]
    )

    return user


def create_reset_token():

    return secrets.token_urlsafe(32)


def save_reset_token(
    email: str
):

    token = create_reset_token()

    expiry = datetime.now(timezone.utc) + timedelta(
        minutes=30
    )

    users_collection.update_one(
        {
            "email": email
        },
        {
            "$set": {
                "reset_token": token,
                "reset_token_expiry": expiry
            }
        }
    )

    return token


def verify_reset_token(
    token: str
):

    user = users_collection.find_one({
        "reset_token": token
    })

    if user is None:

        return None

    expiry = user.get(
        "reset_token_expiry"
    )

    if expiry is None:

        return None

    if expiry.tzinfo is None:
        expiry = expiry.replace(
            tzinfo=timezone.utc
        )

    if expiry < datetime.now(timezone.utc):

        users_collection.update_one(
            {
                "_id": user["_id"]
            },
            {
                "$unset": {
                    "reset_token": "",
                    "reset_token_expiry": ""
                }
            }
        )

        return None

    return user