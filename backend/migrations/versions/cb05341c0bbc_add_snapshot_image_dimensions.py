"""add snapshot image dimensions

Revision ID: cb05341c0bbc
Revises: ef6f4eb6e960
Create Date: 2026-07-23 00:00:00.000000

"""
import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'cb05341c0bbc'
down_revision: Union[str, None] = 'ef6f4eb6e960'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('snapshots', sa.Column('image_width', sa.Integer(), nullable=True))
    op.add_column('snapshots', sa.Column('image_height', sa.Integer(), nullable=True))

    # Best-effort backfill for pre-existing rows: read each image file's
    # actual dimensions off disk rather than leaving historical snapshots
    # without a way to reconstruct pixel-space annotation boxes. Skips any
    # row whose file is missing or unreadable.
    import cv2

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, image_path FROM snapshots")).fetchall()
    for row in rows:
        if not row.image_path or not os.path.exists(row.image_path):
            continue
        image = cv2.imread(row.image_path)
        if image is None:
            continue
        height, width = image.shape[:2]
        connection.execute(
            sa.text("UPDATE snapshots SET image_width = :width, image_height = :height WHERE id = :id"),
            {"width": width, "height": height, "id": row.id},
        )


def downgrade() -> None:
    op.drop_column('snapshots', 'image_height')
    op.drop_column('snapshots', 'image_width')
