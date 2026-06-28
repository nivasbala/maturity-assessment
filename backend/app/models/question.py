import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pillar_id = Column(UUID(as_uuid=True), ForeignKey("pillars.id"), nullable=False)
    text = Column(Text, nullable=False)
    question_weight = Column(Numeric(3, 2), nullable=False, default=1.0)
    is_general = Column(Boolean, nullable=False, default=False)
    display_order = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    pillar = relationship("Pillar", back_populates="questions")
    personas = relationship("QuestionPersona", back_populates="question", cascade="all, delete-orphan")
    answer_options = relationship("AnswerOption", back_populates="question", cascade="all, delete-orphan")
    assessment_answers = relationship("AssessmentAnswer", back_populates="question")


class QuestionPersona(Base):
    __tablename__ = "question_personas"

    __table_args__ = (UniqueConstraint("question_id", "persona", name="uq_question_persona"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    persona = Column(String(100), nullable=False)
    persona_weight = Column(Numeric(3, 2), nullable=False, default=1.0)

    question = relationship("Question", back_populates="personas")


class AnswerOption(Base):
    __tablename__ = "answer_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    maturity_level = Column(Integer, nullable=False)
    display_order = Column(Integer, nullable=False)

    question = relationship("Question", back_populates="answer_options")
    assessment_answers = relationship("AssessmentAnswer", back_populates="answer_option")
