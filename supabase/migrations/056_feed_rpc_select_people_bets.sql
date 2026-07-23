-- Include 'select_people' feed bets in the feed for users who are in bet_invites
-- or are the creator. Previously only 'followers' bets were included.
CREATE OR REPLACE FUNCTION get_feed(
  p_user_id           text,
  p_cursor            timestamptz DEFAULT NULL,
  p_supports_poll_post   boolean DEFAULT false,
  p_supports_explore_bet boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_followed_ids   text[];
  v_feed_user_ids  text[];
  v_bet_items      jsonb;
  v_post_items     jsonb;
  v_poll_items     jsonb;
  v_ebp_items      jsonb;
  v_items          jsonb;
  v_next_cursor    text;
BEGIN

  -- ── 1. follows lookup (inlined — no extra round-trip) ──────────────────────
  SELECT ARRAY_AGG(following_id)
  INTO   v_followed_ids
  FROM   follows
  WHERE  follower_id = p_user_id AND status = 'accepted';

  v_followed_ids  := COALESCE(v_followed_ids, ARRAY[]::text[]);
  v_feed_user_ids := v_followed_ids || ARRAY[p_user_id];

  -- ── 2. bets ────────────────────────────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO   v_bet_items
  FROM (
    SELECT jsonb_build_object(
      'type',              'bet',
      'id',                b.id,
      'question',          b.question,
      'deadline',          b.deadline,
      'status',            b.status,
      'winning_option_id', b.winning_option_id,
      'creator_id',        b.creator_id,
      'created_at',        b.created_at,
      'audience',          b.audience,
      'bet_options', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id',             bo.id,
          'label',          bo.label,
          'tagged_user_id', bo.tagged_user_id,
          'balances',       (SELECT jsonb_build_object('display_name', bl.display_name, 'avatar_url', bl.avatar_url, 'username', bl.username)
                             FROM balances bl WHERE bl.user_id = bo.tagged_user_id)
        ))
        FROM bet_options bo WHERE bo.bet_id = b.id
      ), '[]'::jsonb),
      'bet_entries', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'user_id',       be.user_id,
          'option_id',     be.option_id,
          'points_staked', be.points_staked,
          'is_anonymous',  be.is_anonymous,
          'balances',      (SELECT jsonb_build_object('display_name', bl.display_name, 'avatar_url', bl.avatar_url, 'username', bl.username)
                            FROM balances bl WHERE bl.user_id = be.user_id)
        ))
        FROM bet_entries be WHERE be.bet_id = b.id
      ), '[]'::jsonb),
      'balances',     (SELECT jsonb_build_object('display_name', bl.display_name, 'avatar_url', bl.avatar_url, 'username', bl.username)
                       FROM balances bl WHERE bl.user_id = b.creator_id),
      'reactions', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.cnt))
        FROM (SELECT emoji, COUNT(*) AS cnt FROM bet_reactions WHERE bet_id = b.id GROUP BY emoji) r
      ), '[]'::jsonb),
      'my_reaction',  (SELECT emoji FROM bet_reactions WHERE bet_id = b.id AND user_id = p_user_id LIMIT 1),
      'comment_count', (SELECT COUNT(*) FROM bet_comments WHERE bet_id = b.id)
    ) AS row
    FROM bets b
    WHERE (
      -- all-followers feed bets: visible to followers and invited users
      (b.audience = 'followers' AND (
        b.creator_id = ANY(v_feed_user_ids)
        OR EXISTS (SELECT 1 FROM bet_invites bi WHERE bi.bet_id = b.id AND bi.user_id = p_user_id)
      ))
      OR
      -- select_people bets: only visible to the creator and explicitly invited users
      (b.audience = 'select_people' AND (
        b.creator_id = p_user_id
        OR EXISTS (SELECT 1 FROM bet_invites bi WHERE bi.bet_id = b.id AND bi.user_id = p_user_id)
      ))
    )
      AND (p_cursor IS NULL OR b.created_at < p_cursor)
      AND NOT EXISTS (
        SELECT 1 FROM posts p
        WHERE  p.bet_id = b.id
          AND  p.user_id = ANY(v_feed_user_ids)
          AND  (p.targeted_user_ids IS NULL OR p_user_id = ANY(p.targeted_user_ids))
      )
    ORDER BY b.created_at DESC
    LIMIT 25
  ) bets_sub;

  -- ── 3. posts ───────────────────────────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO   v_post_items
  FROM (
    SELECT jsonb_build_object(
      'type',              'post',
      'id',                p.id,
      'user_id',           p.user_id,
      'bet_id',            p.bet_id,
      'caption',           p.caption,
      'photo_url',         p.photo_url,
      'targeted_user_ids', p.targeted_user_ids,
      'created_at',        p.created_at,
      'balances',          (SELECT jsonb_build_object('display_name', bl.display_name, 'avatar_url', bl.avatar_url, 'username', bl.username)
                            FROM balances bl WHERE bl.user_id = p.user_id),
      'post_likes',   COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', pl.user_id)) FROM post_likes pl   WHERE pl.post_id = p.id), '[]'::jsonb),
      'post_comments',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',      pc.id))      FROM post_comments pc WHERE pc.post_id = p.id), '[]'::jsonb),
      'bets', CASE WHEN p.bet_id IS NOT NULL THEN (
        SELECT jsonb_build_object(
          'id',                b.id,
          'question',          b.question,
          'deadline',          b.deadline,
          'status',            b.status,
          'winning_option_id', b.winning_option_id,
          'creator_id',        b.creator_id,
          'created_at',        b.created_at,
          'event_id',          b.event_id,
          'bet_options',  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', bo.id, 'label', bo.label)) FROM bet_options bo WHERE bo.bet_id = b.id), '[]'::jsonb),
          'bet_entries',  COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'user_id', be.user_id, 'option_id', be.option_id, 'points_staked', be.points_staked,
              'balances', (SELECT jsonb_build_object('display_name', bl.display_name, 'avatar_url', bl.avatar_url, 'username', bl.username) FROM balances bl WHERE bl.user_id = be.user_id)
            )) FROM bet_entries be WHERE be.bet_id = b.id
          ), '[]'::jsonb),
          'balances', (SELECT jsonb_build_object('display_name', bl.display_name, 'avatar_url', bl.avatar_url, 'username', bl.username) FROM balances bl WHERE bl.user_id = b.creator_id),
          'events',   (SELECT jsonb_build_object('name', e.name) FROM events e WHERE e.id = b.event_id)
        )
        FROM bets b WHERE b.id = p.bet_id
      ) ELSE NULL END
    ) AS row
    FROM posts p
    WHERE p.user_id = ANY(v_feed_user_ids)
      AND (p.targeted_user_ids IS NULL OR p_user_id = ANY(p.targeted_user_ids))
      AND (p_cursor IS NULL OR p.created_at < p_cursor)
    ORDER BY p.created_at DESC
    LIMIT 25
  ) posts_sub;

  -- ── 4. poll posts (capability-gated) ───────────────────────────────────────
  IF p_supports_poll_post THEN
    SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
    INTO   v_poll_items
    FROM (
      SELECT jsonb_build_object(
        'type',              'poll_post',
        'id',                pp.poll_id,
        'poll_id',           pp.poll_id,
        'user_id',           pp.user_id,
        'caption',           pp.caption,
        'photo_url',         pp.photo_url,
        'targeted_user_ids', pp.targeted_user_ids,
        'created_at',        pp.created_at,
        'balances',          (SELECT jsonb_build_object('display_name', bl.display_name, 'avatar_url', bl.avatar_url, 'username', bl.username)
                              FROM balances bl WHERE bl.user_id = pp.user_id),
        'polls', CASE WHEN po.id IS NOT NULL THEN jsonb_build_object(
          'id',          po.id,
          'question',    po.question,
          'option_a',    po.option_a,
          'option_b',    po.option_b,
          'creator_id',  po.creator_id,
          'created_at',  po.created_at,
          'closes_at',   po.closes_at,
          'votes_a',     (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = po.id AND pv.side = 'a'),
          'votes_b',     (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = po.id AND pv.side = 'b'),
          'total_votes', (SELECT COUNT(*) FROM poll_votes pv WHERE pv.poll_id = po.id),
          'my_vote',     (SELECT side FROM poll_votes WHERE poll_id = po.id AND user_id = p_user_id LIMIT 1),
          'like_count',  (SELECT COUNT(*) FROM poll_likes WHERE poll_id = po.id),
          'liked_by_me', EXISTS(SELECT 1 FROM poll_likes WHERE poll_id = po.id AND user_id = p_user_id),
          'reactions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.cnt))
            FROM (SELECT emoji, COUNT(*) AS cnt FROM poll_reactions WHERE poll_id = po.id GROUP BY emoji) r
          ), '[]'::jsonb),
          'my_reaction', (SELECT emoji FROM poll_reactions WHERE poll_id = po.id AND user_id = p_user_id LIMIT 1),
          'comment_count', (SELECT COUNT(*) FROM poll_comments WHERE poll_id = po.id)
        ) ELSE NULL END
      ) AS row
      FROM poll_posts pp
      LEFT JOIN polls po ON po.id = pp.poll_id
      WHERE pp.user_id = ANY(v_feed_user_ids)
        AND (pp.targeted_user_ids IS NULL OR p_user_id = ANY(pp.targeted_user_ids))
        AND (p_cursor IS NULL OR pp.created_at < p_cursor)
      ORDER BY pp.created_at DESC
      LIMIT 25
    ) poll_sub;
  ELSE
    v_poll_items := '[]'::jsonb;
  END IF;

  -- ── 5. explore-bet posts (capability-gated) ────────────────────────────────
  IF p_supports_explore_bet THEN
    SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
    INTO   v_ebp_items
    FROM (
      SELECT jsonb_build_object(
        'type',           'explore_bet_post',
        'id',             ebp.id,
        'explore_bet_id', ebp.explore_bet_id,
        'user_id',        ebp.user_id,
        'caption',        ebp.caption,
        'photo_url',      ebp.photo_url,
        'created_at',     ebp.created_at,
        'balances',       (SELECT jsonb_build_object('display_name', bl.display_name, 'avatar_url', bl.avatar_url, 'username', bl.username)
                          FROM balances bl WHERE bl.user_id = ebp.user_id),
        'explore_bets', (
          SELECT jsonb_build_object(
            'id',            eb.id,
            'question',      eb.question,
            'option_a',      eb.option_a,
            'option_b',      eb.option_b,
            'status',        eb.status,
            'winning_side',  eb.winning_side,
            'closes_at',     eb.closes_at,
            'total_pts_a',   COALESCE((SELECT SUM(points_wagered) FROM explore_bet_entries WHERE explore_bet_id = eb.id AND side = 'a'), 0),
            'total_pts_b',   COALESCE((SELECT SUM(points_wagered) FROM explore_bet_entries WHERE explore_bet_id = eb.id AND side = 'b'), 0),
            'total_entries', (SELECT COUNT(*) FROM explore_bet_entries WHERE explore_bet_id = eb.id),
            'my_entry',      (SELECT jsonb_build_object('side', side, 'points_wagered', points_wagered)
                              FROM explore_bet_entries WHERE explore_bet_id = eb.id AND user_id = p_user_id LIMIT 1),
            'like_count',    (SELECT COUNT(*) FROM explore_bet_likes WHERE explore_bet_id = eb.id),
            'liked_by_me',   EXISTS(SELECT 1 FROM explore_bet_likes WHERE explore_bet_id = eb.id AND user_id = p_user_id),
            'reactions', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.cnt))
              FROM (SELECT emoji, COUNT(*) AS cnt FROM explore_bet_reactions WHERE explore_bet_id = eb.id GROUP BY emoji) r
            ), '[]'::jsonb),
            'my_reaction',   (SELECT emoji FROM explore_bet_reactions WHERE explore_bet_id = eb.id AND user_id = p_user_id LIMIT 1),
            'comment_count', (SELECT COUNT(*) FROM explore_bet_comments WHERE explore_bet_id = eb.id),
            'followed_entries', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'user_id', e.user_id,
                'side',    e.side,
                'bettor',  (SELECT jsonb_build_object('display_name', bl.display_name, 'username', bl.username, 'avatar_url', bl.avatar_url)
                            FROM balances bl WHERE bl.user_id = e.user_id)
              ))
              FROM explore_bet_entries e
              WHERE e.explore_bet_id = eb.id
                AND e.user_id != p_user_id
                AND e.user_id = ANY(v_followed_ids)
            ), '[]'::jsonb),
            'other_entry_count', (
              SELECT COUNT(*) FROM explore_bet_entries
              WHERE  explore_bet_id = eb.id
                AND  user_id != p_user_id
                AND  NOT (user_id = ANY(v_followed_ids))
            )
          )
          FROM explore_bets eb WHERE eb.id = ebp.explore_bet_id
        )
      ) AS row
      FROM explore_bet_posts ebp
      WHERE ebp.user_id = ANY(v_feed_user_ids)
        AND (p_cursor IS NULL OR ebp.created_at < p_cursor)
      ORDER BY ebp.created_at DESC
      LIMIT 25
    ) ebp_sub;
  ELSE
    v_ebp_items := '[]'::jsonb;
  END IF;

  -- ── 6. merge, sort descending by created_at, slice to 20 ──────────────────
  SELECT
    COALESCE(jsonb_agg(item ORDER BY ca DESC), '[]'::jsonb),
    CASE WHEN COUNT(*) = 20 THEN MIN(ca) ELSE NULL END
  INTO v_items, v_next_cursor
  FROM (
    SELECT item, (item->>'created_at') AS ca
    FROM (
      SELECT value AS item FROM jsonb_array_elements(v_bet_items)
      UNION ALL
      SELECT value FROM jsonb_array_elements(v_post_items)
      UNION ALL
      SELECT value FROM jsonb_array_elements(v_poll_items)
      UNION ALL
      SELECT value FROM jsonb_array_elements(v_ebp_items)
    ) combined
    ORDER BY (item->>'created_at') DESC
    LIMIT 20
  ) top20;

  RETURN jsonb_build_object(
    'items',       COALESCE(v_items, '[]'::jsonb),
    'nextCursor',  v_next_cursor,
    'followedIds', to_jsonb(v_followed_ids)
  );
END;
$$;
