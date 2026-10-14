"""add claim review_reason

Revision ID: 7b8c9d0e1f2a
Revises: 5a312e915b0f
Create Date: 2026-10-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '7b8c9d0e1f2a'
down_revision = '5a312e915b0f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('claim', sa.Column('review_reason', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('claim', 'review_reason')