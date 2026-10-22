"""Add verified account registration."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

import app.models  # noqa: F401
from app.db.base import Base

revision = "20261022_0002"
down_revision = "20261022_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("users")}
    if "name" not in columns:
        op.add_column("users", sa.Column("name", sa.String(length=100), nullable=True))
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    # Verification records may be in use; account data is intentionally retained.
    pass
