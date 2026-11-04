-- Migration 098: Hide feed posts that were auto-created on bet resolution
-- without any photo, video, or caption. These are content-less placeholders
-- that should never have been visible.
UPDATE posts
SET feed_visible = false
WHERE feed_visible = true
  AND (photo_url IS NULL OR photo_url = '')
  AND (video_url IS NULL OR video_url = '')
  AND (caption  IS NULL OR caption  = '');
