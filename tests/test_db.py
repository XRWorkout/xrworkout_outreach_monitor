from xroutreach.db import OutreachDB


class FakeTable:
    def __init__(self):
        self.payload = None
        self.on_conflict = None

    def upsert(self, payload, on_conflict):
        self.payload = payload
        self.on_conflict = on_conflict
        return self

    def execute(self):
        return None


class FakeClient:
    def __init__(self):
        self.fake_table = FakeTable()

    def table(self, name):
        assert name == "raw_items"
        return self.fake_table


def test_upsert_raw_items_dedupes_batch_by_dedupe_hash():
    db = OutreachDB.__new__(OutreachDB)
    db.client = FakeClient()

    db.upsert_raw_items(
        [
            {"dedupe_hash": "same", "title": "first"},
            {"dedupe_hash": "same", "title": "second"},
            {"dedupe_hash": "other", "title": "third"},
        ]
    )

    assert db.client.fake_table.on_conflict == "dedupe_hash"
    assert db.client.fake_table.payload == [
        {"dedupe_hash": "same", "title": "second"},
        {"dedupe_hash": "other", "title": "third"},
    ]
