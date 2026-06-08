from __future__ import annotations

from xroutreach.conversation_sources import feed_entries, normalize_blog_entry, normalize_discourse_topic


def test_normalize_discourse_topic_builds_forum_thread_raw_item():
    row = normalize_discourse_topic(
        {
            "id": 42,
            "slug": "quest-workout-feedback",
            "title": "Quest workout feedback",
            "excerpt": "<p>Looking for a better VR cardio app.</p>",
            "created_at": "2026-06-01T00:00:00Z",
            "posts_count": 5,
            "like_count": 7,
            "views": 120,
            "last_poster_username": "vrfan",
        },
        {"name": "VR Forum", "source": "vr_forum"},
        "https://forum.example.com",
    )

    assert row is not None
    assert row["source"] == "vr_forum"
    assert row["source_url"] == "https://forum.example.com/t/quest-workout-feedback/42"
    assert row["raw_json"]["source_type"] == "forum_thread"
    assert row["raw_json"]["engagement"]["comments"] == 5


def test_feed_entries_and_blog_normalization_build_article_raw_item():
    entries = feed_entries(
        """<?xml version="1.0"?>
        <rss version="2.0"><channel><item>
          <guid>article-1</guid>
          <title>Quest fitness apps grow</title>
          <link>https://blog.example.com/quest-fitness</link>
          <description><![CDATA[<p>VR fitness is growing.</p>]]></description>
          <pubDate>Mon, 01 Jun 2026 00:00:00 +0000</pubDate>
        </item></channel></rss>"""
    )
    row = normalize_blog_entry(entries[0], {"name": "VR Blog", "url": "https://blog.example.com/feed"})

    assert row is not None
    assert row["source"] == "vr_blog"
    assert row["title"] == "Quest fitness apps grow"
    assert row["raw_json"]["source_type"] == "blog_article"
