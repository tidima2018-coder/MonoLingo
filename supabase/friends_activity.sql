-- MonoLingo friends: outgoing requests and private last-seen activity.
-- Apply after supabase/friends.sql. Additive only; existing rows are preserved.
BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.friendship_status(p_target UUID)
RETURNS TABLE (
    friendship_id UUID,
    status TEXT,
    sent_by_me BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_target IS NULL OR p_target = auth.uid() THEN
        RETURN;
    END IF;
    RETURN QUERY
    SELECT f.id, f.status, (f.requester = auth.uid())
    FROM public.friendships AS f
    WHERE least(f.requester, f.recipient) = least(auth.uid(), p_target)
      AND greatest(f.requester, f.recipient) = greatest(auth.uid(), p_target)
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_outgoing_friend_requests()
RETURNS TABLE (
    request_id UUID,
    user_id UUID,
    username TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT f.id, d.user_id, d.username, f.created_at
    FROM public.friendships AS f
    JOIN public.friend_directory AS d ON d.user_id = f.recipient
    WHERE f.requester = auth.uid()
      AND f.status = 'pending'
    ORDER BY f.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.cancel_friend_request(p_request UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    DELETE FROM public.friendships
    WHERE id = p_request
      AND requester = auth.uid()
      AND status = 'pending';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
END;
$$;

-- Heartbeat is bound to auth.uid(); the browser cannot set another user's time.
-- Throttling prevents writes more often than once per 50 seconds.
CREATE OR REPLACE FUNCTION public.touch_my_last_seen()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_last_seen TIMESTAMPTZ;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    UPDATE public.profiles
    SET last_seen_at = now()
    WHERE id = auth.uid()
      AND (last_seen_at IS NULL OR last_seen_at < now() - interval '50 seconds')
    RETURNING last_seen_at INTO v_last_seen;
    IF v_last_seen IS NULL THEN
        SELECT p.last_seen_at INTO v_last_seen
        FROM public.profiles AS p
        WHERE p.id = auth.uid();
    END IF;
    IF v_last_seen IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;
    RETURN v_last_seen;
END;
$$;

-- Last-seen data is returned only for accepted friends of the caller.
CREATE OR REPLACE FUNCTION public.list_friend_activity()
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    last_seen_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT d.user_id, d.username, p.last_seen_at
    FROM public.friendships AS f
    JOIN public.friend_directory AS d
      ON d.user_id = CASE
          WHEN f.requester = auth.uid() THEN f.recipient
          ELSE f.requester
      END
    JOIN public.profiles AS p ON p.id = d.user_id
    WHERE f.status = 'accepted'
      AND auth.uid() IN (f.requester, f.recipient)
    ORDER BY lower(d.username);
$$;

REVOKE ALL ON FUNCTION public.friendship_status(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_outgoing_friend_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_friend_request(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_my_last_seen() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_friend_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friendship_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_outgoing_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_my_last_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friend_activity() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
