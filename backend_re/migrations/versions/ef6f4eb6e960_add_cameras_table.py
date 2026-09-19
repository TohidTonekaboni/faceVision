"""add cameras table

Revision ID: ef6f4eb6e960
Revises: 42a7d639b5d4
Create Date: 2026-07-14 19:06:17.737008

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'ef6f4eb6e960'
down_revision: Union[str, None] = '42a7d639b5d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cameras',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('host', sa.String(length=255), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False),
        sa.Column('path', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('password_encrypted', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # Old (env-based) snapshot.camera_id values are arbitrary strings (e.g.
    # "cam1") that can't map to any new camera row — clear them out; the
    # denormalized camera_name column preserves the historical label.
    op.execute("UPDATE snapshots SET camera_id = NULL")
    op.execute("ALTER TABLE snapshots ALTER COLUMN camera_id DROP NOT NULL")
    op.execute("ALTER TABLE snapshots ALTER COLUMN camera_id TYPE uuid USING camera_id::uuid")
    op.create_foreign_key(
        'fk_snapshots_camera_id_cameras', 'snapshots', 'cameras', ['camera_id'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_snapshots_camera_id_cameras', 'snapshots', type_='foreignkey')
    op.execute("ALTER TABLE snapshots ALTER COLUMN camera_id TYPE varchar(100) USING camera_id::text")
    op.drop_table('cameras')
