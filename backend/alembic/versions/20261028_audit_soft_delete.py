"""item soft-delete trail + audit log

Revision ID: 20261028_audit
Revises: 20261027_avatar
Create Date: 2026-10-28 21:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20261028_audit"
down_revision: str | None = "20261027_avatar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # batch 模式：SQLite 本地库与 PostgreSQL 部署库都能升级；
    # 仅新增可空列与新建审计表，不改动既有行，不影响已上传图片与用户数据
    with op.batch_alter_table("item") as batch_op:
        batch_op.add_column(sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column("deleted_by_id", sa.Uuid(), nullable=True))
        batch_op.create_index("ix_item_deleted_by_id", ["deleted_by_id"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("operator_user_id", sa.Uuid(), nullable=False),
        sa.Column("item_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_log_operator_user_id", "audit_log", ["operator_user_id"])
    op.create_index("ix_audit_log_item_id", "audit_log", ["item_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_item_id", table_name="audit_log")
    op.drop_index("ix_audit_log_operator_user_id", table_name="audit_log")
    op.drop_table("audit_log")
    with op.batch_alter_table("item") as batch_op:
        batch_op.drop_index("ix_item_deleted_by_id")
        batch_op.drop_column("deleted_by_id")
        batch_op.drop_column("deleted_at")
