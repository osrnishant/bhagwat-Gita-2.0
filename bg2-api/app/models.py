from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=8000)


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    language: str = Field(default="en", pattern="^(hi|en|sa|mixed)$")
    voice: bool = False
    top_k: int = Field(default=3, ge=1, le=10)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=8)


class VerseResult(BaseModel):
    chapter: int
    verse: int
    sanskrit: str
    hindi: str
    english: str


class AskResponse(BaseModel):
    response_text: str
    verses: list[VerseResult]
    audio_url: str | None = None
    retrieval_scores: list[float]


class HealthResponse(BaseModel):
    status: str
    vector_count: int
    model: str
