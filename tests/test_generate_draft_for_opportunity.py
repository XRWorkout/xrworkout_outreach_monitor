from scripts.generate_draft_for_opportunity import actionable_for_operator


def test_actionable_for_operator_blocks_unsafe_opportunities():
    assert not actionable_for_operator({"outreach_safety": "do_not_engage", "recommended_action": "email"})
    assert not actionable_for_operator({"outreach_safety": "safe", "recommended_action": "do_not_engage"})


def test_actionable_for_operator_allows_operator_selected_safe_opportunities():
    assert actionable_for_operator({"outreach_safety": "review", "recommended_action": "monitor"})
    assert actionable_for_operator({"outreach_safety": "safe", "recommended_action": "comment"})
