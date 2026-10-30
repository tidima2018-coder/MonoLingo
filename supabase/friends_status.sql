-- Friend request status lookup for the existing friends.sql schema.
-- Safe, additive migration: reads a relation for the signed-in user only.
BEGIN;

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

REVOKE ALL ON FUNCTION public.friendship_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friendship_status(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
