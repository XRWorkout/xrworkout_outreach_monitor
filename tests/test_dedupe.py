from xroutreach.dedupe import dedupe_hash


def test_dedupe_hash_is_stable():
    assert dedupe_hash("reddit", "abc", "https://example.com") == dedupe_hash(
        "reddit", "abc", "https://example.com"
    )


def test_dedupe_hash_changes_by_source():
    assert dedupe_hash("reddit", "abc") != dedupe_hash("youtube", "abc")
