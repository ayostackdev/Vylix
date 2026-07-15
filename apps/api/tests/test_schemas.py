from __future__ import annotations

from app.schemas import (
    StreakOut,
    StreakWithPointsOut,
    PointsOut,
    TransactionOut,
    LeaderboardEntry,
    ContributionLeaderboardEntry,
    QuestionCreate,
    AnswerCreate,
    ConversationCreate,
    MessageCreate,
)


def test_streak_out_defaults():
    s = StreakOut()
    assert s.current_streak == 0
    assert s.longest_streak == 0
    assert s.last_activity_at is None


def test_streak_with_points_out_defaults():
    s = StreakWithPointsOut()
    assert s.total_points == 0


def test_points_out_defaults():
    p = PointsOut()
    assert p.total_points == 0


def test_transaction_out_model_config():
    t = TransactionOut(id="t1", amount=10, reason="daily_login")
    assert t.description is None
    assert t.created_at is None


def test_leaderboard_entry():
    e = LeaderboardEntry(user_id="u1", full_name="Test", value=100)
    assert e.avatar_url is None


def test_contribution_leaderboard_entry():
    e = ContributionLeaderboardEntry(user_id="u1", full_name="Test", contribution_score=50)
    assert e.avatar_url is None


def test_question_create():
    q = QuestionCreate(title="Help", content="How do I study?")
    assert q.title == "Help"


def test_answer_create():
    a = AnswerCreate(content="Just study hard")
    assert a.content == "Just study hard"


def test_conversation_create_defaults():
    c = ConversationCreate()
    assert c.type == "DIRECT"
    assert c.member_ids == []


def test_message_create_optional_metadata():
    m = MessageCreate(content="hello")
    assert m.metadata is None
    m2 = MessageCreate(content="hello", metadata={"key": "val"})
    assert m2.metadata == {"key": "val"}
