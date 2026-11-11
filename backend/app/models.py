import uuid
from datetime import UTC, datetime

from pydantic import EmailStr
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# --- User (Admin) Models ---
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    full_name: str | None = Field(default=None, max_length=255)
    is_active: bool = True
    is_superuser: bool = True


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=get_datetime_utc)


class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# --- Item / Domain Models ---
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=get_datetime_utc)


class ItemPublic(ItemBase):
    id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# --- Auth & Generic Models ---
class Message(SQLModel):
    message: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(SQLModel):
    sub: str | None = None
