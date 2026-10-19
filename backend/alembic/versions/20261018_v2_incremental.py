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

    op.add_column('item', sa.Column('building_id', sa.Uuid(), nullable=True))
    op.add_column('item', sa.Column('floor', sa.Integer(), nullable=True))
    op.add_column('item', sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_index(op.f('ix_item_building_id'), 'item', ['building_id'], unique=False)
    op.create_foreign_key('fk_item_building_id_building', 'item', 'building', ['building_id'], ['id'])

    op.add_column('layer', sa.Column('building_id', sa.Uuid(), nullable=True))
    op.add_column('layer', sa.Column('floor', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_layer_building_id'), 'layer', ['building_id'], unique=False)
    op.create_foreign_key('fk_layer_building_id_building', 'layer', 'building', ['building_id'], ['id'])

    op.add_column('route', sa.Column('visibility', sa.String(length=16), nullable=False, server_default='private'))
    op.execute("UPDATE route SET visibility = CASE WHEN is_private THEN 'private' ELSE 'public' END")
    op.drop_column('route', 'is_private')

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
    op.alter_column('attachment', 'item_id', existing_type=sa.Uuid(), nullable=True)
    op.add_column('attachment', sa.Column('comment_id', sa.Uuid(), nullable=True))
    op.add_column('attachment', sa.Column('owner_user_id', sa.Uuid(), nullable=True))
    op.add_column(
        'attachment',
        sa.Column('purpose', sa.String(length=16), nullable=False, server_default='item_photo'),
    )
    op.add_column('attachment', sa.Column('mime', sa.String(length=64), nullable=True))
    op.add_column('attachment', sa.Column('size', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_attachment_comment_id'), 'attachment', ['comment_id'], unique=False)
    op.create_index(op.f('ix_attachment_owner_user_id'), 'attachment', ['owner_user_id'], unique=False)
    op.create_foreign_key('fk_attachment_owner_user_id_user', 'attachment', 'user', ['owner_user_id'], ['id'])

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
    op.create_foreign_key('fk_attachment_comment_id_comment', 'attachment', 'comment', ['comment_id'], ['id'])

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
    op.drop_constraint('fk_attachment_comment_id_comment', 'attachment', type_='foreignkey')
    op.drop_index(op.f('ix_comment_parent_id'), table_name='comment')
    op.drop_index(op.f('ix_comment_item_id'), table_name='comment')
    op.drop_index(op.f('ix_comment_author_user_id'), table_name='comment')
    op.drop_table('comment')

    op.drop_constraint('fk_attachment_owner_user_id_user', 'attachment', type_='foreignkey')
    op.drop_index(op.f('ix_attachment_owner_user_id'), table_name='attachment')
    op.drop_index(op.f('ix_attachment_comment_id'), table_name='attachment')
    op.drop_column('attachment', 'size')
    op.drop_column('attachment', 'mime')
    op.drop_column('attachment', 'purpose')
    op.drop_column('attachment', 'owner_user_id')
    op.drop_column('attachment', 'comment_id')
    op.alter_column('attachment', 'item_id', existing_type=sa.Uuid(), nullable=False)

    op.drop_column('user', 'staff_reject_reason')
    op.drop_column('user', 'department')
    op.drop_column('user', 'staff_no')
    op.drop_column('user', 'staff_status')
    op.drop_constraint('fk_item_building_id_building', 'item', type_='foreignkey')
    op.drop_index(op.f('ix_item_building_id'), table_name='item')
    op.drop_column('item', 'is_demo')
    op.drop_column('item', 'floor')
    op.drop_column('item', 'building_id')

    op.drop_constraint('fk_layer_building_id_building', 'layer', type_='foreignkey')
    op.drop_index(op.f('ix_layer_building_id'), table_name='layer')
    op.drop_column('layer', 'floor')
    op.drop_column('layer', 'building_id')

    op.add_column('route', sa.Column('is_private', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.execute("UPDATE route SET is_private = (visibility = 'private')")
    op.drop_column('route', 'visibility')

    op.drop_column('simulated_point', 'is_public')
    op.drop_column('simulated_point', 'kind')

    op.drop_index(op.f('ix_building_category'), table_name='building')
    op.drop_index(op.f('ix_building_code'), table_name='building')
    op.drop_table('building')
