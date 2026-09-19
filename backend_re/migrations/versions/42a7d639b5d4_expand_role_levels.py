"""expand role levels

Revision ID: 42a7d639b5d4
Revises: 96d3546c4daa
Create Date: 2026-07-11 17:33:38.582072

"""
from typing import Sequence, Union

from alembic import op

revision: str = '42a7d639b5d4'
down_revision: Union[str, None] = '96d3546c4daa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE role RENAME TO role_old")
    op.execute("CREATE TYPE role AS ENUM ('super_admin', 'level_1', 'level_2', 'level_3')")

    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE users ALTER COLUMN role TYPE role USING (
            CASE role::text
                WHEN 'admin' THEN 'super_admin'
                WHEN 'user' THEN 'level_1'
            END
        )::role
        """
    )
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'level_1'")
    op.execute("DROP TYPE role_old")


def downgrade() -> None:
    op.execute("ALTER TYPE role RENAME TO role_new")
    op.execute("CREATE TYPE role AS ENUM ('admin', 'user')")

    op.execute("ALTER TABLE users ALTER COLUMN role DROP DEFAULT")
    op.execute(
        """
        ALTER TABLE users ALTER COLUMN role TYPE role USING (
            CASE role::text
                WHEN 'super_admin' THEN 'admin'
                ELSE 'user'
            END
        )::role
        """
    )
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'")
    op.execute("DROP TYPE role_new")
