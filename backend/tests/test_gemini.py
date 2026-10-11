from app.integrations import gemini
from app.models import Overview, User
from app.store import Store

DRAFT = gemini.BriefingDraft(headline="Morning, Maya!", body="You scored 92, up 3 on your week.", tip="Aim for 10:45 again.")


def overview() -> Overview:
    return Store().overview(1)


def test_no_key_falls_back_to_template():
    text = gemini.briefing_text(overview())
    assert text.startswith("Good morning Maya!") and text.endswith(gemini.NOTE)


def test_gemini_draft_is_joined_with_note(monkeypatch):
    calls = []
    monkeypatch.setattr(gemini, "_ask_gemini", lambda facts: calls.append(facts) or DRAFT)
    text = gemini.briefing_text(overview())
    assert text == f"{DRAFT.headline} {DRAFT.body} {DRAFT.tip} {gemini.NOTE}"
    gemini.briefing_text(overview())
    assert len(calls) == 1  # cached per night


def test_gemini_error_falls_back_and_is_not_cached(monkeypatch):
    def boom(facts):
        raise TimeoutError("slow")

    monkeypatch.setattr(gemini, "_ask_gemini", boom)
    assert gemini.briefing_text(overview()).startswith("Good morning Maya!")
    monkeypatch.setattr(gemini, "_ask_gemini", lambda facts: DRAFT)
    assert gemini.briefing_text(overview()).startswith(DRAFT.headline)


def test_facts_use_only_own_baseline():
    o = overview()
    facts = gemini._facts(o)
    assert "First name: Maya" in facts and "previous 6 nights" in facts and "/100" in facts
    for other in ("Jordan", "Sam", "Riley", "Wolfpack"):
        assert other not in facts  # no friends or squad data in the prompt


def test_no_sleep_yet():
    text = gemini.briefing_text(Overview(user=User(id=9, name="Kai")))
    assert "Sync your sleep" in text and text.endswith(gemini.NOTE)


def test_missing_punctuation_is_added(monkeypatch):
    draft = gemini.BriefingDraft(headline="Morning Sam", body="You scored 50!", tip="Bed by 11")
    monkeypatch.setattr(gemini, "_ask_gemini", lambda facts: draft)
    assert gemini.briefing_text(overview()).startswith("Morning Sam. You scored 50! Bed by 11. (Just")
