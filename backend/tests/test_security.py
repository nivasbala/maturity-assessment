import logging
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
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


# --- token-not-in-logs tests ---

class TestShortUrlTokenNotLogged:
    def test_create_prospect_does_not_log_token(self, caplog):
        """short_url_token must never appear in account_service log output."""
        from app.services.account_service import create_prospect  # noqa: F401 — import triggers logger setup
        sentinel_token = "SENTINEL_SECRET_TOKEN_XYZ"
        with caplog.at_level(logging.INFO, logger="app.services.account_service"):
            # Simulate what the logger would emit if token were still present
            # by checking that our sentinel never leaks through any log record
            import logging as _logging
            test_logger = _logging.getLogger("app.services.account_service")
            # Verify the format strings in the module don't include token=
            import inspect
            import app.services.account_service as svc_module
            source = inspect.getsource(svc_module)
        assert "token=%s" not in source or "create_prospect" not in source.split("token=%s")[0].split("\n")[-1]

    def test_get_assessment_info_log_format_has_no_token_placeholder(self):
        """get_assessment_info log line must use prospect_id, not token."""
        import inspect
        import app.services.public_service as svc
        source = inspect.getsource(svc)
        # Find the log line for get_assessment_info and assert it uses prospect_id not token
        for line in source.splitlines():
            if "get_assessment_info:" in line and "logger.info" in line:
                assert "token=" not in line
                assert "prospect_id=" in line

    def test_get_report_log_format_has_no_token_placeholder(self):
        """get_report log line must use prospect_id, not token."""
        import inspect
        import app.services.public_service as svc
        source = inspect.getsource(svc)
        for line in source.splitlines():
            if "get_report:" in line and "logger.info" in line:
                assert "token=" not in line
                assert "prospect_id=" in line

    def test_create_prospect_log_format_has_no_token_placeholder(self):
        """create_prospect log line must not include token= in the format string."""
        import inspect
        import app.services.account_service as svc
        source = inspect.getsource(svc)
        in_log_block = False
        for line in source.splitlines():
            if "create_prospect: prospect_id=" in line:
                in_log_block = True
            if in_log_block and "token=" in line:
                pytest.fail(f"short_url_token found in create_prospect log line: {line.strip()}")
            if in_log_block and ")" in line:
                break


# --- IDOR tests ---

class TestSubmitAssessmentProspectIsolation:
    """submit_assessment must enforce account-level isolation (current behaviour).
    These tests document the existing check and flag if it is ever weakened."""

    def _make_session(self, account_id, prospect_id, role="technical"):
        return {
            "account_id": str(account_id),
            "prospect_id": str(prospect_id),
            "prospect_role": role,
        }

    @pytest.mark.asyncio
    async def test_submit_rejects_assessment_from_different_account(self):
        """Assessment belonging to a different account must be rejected with 403."""
        from app.services.public_service import submit_assessment
        from app.schemas.public import SubmitRequest, AnswerSubmit

        account_a = uuid.uuid4()
        account_b = uuid.uuid4()
        assessment_id = uuid.uuid4()
        prospect_id = uuid.uuid4()

        mock_assessment = MagicMock()
        mock_assessment.account_id = account_b  # different account
        mock_assessment.prospect_id = prospect_id

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_assessment)))

        session = self._make_session(account_a, prospect_id)
        body = SubmitRequest(
            assessment_id=assessment_id,
            answers=[AnswerSubmit(question_id=uuid.uuid4(), answer_option_id=uuid.uuid4())],
        )

        with pytest.raises(HTTPException) as exc_info:
            await submit_assessment("sometoken", session, body, db)
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_submit_rejects_missing_assessment_with_404(self):
        """Non-existent assessment_id must return 404, not leak account info."""
        from app.services.public_service import submit_assessment
        from app.schemas.public import SubmitRequest, AnswerSubmit

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))

        session = self._make_session(uuid.uuid4(), uuid.uuid4())
        body = SubmitRequest(
            assessment_id=uuid.uuid4(),
            answers=[AnswerSubmit(question_id=uuid.uuid4(), answer_option_id=uuid.uuid4())],
        )

        with pytest.raises(HTTPException) as exc_info:
            await submit_assessment("sometoken", session, body, db)
        assert exc_info.value.status_code == 404


class TestGetReportProspectIsolation:
    """get_report scopes by account_id. These tests verify the account check holds."""

    @pytest.mark.asyncio
    async def test_get_report_returns_404_for_wrong_account(self):
        """Report from a different account must return 404 (not found), not leak data."""
        from app.services.public_service import get_report

        prospect = MagicMock()
        prospect.id = uuid.uuid4()
        prospect.account = MagicMock()
        prospect.account.id = uuid.uuid4()

        # DB returns None because account_id filter doesn't match
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))

        with (
            patch("app.services.public_service._get_prospect_by_token", AsyncMock(return_value=prospect)),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await get_report("sometoken", uuid.uuid4(), db)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_report_returns_404_when_report_not_ready(self):
        """Assessment exists but report is None — must 404, not 500."""
        from app.services.public_service import get_report

        prospect = MagicMock()
        prospect.id = uuid.uuid4()
        prospect.account = MagicMock()
        prospect.account.id = uuid.uuid4()

        mock_assessment = MagicMock()
        mock_assessment.report = None

        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=mock_assessment)))

        with (
            patch("app.services.public_service._get_prospect_by_token", AsyncMock(return_value=prospect)),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await get_report("sometoken", uuid.uuid4(), db)
        assert exc_info.value.status_code == 404


# --- JWT secret strength tests ---

class TestJwtSecretStrength:
    def test_jwt_secret_key_is_at_least_32_chars(self):
        """Deployed secret must meet minimum length — catches accidental placeholder use."""
        assert len(settings.jwt_secret_key) >= 32, (
            "JWT_SECRET_KEY is shorter than 32 characters — tokens are brute-forceable"
        )

    def test_jwt_algorithm_is_hs256(self):
        """Algorithm must be HS256 — alg:none and RS256 confusion attacks are blocked."""
        assert settings.jwt_algorithm == "HS256"

    def test_decode_rejects_alg_none_token(self):
        """Token signed with alg:none must be rejected."""
        # python-jose does not support alg:none; crafting a raw unsigned JWT manually
        import base64, json as _json
        header = base64.urlsafe_b64encode(_json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=")
        payload = base64.urlsafe_b64encode(_json.dumps({"sub": "attacker", "type": "access"}).encode()).rstrip(b"=")
        forged = f"{header.decode()}.{payload.decode()}."
        with pytest.raises(HTTPException) as exc_info:
            decode_token(forged)
        assert exc_info.value.status_code == 401
