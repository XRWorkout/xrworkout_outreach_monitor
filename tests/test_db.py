from datetime import date

from xroutreach.db import OutreachDB


class FakeTable:
    def __init__(self):
        self.payload = None
        self.on_conflict = None
        self.filters = []
        self.deleted = False
        self.selected = None
        self.order_by = None
        self.limit_value = None
        self.data = [{"id": "followup-1"}]
        self.count = 0
        self.single_called = False

    def upsert(self, payload, on_conflict):
        self.payload = payload
        self.on_conflict = on_conflict
        return self

    def select(self, value, **kwargs):
        self.selected = value
        return self

    def delete(self):
        self.deleted = True
        return self

    def not_(self, name, operator, value):
        self.filters.append(("not", name, operator, value))
        return self

    def filter(self, name, operator, value):
        self.filters.append(("filter", name, operator, value))
        return self

    def eq(self, name, value):
        self.filters.append(("eq", name, value))
        return self

    def lte(self, name, value):
        self.filters.append(("lte", name, value))
        return self

    def order(self, value):
        self.order_by = value
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def single(self):
        self.single_called = True
        self.data = {"id": "opportunity-1"}
        return self

    def execute(self):
        return self


class FakeClient:
    def __init__(self):
        self.tables = {}
        self.table_calls = []
        self.fake_table = FakeTable()

    def table(self, name):
        assert name in {"raw_items", "followups", "opportunities", "offers", "drafts", "creators"}
        self.table_calls.append(name)
        if name not in self.tables:
            self.tables[name] = FakeTable()
        return self.tables[name]

    @property
    def fake_table(self):
        return self.tables.setdefault("followups", FakeTable())

    @fake_table.setter
    def fake_table(self, value):
        self.tables["followups"] = value


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

    table = db.client.tables["raw_items"]
    assert table.on_conflict == "dedupe_hash"
    assert table.payload == [
        {"dedupe_hash": "same", "title": "second"},
        {"dedupe_hash": "other", "title": "third"},
    ]


def test_fetch_due_followups_filters_pending_due_rows():
    db = OutreachDB.__new__(OutreachDB)
    db.client = FakeClient()

    rows = db.fetch_due_followups(date(2026, 6, 1), 25)

    assert rows == [{"id": "followup-1"}]
    assert db.client.fake_table.selected == "*, drafts(*, creators(*), opportunities(*))"
    assert ("eq", "status", "pending") in db.client.fake_table.filters
    assert ("lte", "due_date", "2026-06-01") in db.client.fake_table.filters
    assert db.client.fake_table.order_by == "due_date"
    assert db.client.fake_table.limit_value == 25


def test_fetch_opportunity_uses_single_row_lookup():
    db = OutreachDB.__new__(OutreachDB)
    db.client = FakeClient()

    row = db.fetch_opportunity("opportunity-1")

    assert row == {"id": "opportunity-1"}
    table = db.client.tables["opportunities"]
    assert table.selected == "*"
    assert ("eq", "id", "opportunity-1") in table.filters
    assert table.single_called


def test_delete_operational_data_deletes_dependency_order():
    db = OutreachDB.__new__(OutreachDB)
    db.client = FakeClient()

    before = db.delete_operational_data()

    assert before == {
        "raw_items": 0,
        "opportunities": 0,
        "creators": 0,
        "drafts": 0,
        "followups": 0,
        "offers": 0,
    }
    assert db.client.table_calls[-6:] == ["followups", "offers", "drafts", "opportunities", "creators", "raw_items"]
    for table in ["followups", "offers", "drafts", "opportunities", "creators", "raw_items"]:
        assert db.client.tables[table].deleted
        assert ("filter", "id", "not.is", "null") in db.client.tables[table].filters
