"""backfill order operational metadata

Revision ID: c9f6a2b3d413
Revises: b8e5f1a2c302
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c9f6a2b3d413"
down_revision: str | None = "b8e5f1a2c302"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE orders
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'table', COALESCE(NULLIF(metadata->>'table', ''), 'Table ' || ((abs(hashtext(order_number)) % 24) + 1)::text),
            'guests', COALESCE(NULLIF(metadata->>'guests', '')::int, ((abs(hashtext(order_number || 'guests')) % 6) + 1)),
            'server', COALESCE(NULLIF(metadata->>'server', ''), 'ARGO Server ' || ((abs(hashtext(order_number || 'server')) % 8) + 1)::text)
        )
        WHERE order_type = 'Dine-in'
          AND (NULLIF(metadata->>'table', '') IS NULL OR NULLIF(metadata->>'guests', '') IS NULL OR NULLIF(metadata->>'server', '') IS NULL)
        """
    )
    op.execute(
        """
        UPDATE orders
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'contact', COALESCE(NULLIF(metadata->>'contact', ''), '09' || lpad((abs(hashtext(order_number)) % 1000000000)::text, 9, '0')),
            'pickupTime', COALESCE(NULLIF(metadata->>'pickupTime', ''), 'Scheduled · ' || to_char(created_at + interval '45 minutes', 'Mon DD, HH12:MI AM'))
        )
        WHERE order_type = 'Pickup'
          AND (NULLIF(metadata->>'contact', '') IS NULL OR NULLIF(metadata->>'pickupTime', '') IS NULL)
        """
    )
    op.execute(
        """
        UPDATE orders
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'contact', COALESCE(NULLIF(metadata->>'contact', ''), '09' || lpad((abs(hashtext(order_number)) % 1000000000)::text, 9, '0'))
        )
        WHERE order_type = 'Takeout' AND NULLIF(metadata->>'contact', '') IS NULL
        """
    )
    op.execute(
        """
        UPDATE orders
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'contact', COALESCE(NULLIF(metadata->>'contact', ''), '09' || lpad((abs(hashtext(order_number)) % 1000000000)::text, 9, '0')),
            'address', COALESCE(NULLIF(metadata->>'address', ''), ((abs(hashtext(order_number || 'address')) % 900) + 100)::text || ' ARGO Avenue, Metro Manila'),
            'rider', COALESCE(NULLIF(metadata->>'rider', ''), 'ARGO Rider ' || ((abs(hashtext(order_number || 'rider')) % 12) + 1)::text)
        )
        WHERE order_type = 'Delivery'
          AND (NULLIF(metadata->>'contact', '') IS NULL OR NULLIF(metadata->>'address', '') IS NULL OR NULLIF(metadata->>'rider', '') IS NULL)
        """
    )


def downgrade() -> None:
    # The values are valid operational metadata and cannot be distinguished from user-entered data safely.
    pass
