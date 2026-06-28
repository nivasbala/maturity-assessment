import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Pillar(Base):
    __tablename__ = "pillars"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    overall_weight = Column(Numeric(3, 2), nullable=False, default=1.0)
    display_order = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_gated = Column(Boolean, nullable=False, default=False)
    gate_question = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    questions = relationship("Question", back_populates="pillar")
    assessments = relationship("Assessment", back_populates="pillar")
