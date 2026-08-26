-- One-time fix: update post 00407cdf to point to the correct bet.
UPDATE posts
SET bet_id = '0804600b-f925-4b13-b679-8d37cc0eff64'
WHERE id = '00407cdf-55f8-479a-8ee3-65de1578666b';
