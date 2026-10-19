"""v2.0 incremental schema

Revision ID: 20261018_v2_inc
Revises: 7b8c9d0e1f2a
Create Date: 2026-10-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20261018_v2_inc'
down_revision: Union[str, None] = '7b8c9d0e1f2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'building',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(length=32), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('category', sa.String(length=32), nullable=False),
        sa.Column('floors', sa.Integer(), nullable=False),
        sa.Column('click_region', sa.JSON(), nullable=True),
        sa.Column('label_position', sa.JSON(), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_building_code'), 'building', ['code'], unique=True)
    op.create_index(op.f('ix_building_category'), 'building', ['category'], unique=False)

    # SQLite 不支持直接加列约束/改列，统一走 batch 重建；PostgreSQL 下等价于普通 ALTER
    with op.batch_alter_table('item') as batch_op:
        batch_op.add_column(sa.Column('building_id', sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column('floor', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.create_index(batch_op.f('ix_item_building_id'), ['building_id'], unique=False)
        batch_op.create_foreign_key('fk_item_building_id_building', 'building', ['building_id'], ['id'])

    with op.batch_alter_table('layer') as batch_op:
        batch_op.add_column(sa.Column('building_id', sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column('floor', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_layer_building_id'), ['building_id'], unique=False)
        batch_op.create_foreign_key('fk_layer_building_id_building', 'building', ['building_id'], ['id'])

    with op.batch_alter_table('route') as batch_op:
        batch_op.add_column(sa.Column('visibility', sa.String(length=16), nullable=False, server_default='private'))
    op.execute("UPDATE route SET visibility = CASE WHEN is_private THEN 'private' ELSE 'public' END")
    with op.batch_alter_table('route') as batch_op:
        batch_op.drop_column('is_private')

    op.add_column(
        'simulated_point',
        sa.Column('kind', sa.String(length=16), nullable=False, server_default='help_point'),
    )
    op.add_column(
        'simulated_point',
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.add_column(
        'user',
        sa.Column('staff_status', sa.String(length=16), nullable=False, server_default='none'),
    )
    op.add_column('user', sa.Column('staff_no', sa.String(length=20), nullable=True))
    op.add_column('user', sa.Column('department', sa.String(length=64), nullable=True))
    op.add_column('user', sa.Column('staff_reject_reason', sa.Text(), nullable=True))

    # 附件先上传后绑定，item_id 需允许为空；comment_id 的外键在评论表创建后追加
    with op.batch_alter_table('attachment') as batch_op:
        batch_op.alter_column('item_id', existing_type=sa.Uuid(), nullable=True)
        batch_op.add_column(sa.Column('comment_id', sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column('owner_user_id', sa.Uuid(), nullable=True))
        batch_op.add_column(
            sa.Column('purpose', sa.String(length=16), nullable=False, server_default='item_photo'),
        )
        batch_op.add_column(sa.Column('mime', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('size', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_attachment_comment_id'), ['comment_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_attachment_owner_user_id'), ['owner_user_id'], unique=False)
        batch_op.create_foreign_key('fk_attachment_owner_user_id_user', 'user', ['owner_user_id'], ['id'])

    op.create_table(
        'comment',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('item_id', sa.Uuid(), nullable=False),
        sa.Column('author_user_id', sa.Uuid(), nullable=False),
        sa.Column('parent_id', sa.Uuid(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False
        ),
        sa.ForeignKeyConstraint(['author_user_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['item_id'], ['item.id'], ),
        sa.ForeignKeyConstraint(['parent_id'], ['comment.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_comment_author_user_id'), 'comment', ['author_user_id'], unique=False)
    op.create_index(op.f('ix_comment_item_id'), 'comment', ['item_id'], unique=False)
    op.create_index(op.f('ix_comment_parent_id'), 'comment', ['parent_id'], unique=False)
    with op.batch_alter_table('attachment') as batch_op:
        batch_op.create_foreign_key('fk_attachment_comment_id_comment', 'comment', ['comment_id'], ['id'])

    op.create_table(
        'item_like',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('item_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False
        ),
        sa.ForeignKeyConstraint(['item_id'], ['item.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('item_id', 'user_id', name='uq_item_like_item_user'),
    )
    op.create_index(op.f('ix_item_like_item_id'), 'item_like', ['item_id'], unique=False)
    op.create_index(op.f('ix_item_like_user_id'), 'item_like', ['user_id'], unique=False)

    op.create_table(
        'item_favorite',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('item_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False
        ),
        sa.ForeignKeyConstraint(['item_id'], ['item.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('item_id', 'user_id', name='uq_item_favorite_item_user'),
    )
    op.create_index(op.f('ix_item_favorite_item_id'), 'item_favorite', ['item_id'], unique=False)
    op.create_index(op.f('ix_item_favorite_user_id'), 'item_favorite', ['user_id'], unique=False)

    op.create_table(
        'item_helper',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('item_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('thanked', sa.Boolean(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False
        ),
        sa.ForeignKeyConstraint(['item_id'], ['item.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_item_helper_item_id'), 'item_helper', ['item_id'], unique=False)
    op.create_index(op.f('ix_item_helper_user_id'), 'item_helper', ['user_id'], unique=False)

    op.create_table(
        'point_record',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('reason', sa.String(length=16), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('ref_id', sa.Uuid(), nullable=False),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False
        ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'reason', 'ref_id', name='uq_point_record_user_reason_ref'),
    )
    op.create_index(op.f('ix_point_record_user_id'), 'point_record', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_point_record_user_id'), table_name='point_record')
    op.drop_table('point_record')
    op.drop_index(op.f('ix_item_helper_user_id'), table_name='item_helper')
    op.drop_index(op.f('ix_item_helper_item_id'), table_name='item_helper')
    op.drop_table('item_helper')

    op.drop_index(op.f('ix_item_favorite_user_id'), table_name='item_favorite')
    op.drop_index(op.f('ix_item_favorite_item_id'), table_name='item_favorite')
    op.drop_table('item_favorite')
    op.drop_index(op.f('ix_item_like_user_id'), table_name='item_like')
    op.drop_index(op.f('ix_item_like_item_id'), table_name='item_like')
    op.drop_table('item_like')
    with op.batch_alter_table('attachment') as batch_op:
        batch_op.drop_constraint('fk_attachment_comment_id_comment', type_='foreignkey')
    op.drop_index(op.f('ix_comment_parent_id'), table_name='comment')
    op.drop_index(op.f('ix_comment_item_id'), table_name='comment')
    op.drop_index(op.f('ix_comment_author_user_id'), table_name='comment')
    op.drop_table('comment')

    with op.batch_alter_table('attachment') as batch_op:
        batch_op.drop_constraint('fk_attachment_owner_user_id_user', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_attachment_owner_user_id'))
        batch_op.drop_index(batch_op.f('ix_attachment_comment_id'))
        batch_op.drop_column('size')
        batch_op.drop_column('mime')
        batch_op.drop_column('purpose')
        batch_op.drop_column('owner_user_id')
        batch_op.drop_column('comment_id')
        batch_op.alter_column('item_id', existing_type=sa.Uuid(), nullable=False)

    op.drop_column('user', 'staff_reject_reason')
    op.drop_column('user', 'department')
    op.drop_column('user', 'staff_no')
    op.drop_column('user', 'staff_status')

    with op.batch_alter_table('item') as batch_op:
        batch_op.drop_constraint('fk_item_building_id_building', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_item_building_id'))
        batch_op.drop_column('is_demo')
        batch_op.drop_column('floor')
        batch_op.drop_column('building_id')

    with op.batch_alter_table('layer') as batch_op:
        batch_op.drop_constraint('fk_layer_building_id_building', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_layer_building_id'))
        batch_op.drop_column('floor')
        batch_op.drop_column('building_id')

    with op.batch_alter_table('route') as batch_op:
        batch_op.add_column(sa.Column('is_private', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.execute("UPDATE route SET is_private = (visibility = 'private')")
    with op.batch_alter_table('route') as batch_op:
        batch_op.drop_column('visibility')

    op.drop_column('simulated_point', 'is_public')
    op.drop_column('simulated_point', 'kind')

    op.drop_index(op.f('ix_building_category'), table_name='building')
    op.drop_index(op.f('ix_building_code'), table_name='building')
    op.drop_table('building')
