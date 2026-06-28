import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id"), nullable=False, unique=True)
    pillar_score = Column(Numeric(4, 2), nullable=False)
    maturity_level = Column(Integer, nullable=False)
    maturity_label = Column(String(50), nullable=False)
    executive_summary = Column(Text, nullable=False)
    strengths = Column(JSONB, nullable=False, server_default="[]")
    gap_analysis = Column(JSONB, nullable=False, server_default="[]")
    next_steps = Column(JSONB, nullable=False, server_default="[]")
    pillar_breakdown = Column(JSONB, nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    assessment = relationship("Assessment", back_populates="report")
