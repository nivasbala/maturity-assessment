import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Prospect(Base):
    __tablename__ = "prospects"
    __table_args__ = (
        UniqueConstraint("account_id", "email", name="uq_prospect_account_email"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    short_url_token = Column(String(16), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Registration state
    is_registered = Column(Boolean, nullable=False, server_default=text("false"))
    registered_at = Column(DateTime(timezone=True), nullable=True)

    # Prospect-provided context (collected at registration)
    job_title = Column(String(255), nullable=True)
    prospect_role = Column(String(100), nullable=True)
    p3_gate_answered_yes = Column(Boolean, nullable=True)
    p4_gate_answered_yes = Column(Boolean, nullable=True)
    infrastructure_location = Column(Text, nullable=True)
    tech_stack_description = Column(Text, nullable=True)
    current_tools = Column(Text, nullable=True)
    key_challenges_input = Column(Text, nullable=True)

    # Research cache (populated by Agent 1 at prospect creation)
    research_cache = Column(JSONB, nullable=True)
    research_cached_at = Column(DateTime(timezone=True), nullable=True)
    research_started_at = Column(DateTime(timezone=True), nullable=True)

    # Suggested pillars from research (array of pillar name strings)
    suggested_pillars = Column(ARRAY(String), nullable=True)

    account = relationship("Account", back_populates="prospects")
