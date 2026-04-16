"""MongoDB async connection using Motor."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    """Open the Motor client and select the database."""
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    _db = _client[settings.mongodb_db_name]


async def close_db() -> None:
    """Close the Motor client."""
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None


def get_db() -> AsyncIOMotorDatabase:
    """Return the current database handle. Raises if not connected."""
    if _db is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return _db
