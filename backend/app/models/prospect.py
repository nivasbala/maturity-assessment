import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Prospect(Base):
    __tablename__ = "prospects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    email = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    # Context fields collected at registration
    infrastructure_location = Column(Text, nullable=True)
    tech_stack_description = Column(Text, nullable=True)
    current_tools = Column(Text, nullable=True)
    key_challenges_input = Column(Text, nullable=True)
    # Agent 1 output cached here (per-prospect)
    research_cache = Column(JSONB, nullable=True)
    research_cached_at = Column(DateTime(timezone=True), nullable=True)
    # Pillar suggestions set by internal user at creation
    suggested_pillars = Column(ARRAY(UUID(as_uuid=True)), nullable=False, server_default=text("'{}'::uuid[]"))
    # Short URL token — generated at creation, one per prospect
    short_url_token = Column(String(12), nullable=True, unique=True)
    # Research review (stored here since confirm-research runs before pillar/assessment selection)
    prospect_corrections = Column(Text, nullable=True)
    research_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    # Registration state
    is_registered = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    registered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    account = relationship("Account", back_populates="prospects")
    assessments = relationship("Assessment", back_populates="prospect")
