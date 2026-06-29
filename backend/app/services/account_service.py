import logging

from fastapi import HTTPException, status

from app.models.account import Account
from app.models.user import User

logger = logging.getLogger(__name__)


def assert_owns_account(current_user: User, account: Account) -> None:
    """Raise 403 if an internal user tries to access another user's account.

    Admins bypass this check and can see all accounts.
    Must be called at the service layer before returning any account,
    assessment, answer, or report to an internal user.
    """
    if current_user.role == "admin":
        return
    if account.internal_user_id != current_user.id:
        logger.warning(
            "Access denied: user_id=%s attempted to access account owned by user_id=%s",
            current_user.id,
            account.internal_user_id,
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
