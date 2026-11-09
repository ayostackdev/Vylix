from __future__ import annotations

import base64
import hashlib
import hmac
import time

from app.core.config import get_settings
from app.routers.ws import _ice_servers, _turn_credentials


def test_turn_credentials_are_short_lived_hmac(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "webrtc_turn_secret", "test-secret")
    monkeypatch.setattr(settings, "webrtc_turn_ttl_seconds", 600)
    monkeypatch.setattr(settings, "webrtc_stun_urls", "stun:example.org:19302")
    monkeypatch.setattr(settings, "webrtc_turn_urls", "turn:turn.example.org:3478")
    monkeypatch.setattr(settings, "webrtc_turn_username", "static-user")
    monkeypatch.setattr(settings, "webrtc_turn_credential", "static-pass")

    username, credential = _turn_credentials("user-123")

    expiry_text, _, user = username.partition(":")
    assert user == "user-123"
    now = int(time.time())
    assert now + 590 <= int(expiry_text) <= now + 610

    expected = base64.b64encode(
        hmac.new(b"test-secret", username.encode("utf-8"), hashlib.sha1).digest()
    ).decode("ascii")
    assert credential == expected

    servers = _ice_servers("user-123")
    assert servers[0] == {"urls": ["stun:example.org:19302"]}
    assert servers[1]["urls"] == ["turn:turn.example.org:3478"]
    assert servers[1]["username"] == username
    assert servers[1]["credential"] == expected


def test_static_turn_credentials_used_without_secret(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "webrtc_turn_secret", "")
    monkeypatch.setattr(settings, "webrtc_stun_urls", "")
    monkeypatch.setattr(settings, "webrtc_turn_urls", "turn:turn.example.org:3478")
    monkeypatch.setattr(settings, "webrtc_turn_username", "static-user")
    monkeypatch.setattr(settings, "webrtc_turn_credential", "static-pass")

    assert _ice_servers("user-123") == [
        {
            "urls": ["turn:turn.example.org:3478"],
            "username": "static-user",
            "credential": "static-pass",
        }
    ]


def test_stun_only_when_no_turn_urls(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "webrtc_stun_urls", "stun:example.org:19302")
    monkeypatch.setattr(settings, "webrtc_turn_urls", "")
    monkeypatch.setattr(settings, "webrtc_turn_secret", "test-secret")

    assert _ice_servers("user-123") == [{"urls": ["stun:example.org:19302"]}]
