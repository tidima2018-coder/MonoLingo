-- Allow every signed-in MonoLingo user to use friends and submit reviews.
-- Apply manually in the Supabase SQL Editor after friends.sql.
-- This preserves admin-only review reading and does not change roles or user data.

-- Friend requests are created and managed only through these identity-checking RPCs.
GRANT EXECUTE ON FUNCTION public.search_friend_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friend_requests() TO authenticated;

-- A signed-in user can see only friendship rows involving their own account.
GRANT SELECT ON public.friendships TO authenticated;
DROP POLICY IF EXISTS friends_read_participant ON public.friendships;
CREATE POLICY friends_read_participant
ON public.friendships
FOR SELECT
TO authenticated
USING (
    requester = (SELECT auth.uid())
    OR recipient = (SELECT auth.uid())
);

-- All signed-in users can submit their own review using their profile nickname.
-- Reading reviews remains governed by the existing administrator policy/RPC.
GRANT INSERT, SELECT ON public.reviews TO authenticated;
DROP POLICY IF EXISTS "Users create own reviews" ON public.reviews;
DROP POLICY IF EXISTS reviews_insert_own_authenticated ON public.reviews;
CREATE POLICY reviews_insert_own_authenticated
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = (SELECT auth.uid())
    AND username = (
        SELECT p.username
        FROM public.profiles AS p
        WHERE p.id = (SELECT auth.uid())
    )
);
