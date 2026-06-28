import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Assessment(Base):
    __tablename__ = "assessments"

    __table_args__ = (UniqueConstraint("account_id", "pillar_id", name="uq_assessment_account_pillar"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    pillar_id = Column(UUID(as_uuid=True), ForeignKey("pillars.id"), nullable=False)
    short_url_token = Column(String(12), nullable=False, unique=True)
    prospect_name = Column(String(255), nullable=True)
    prospect_email = Column(String(255), nullable=True)
    prospect_role = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="pending")  # pending | in_progress | completed
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    account = relationship("Account", back_populates="assessments")
    pillar = relationship("Pillar", back_populates="assessments")
    answers = relationship("AssessmentAnswer", back_populates="assessment", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="assessment", uselist=False)


class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"

    __table_args__ = (UniqueConstraint("assessment_id", "question_id", name="uq_answer_assessment_question"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id = Column(UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    answer_option_id = Column(UUID(as_uuid=True), ForeignKey("answer_options.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    assessment = relationship("Assessment", back_populates="answers")
    question = relationship("Question", back_populates="assessment_answers")
    answer_option = relationship("AnswerOption", back_populates="assessment_answers")
