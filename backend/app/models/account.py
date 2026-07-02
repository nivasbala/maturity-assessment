import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(255), nullable=False)
    company_website = Column(String(500), nullable=True)
    internal_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    suggested_pillars = Column(ARRAY(UUID(as_uuid=True)), nullable=False, server_default=text("'{}'::uuid[]"))
    # Prospect-provided context (optional, collected at registration)
    infrastructure_location = Column(Text, nullable=True)
    tech_stack_description = Column(Text, nullable=True)
    current_tools = Column(Text, nullable=True)
    key_challenges_input = Column(Text, nullable=True)
    # Research and validation
    research_cache = Column(JSONB, nullable=True)
    research_cached_at = Column(DateTime(timezone=True), nullable=True)
    research_started_at = Column(DateTime(timezone=True), nullable=True)
    prospect_corrections = Column(Text, nullable=True)
    research_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    internal_user = relationship("User", back_populates="accounts")
    assessments = relationship("Assessment", back_populates="account")
