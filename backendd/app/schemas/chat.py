from datetime import datetime
from pydantic import BaseModel


class ChatThreadCreate(BaseModel):
    title: str | None = None


class ChatThreadRead(BaseModel):
    id: int
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    last_message: str | None = None


class ChatMessageRead(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime


class ChatThreadDetail(BaseModel):
    thread: ChatThreadRead
    messages: list[ChatMessageRead]


class ChatMessageCreate(BaseModel):
    content: str
    report_id: int | None = None
