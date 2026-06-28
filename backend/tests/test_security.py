import pytest
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from jose import jwt

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.config import settings


@pytest.mark.asyncio
async def test_hash_password_returns_bcrypt_hash():
    hashed = await hash_password("mysecret")
    assert hashed != "mysecret"
    assert hashed.startswith("$2b$")


@pytest.mark.asyncio
async def test_verify_password_correct():
    hashed = await hash_password("mysecret")
    assert await verify_password("mysecret", hashed) is True


@pytest.mark.asyncio
async def test_verify_password_wrong():
    hashed = await hash_password("mysecret")
    assert await verify_password("wrongpassword", hashed) is False


def test_create_access_token_contains_sub_and_type():
    token = create_access_token({"sub": "user-123"})
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == "user-123"
    assert "exp" in payload
    assert payload["type"] == "access"


def test_create_refresh_token_contains_sub_and_type():
    token = create_refresh_token({"sub": "user-456"})
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == "user-456"
    assert payload["type"] == "refresh"


def test_decode_token_valid():
    token = create_access_token({"sub": "user-789"})
    payload = decode_token(token)
    assert payload["sub"] == "user-789"


def test_decode_refresh_token_rejected_as_access():
    token = create_refresh_token({"sub": "user-789"})
    with pytest.raises(HTTPException) as exc_info:
        decode_token(token)
    assert exc_info.value.status_code == 401


def test_decode_access_token_rejected_as_refresh():
    token = create_access_token({"sub": "user-789"})
    with pytest.raises(HTTPException) as exc_info:
        decode_token(token, expected_type="refresh")
    assert exc_info.value.status_code == 401


def test_decode_token_invalid_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_token("this.is.not.a.valid.token")
    assert exc_info.value.status_code == 401


def test_decode_token_wrong_secret_raises_401():
    token = jwt.encode({"sub": "evil"}, "wrong-secret", algorithm="HS256")
    with pytest.raises(HTTPException) as exc_info:
        decode_token(token)
    assert exc_info.value.status_code == 401


def test_decode_token_expired_raises_401():
    expired_payload = {
        "sub": "user-000",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
    }
    token = jwt.encode(expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    with pytest.raises(HTTPException) as exc_info:
        decode_token(token)
    assert exc_info.value.status_code == 401


def test_access_token_expiry_shorter_than_refresh():
    access = create_access_token({"sub": "u"})
    refresh = create_refresh_token({"sub": "u"})
    access_exp = jwt.decode(access, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])["exp"]
    refresh_exp = jwt.decode(refresh, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])["exp"]
    assert access_exp < refresh_exp
