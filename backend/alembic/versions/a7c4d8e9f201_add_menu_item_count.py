"""add per-menu item count

Revision ID: a7c4d8e9f201
Revises: f5d2c0a9b7e1
Create Date: 2026-08-13 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a7c4d8e9f201"
down_revision = "f5d2c0a9b7e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("menus", sa.Column("item_count", sa.Integer(), server_default="0", nullable=False))
    op.create_check_constraint("ck_menus_item_count_range", "menus", "item_count >= 0 AND item_count <= 9999")


def downgrade() -> None:
    op.drop_constraint("ck_menus_item_count_range", "menus", type_="check")
    op.drop_column("menus", "item_count")
