"""add people and detection_events tables

Revision ID: a1b2c3d4e5f6
Revises: cb05341c0bbc
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'cb05341c0bbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'people',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('display_name', sa.String(length=150), nullable=False),
        sa.Column('is_unknown', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('display_name', name='uq_people_display_name'),
    )

    op.create_table(
        'detection_events',
        sa.Column('id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('person_id', sa.UUID(as_uuid=False), nullable=False),
        sa.Column('camera_id', sa.UUID(as_uuid=False), nullable=True),
        sa.Column('camera_name', sa.String(length=255), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('detection_count', sa.Integer(), nullable=False),
        sa.Column('max_confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['person_id'], ['people.id']),
        sa.ForeignKeyConstraint(['camera_id'], ['cameras.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_detection_events_person_started', 'detection_events', ['person_id', 'started_at'])
    op.create_index('ix_detection_events_camera_started', 'detection_events', ['camera_id', 'started_at'])
    op.create_index('ix_detection_events_started_at', 'detection_events', ['started_at'])

    # Seed the "unknown" sentinel person up front so the events consumer never
    # has to special-case its first-ever insert.
    op.execute(
        "INSERT INTO people (id, display_name, is_unknown, created_at) "
        "VALUES (gen_random_uuid(), 'unknown', true, now())"
    )


def downgrade() -> None:
    op.drop_index('ix_detection_events_started_at', table_name='detection_events')
    op.drop_index('ix_detection_events_camera_started', table_name='detection_events')
    op.drop_index('ix_detection_events_person_started', table_name='detection_events')
    op.drop_table('detection_events')
    op.drop_table('people')
