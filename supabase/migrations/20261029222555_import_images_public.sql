-- Product pictures only (brand catalogue photos) — public so the page uses stable, cacheable URLs
-- instead of ~500 signed URLs per page open (owner 30 Oct 2026: the page must be fast).
update storage.buckets set public = true where id = 'import-images';
