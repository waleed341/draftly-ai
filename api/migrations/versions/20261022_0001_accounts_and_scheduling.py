"""Add account, approval, Gmail and scheduling tables while preserving drafts."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

import app.models  # noqa: F401
from app.db.base import Base

revision = "20261022_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # Create missing new tables. Existing Draftly tables and their data remain intact.
    Base.metadata.create_all(bind=bind)
    columns = {column["name"] for column in inspect(bind).get_columns("drafts")}
    if "user_id" not in columns:
        op.add_column("drafts", sa.Column("user_id", sa.Integer(),
                                           sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True))
        op.create_index("ix_drafts_user_id", "drafts", ["user_id"])


def downgrade() -> None:
    # Account and schedule tables may contain user data. Downgrade is intentionally non-destructive.
    pass
