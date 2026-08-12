"""normalize active operational assignments

Revision ID: d0a7b3c4e524
Revises: c9f6a2b3d413
"""

from collections.abc import Sequence

from alembic import op

revision: str = "d0a7b3c4e524"
down_revision: str | None = "c9f6a2b3d413"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH active_tables AS (
            SELECT id, row_number() OVER (ORDER BY created_at, id) AS table_number
            FROM orders
            WHERE order_type = 'Dine-in' AND status NOT IN ('Completed', 'Cancelled')
        )
        UPDATE orders AS target
        SET metadata = COALESCE(target.metadata, '{}'::jsonb) || jsonb_build_object('table', 'Table ' || active_tables.table_number::text)
        FROM active_tables
        WHERE target.id = active_tables.id
        """
    )
    op.execute(
        """
        UPDATE orders
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'rider', 'ARGO Rider ' || ((abs(hashtext(order_number || 'fulfilled-rider')) % 12) + 1)::text
        )
        WHERE order_type = 'Delivery'
          AND status IN ('Ready for Dispatch', 'Out for Delivery', 'Delivered')
          AND (NULLIF(metadata->>'rider', '') IS NULL OR metadata->>'rider' IN ('No rider assigned', 'Unassigned'))
        """
    )


def downgrade() -> None:
    # Assignment normalization cannot be reversed without restoring invalid collisions.
    pass
