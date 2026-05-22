-- Store the Linear comment ID created when a customer comment is synced to
-- Linear. This lets the public view show team replies threaded under the
-- customer's comment (without exposing unrelated internal Linear comments) and
-- detect when a comment was deleted in Linear so it can be hidden publicly.

alter table public.view_comments
  add column if not exists linear_comment_id text;
