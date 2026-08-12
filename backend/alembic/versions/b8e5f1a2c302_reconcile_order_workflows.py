"""reconcile order workflow states

Revision ID: b8e5f1a2c302
Revises: a7c4d8e9f201
Create Date: 2026-08-13 00:30:00.000000
"""

from alembic import op


revision = "b8e5f1a2c302"
down_revision = "a7c4d8e9f201"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE orders
        SET kitchen_status = CASE
            WHEN status = 'Cancelled' THEN 'Cancelled'
            WHEN status IN ('Completed', 'Delivered', 'Out for Delivery') THEN 'Completed'
            WHEN status IN ('Ready', 'Ready for Pickup', 'Ready for Dispatch') THEN 'Ready'
            WHEN status = 'Preparing' THEN 'Preparing'
            ELSE 'Pending'
        END
        """
    )
    op.execute("UPDATE orders SET payment_status = 'Paid' WHERE status IN ('Completed', 'Delivered') AND payment_status = 'Pending'")
    op.execute(
        """
        UPDATE payments AS payment
        SET status = orders.payment_status
        FROM orders
        WHERE payment.order_id = orders.id
          AND payment.organization_id = orders.organization_id
          AND payment.status IS DISTINCT FROM orders.payment_status
        """
    )


def downgrade() -> None:
    # Workflow reconciliation corrects inconsistent live records and is not reversible.
    pass
