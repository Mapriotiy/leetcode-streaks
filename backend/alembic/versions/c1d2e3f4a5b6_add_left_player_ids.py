"""add left_player_ids to lobbies

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f607
Create Date: 2026-08-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f607"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("lobbies") as batch_op:
        batch_op.add_column(sa.Column("left_player_ids", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("lobbies") as batch_op:
        batch_op.drop_column("left_player_ids")
