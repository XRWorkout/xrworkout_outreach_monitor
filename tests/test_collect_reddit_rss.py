from scripts.collect_reddit_rss import parse_feed


def test_parse_feed_keeps_submission_entries_matching_keywords():
    rows = parse_feed(
        SAMPLE_FEED,
        "https://www.reddit.com/r/vrfit/.rss",
        "subreddit",
        "vrfit",
        limit=10,
    )

    assert len(rows) == 1
    row = rows[0]
    assert row["source"] == "reddit"
    assert row["external_id"] == "reddit_rss_t3_abc123"
    assert row["source_url"] == "https://www.reddit.com/r/vrfit/comments/abc123/post/"
    assert row["author_name"] == "/u/tester"
    assert row["body"] == "I need a Quest workout routine for cardio."
    assert row["raw_json"]["collector"] == "reddit_rss"
    assert row["raw_json"]["subreddit"] == "vrfit"
    assert row["published_at"] == "2026-05-24T12:00:00+00:00"


def test_parse_feed_ignores_non_submission_entries_and_irrelevant_subreddit_posts():
    rows = parse_feed(
        SAMPLE_FEED,
        "https://www.reddit.com/r/vrfit/.rss",
        "subreddit",
        "vrfit",
        limit=10,
    )

    assert {row["external_id"] for row in rows} == {"reddit_rss_t3_abc123"}


SAMPLE_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <author>
      <name>/u/tester</name>
      <uri>https://www.reddit.com/user/tester</uri>
    </author>
    <category term="vrfit" label="r/vrfit"/>
    <content type="html">&lt;div&gt;I need a Quest workout routine for cardio.&lt;/div&gt;</content>
    <id>t3_abc123</id>
    <link href="https://www.reddit.com/r/vrfit/comments/abc123/post/" />
    <published>2026-05-24T12:00:00+00:00</published>
    <title>Quest workout routine</title>
  </entry>
  <entry>
    <content type="html">&lt;div&gt;A subreddit listing entry.&lt;/div&gt;</content>
    <id>t5_subreddit</id>
    <link href="https://www.reddit.com/r/vrfit/" />
    <updated>2026-05-24T12:01:00+00:00</updated>
    <title>Virtual Reality Fitness</title>
  </entry>
  <entry>
    <author>
      <name>/u/irrelevant</name>
      <uri>https://www.reddit.com/user/irrelevant</uri>
    </author>
    <category term="vrfit" label="r/vrfit"/>
    <content type="html">&lt;div&gt;This is about cooking dinner.&lt;/div&gt;</content>
    <id>t3_irrelevant</id>
    <link href="https://www.reddit.com/r/vrfit/comments/irrelevant/post/" />
    <published>2026-05-24T12:02:00+00:00</published>
    <title>Dinner question</title>
  </entry>
</feed>
"""
