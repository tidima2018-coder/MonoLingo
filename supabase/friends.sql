
-- MonoLingo: Friends System
-- Run in Supabase SQL Editor after schema.sql

BEGIN;

-- 1. Каталог пользователей для поиска друзей

CREATE TABLE IF NOT EXISTS public.friend_directory (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL
        CHECK (char_length(username) BETWEEN 1 AND 32),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Синхронизация никнеймов

CREATE OR REPLACE FUNCTION public.sync_friend_directory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.friend_directory (
        user_id,
        username,
        updated_at
    )
    VALUES (
        NEW.id,
        NEW.username,
        now()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
        username = EXCLUDED.username,
        updated_at = now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_friend_directory_after_profile
ON public.profiles;

CREATE TRIGGER sync_friend_directory_after_profile
AFTER INSERT OR UPDATE OF username
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_friend_directory();

-- Добавляем уже зарегистрированных игроков

INSERT INTO public.friend_directory (user_id, username)
SELECT id, username
FROM public.profiles
ON CONFLICT (user_id)
DO UPDATE SET username = EXCLUDED.username;

-- 3. Таблица дружбы и заявок

CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    requester UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

    recipient UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'rejected')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (requester <> recipient)
);

-- Запрещаем дублирование дружбы

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_unique
ON public.friendships (
    least(requester, recipient),
    greatest(requester, recipient)
);

CREATE INDEX IF NOT EXISTS friendships_recipient_status
ON public.friendships (recipient, status);

CREATE INDEX IF NOT EXISTS friendships_requester_status
ON public.friendships (requester, status);

-- 4. Защита данных RLS

ALTER TABLE public.friend_directory
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.friendships
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.friend_directory
FROM anon, authenticated;

REVOKE ALL ON public.friendships
FROM anon, authenticated;

GRANT SELECT ON public.friendships
TO authenticated;

DROP POLICY IF EXISTS friends_read_participant
ON public.friendships;

CREATE POLICY friends_read_participant
ON public.friendships
FOR SELECT
TO authenticated
USING (
    requester = (SELECT auth.uid())
    OR recipient = (SELECT auth.uid())
);

-- 5. Поиск игроков по никнейму

CREATE OR REPLACE FUNCTION public.search_friend_users(
    p_query TEXT
)
RETURNS TABLE (
    user_id UUID,
    username TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT d.user_id, d.username
    FROM public.friend_directory d
    WHERE auth.uid() IS NOT NULL
      AND char_length(btrim(coalesce(p_query, ''))) >= 2
      AND lower(d.username) LIKE
          '%' || lower(btrim(p_query)) || '%'
      AND d.user_id <> auth.uid()
    LIMIT 20;
$$;

-- 6. Отправка заявки в друзья

CREATE OR REPLACE FUNCTION public.send_friend_request(
    p_target UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_target IS NULL OR p_target = auth.uid() THEN
        RAISE EXCEPTION 'Invalid friend';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.friend_directory
        WHERE user_id = p_target
    ) THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Повторная заявка после отклонения

    UPDATE public.friendships
    SET requester = auth.uid(),
        recipient = p_target,
        status = 'pending',
        created_at = now(),
        updated_at = now()
    WHERE least(requester, recipient) =
          least(auth.uid(), p_target)
      AND greatest(requester, recipient) =
          greatest(auth.uid(), p_target)
      AND status = 'rejected'
    RETURNING id INTO v_id;

    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.friendships
        WHERE least(requester, recipient) =
              least(auth.uid(), p_target)
          AND greatest(requester, recipient) =
              greatest(auth.uid(), p_target)
    ) THEN
        RAISE EXCEPTION 'Friend request already exists';
    END IF;

    INSERT INTO public.friendships (
        requester,
        recipient
    )
    VALUES (
        auth.uid(),
        p_target
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- 7. Принятие или отклонение заявки

CREATE OR REPLACE FUNCTION public.respond_friend_request(
    p_request UUID,
    p_accept BOOLEAN
)
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

    UPDATE public.friendships
    SET status = CASE
        WHEN p_accept THEN 'accepted'
        ELSE 'rejected'
    END,
    updated_at = now()
    WHERE id = p_request
      AND recipient = auth.uid()
      AND status = 'pending';

    GET DIAGNOSTICS v_count = ROW_COUNT;

    IF v_count = 0 THEN
        RAISE EXCEPTION 'Friend request unavailable';
    END IF;

    RETURN TRUE;
END;
$$;

-- 8. Удаление друга

CREATE OR REPLACE FUNCTION public.remove_friend(
    p_friend UUID
)
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
    WHERE status = 'accepted'
      AND least(requester, recipient) =
          least(auth.uid(), p_friend)
      AND greatest(requester, recipient) =
          greatest(auth.uid(), p_friend);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count > 0;
END;
$$;

-- 9. Список друзей

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE (
    user_id UUID,
    username TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT d.user_id, d.username
    FROM public.friendships f
    JOIN public.friend_directory d
      ON d.user_id = CASE
          WHEN f.requester = auth.uid()
          THEN f.recipient
          ELSE f.requester
      END
    WHERE f.status = 'accepted'
      AND auth.uid() IN (f.requester, f.recipient)
    ORDER BY lower(d.username);
$$;

-- 10. Входящие заявки

CREATE OR REPLACE FUNCTION public.list_friend_requests()
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
    SELECT
        f.id,
        d.user_id,
        d.username,
        f.created_at
    FROM public.friendships f
    JOIN public.friend_directory d
      ON d.user_id = f.requester
    WHERE f.recipient = auth.uid()
      AND f.status = 'pending'
    ORDER BY f.created_at DESC;
$$;

-- 11. Разрешения на серверные функции

REVOKE ALL ON FUNCTION public.search_friend_users(TEXT)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.send_friend_request(UUID)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.respond_friend_request(UUID, BOOLEAN)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.remove_friend(UUID)
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.list_friends()
FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.list_friend_requests()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.search_friend_users(TEXT)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.respond_friend_request(UUID, BOOLEAN)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.remove_friend(UUID)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_friends()
TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_friend_requests()
TO authenticated;

-- 12. Realtime: онлайн-статусы друзей

DROP POLICY IF EXISTS friends_presence_read
ON realtime.messages;

CREATE POLICY friends_presence_read
ON realtime.messages
FOR SELECT
TO authenticated
USING (
    realtime.topic() = 'user:' || (SELECT auth.uid())::TEXT

    OR EXISTS (
        SELECT 1
        FROM public.friendships f
        WHERE f.status = 'accepted'
          AND (
              (
                  f.requester = (SELECT auth.uid())
                  AND realtime.topic() =
                      'user:' || f.recipient::TEXT
              )
              OR
              (
                  f.recipient = (SELECT auth.uid())
                  AND realtime.topic() =
                      'user:' || f.requester::TEXT
              )
          )
    )
);

DROP POLICY IF EXISTS friends_presence_write_own
ON realtime.messages;

CREATE POLICY friends_presence_write_own
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
    realtime.topic() = 'user:' || (SELECT auth.uid())::TEXT
);

-- 13. Realtime: уведомления о заявках

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_publication
        WHERE pubname = 'supabase_realtime'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'friendships'
    )
    THEN
        ALTER PUBLICATION supabase_realtime
        ADD TABLE public.friendships;
    END IF;
END;
$$;

-- Refresh PostgREST so the new RPC functions become available to the website.
NOTIFY pgrst, 'reload schema';

COMMIT;
