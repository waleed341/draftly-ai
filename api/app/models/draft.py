from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.domain.enums import DraftStatus
from app.domain.time import utcnow


class Draft(Base):
    __tablename__ = "drafts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    idea: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(20))
    tone: Mapped[str] = mapped_column(String(20))
    length: Mapped[str] = mapped_column(String(20))
    time_zone: Mapped[str] = mapped_column(String(64), default="UTC")
    status: Mapped[str] = mapped_column(String(20), default=DraftStatus.WRITING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    versions: Mapped[list["DraftVersion"]] = relationship(
        back_populates="draft",
        cascade="all, delete-orphan",
        order_by="DraftVersion.number",
        lazy="selectin",
    )

    @property
    def latest(self) -> "DraftVersion | None":
        return self.versions[-1] if self.versions else None


class DraftVersion(Base):
    __tablename__ = "draft_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    draft_id: Mapped[int] = mapped_column(ForeignKey("drafts.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    subject: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    draft: Mapped[Draft] = relationship(back_populates="versions")
