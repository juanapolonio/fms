"""add food options

Revision ID: f5d2c0a9b7e1
Revises: 3ad7519f106f
Create Date: 2026-08-10 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f5d2c0a9b7e1"
down_revision = "3ad7519f106f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "food_options",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("option_type", sa.String(length=30), nullable=False),
        sa.Column("choices", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("items_using", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_food_options_organization_id", "food_options", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_food_options_organization_id", table_name="food_options")
    op.drop_table("food_options")
