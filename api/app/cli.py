import argparse
import asyncio
import getpass
import shutil
import tempfile
from pathlib import Path

from pwdlib import PasswordHash
from sqlalchemy import create_engine, inspect, select, text, update
from sqlalchemy.engine import URL, make_url

from app.core.config import get_settings
from app.db.base import Base
from app.db.session import build_engine, build_session_factory, create_schema
from app.models import Draft, User, UserSession
from app.services.audit import record_audit


async def bootstrap_admin() -> None:
    settings = get_settings()
    if not settings.super_admin_email:
        raise SystemExit("Set DRAFTLY_SUPER_ADMIN_EMAIL before bootstrapping the first administrator.")
    engine = build_engine(settings.database_url)
    await create_schema(engine)
    sessions = build_session_factory(engine)
    try:
        async with sessions() as session:
            if await session.scalar(select(User.id).where(User.role == "super_admin")):
                raise SystemExit("A Super Admin already exists; refusing to change privileged accounts.")
            email = settings.super_admin_email.lower().strip()
            if await session.scalar(select(User.id).where(User.email == email)):
                raise SystemExit("That email already has an account. Bootstrap only creates a new account.")
            first = getpass.getpass("New Super Admin password (12+ characters): ")
            second = getpass.getpass("Confirm password: ")
            if first != second or len(first) < 12:
                raise SystemExit("Passwords must match and be at least 12 characters.")
            user = User(email=email, password_hash=PasswordHash.recommended().hash(first),
                        role="super_admin", status="active")
            session.add(user)
            await session.flush()
            # Existing drafts predate accounts. Assign them to the explicitly bootstrapped owner,
            # retaining the full draft and version history.
            await session.execute(update(Draft).where(Draft.user_id.is_(None)).values(user_id=user.id))
            await session.commit()
            print(f"Super Admin {email} created. Existing unowned drafts were assigned to this account.")
    finally:
        await engine.dispose()


async def copy_sqlite_to_postgres(source_url: str) -> None:
    """Copy a SQLite database into empty PostgreSQL without modifying its source file."""
    settings = get_settings()
    if not settings.database_url.startswith("postgresql+"):
        raise SystemExit("Set DRAFTLY_DATABASE_URL to a PostgreSQL async URL before copying.")
    parsed = make_url(source_url)
    if not parsed.database or parsed.database == ":memory:":
        raise SystemExit("The source must be a SQLite database file.")
    source_path = Path(parsed.database).resolve()
    if not source_path.is_file():
        raise SystemExit(f"SQLite source file was not found: {source_path}")
    temporary = tempfile.TemporaryDirectory(prefix="draftly-migrate-")
    working_path = Path(temporary.name) / source_path.name
    shutil.copy2(source_path, working_path)
    source_engine = build_engine(URL.create("sqlite+aiosqlite", database=str(working_path)).render_as_string(hide_password=False))
    target_engine = build_engine(settings.database_url)
    source_sync = create_engine(URL.create("sqlite", database=str(working_path)))
    try:
        # Upgrade a private working copy; the user-provided database is read only here.
        await create_schema(source_engine)
        await create_schema(target_engine)
        def copy(connection) -> int:
            inspector = inspect(connection)
            table_names = set(inspector.get_table_names()) - {"alembic_version"}
            counts = {name: connection.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar_one()
                      for name in table_names}
            if any(counts.values()):
                raise RuntimeError("Target PostgreSQL contains data; refusing to merge or overwrite it.")
            copied = 0
            with source_sync.connect() as source:
                source_tables = set(inspect(source).get_table_names())
                for table in Base.metadata.sorted_tables:
                    if table.name not in table_names or table.name not in source_tables:
                        continue
                    source_columns = {col["name"] for col in inspect(source).get_columns(table.name)}
                    target_columns = {column.name for column in table.columns}
                    names = source_columns & target_columns
                    if not names:
                        continue
                    records = source.execute(table.select()).mappings().all()
                    payload = [{key: record[key] for key in names} for record in records]
                    if payload:
                        connection.execute(table.insert(), payload)
                        copied += len(payload)
                    if connection.dialect.name == "postgresql" and "id" in names:
                        connection.execute(text(
                            f"SELECT setval(pg_get_serial_sequence(:table_name, 'id'), "
                            f"COALESCE((SELECT MAX(id) FROM {table.name}), 1), "
                            f"EXISTS(SELECT 1 FROM {table.name}))"), {"table_name": table.name})
            return copied
        async with target_engine.begin() as connection:
            copied = await connection.run_sync(copy)
        print(f"Copied {copied} records into the empty PostgreSQL database. SQLite source remains unchanged.")
    finally:
        source_sync.dispose()
        await source_engine.dispose()
        await target_engine.dispose()
        temporary.cleanup()


async def reset_user_password(email: str) -> None:
    settings = get_settings()
    engine = build_engine(settings.database_url)
    sessions = build_session_factory(engine)
    try:
        async with sessions() as session:
            user = await session.scalar(select(User).where(User.email == email.lower().strip()))
            if user is None:
                raise SystemExit("User account not found.")
            first = getpass.getpass("New password (12+ characters): ")
            second = getpass.getpass("Confirm password: ")
            if first != second or len(first) < 12:
                raise SystemExit("Passwords must match and be at least 12 characters.")
            user.password_hash = PasswordHash.recommended().hash(first)
            active_sessions = (await session.scalars(select(UserSession).where(UserSession.user_id == user.id))).all()
            for active in active_sessions:
                await session.delete(active)
            record_audit(session, actor_id=None, action="password.reset_by_operator", target_type="user",
                         target_id=str(user.id), details={"method": "server_cli"})
            await session.commit()
            print(f"Password reset for {user.email}; all active sessions were revoked.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["bootstrap-admin", "reset-user-password", "copy-sqlite-to-postgres"])
    parser.add_argument("--source", default="sqlite+aiosqlite:///./draftly.db")
    parser.add_argument("email", nargs="?")
    args = parser.parse_args()
    if args.command == "bootstrap-admin":
        asyncio.run(bootstrap_admin())
    elif args.command == "reset-user-password":
        if not args.email:
            parser.error("reset-user-password needs an account email")
        asyncio.run(reset_user_password(args.email))
    else:
        asyncio.run(copy_sqlite_to_postgres(args.source))
