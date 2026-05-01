-- StudyFlow public schema (run in Supabase SQL Editor on a fresh project).
-- Storage schema is managed by Supabase; do NOT recreate it here.
-- Run buckets.sql afterwards to create buckets and storage RLS policies.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


-- ============================================================================
-- FUNCTIONS (public schema)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."can_edit_note"("p_note_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM note_shares
    WHERE note_id = p_note_id
    AND shared_with = p_user_id
    AND permission = 'edit'
  );
$$;


CREATE OR REPLACE FUNCTION "public"."delete_auth_user_on_profile_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."get_user_email_by_id"("lookup_id" "uuid") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT email FROM auth.users WHERE id = lookup_id;
$$;


CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("lookup_email" "text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT id FROM auth.users WHERE email = lookup_email LIMIT 1;
$$;


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."is_note_shared_with"("p_note_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM note_shares
    WHERE note_id = p_note_id
    AND shared_with = p_user_id
  );
$$;


CREATE OR REPLACE FUNCTION "public"."remove_share"("p_share_id" "uuid", "p_note_id" "uuid", "p_owner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM notes WHERE id = p_note_id AND owner_id = p_owner_id) THEN
    RAISE EXCEPTION 'Not the note owner';
  END IF;

  DELETE FROM note_shares WHERE id = p_share_id AND note_id = p_note_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."save_note_downgrade"("p_note_id" "uuid", "p_title" "text", "p_content" "jsonb", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM notes WHERE id = p_note_id AND owner_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM note_shares WHERE note_id = p_note_id AND shared_with = p_user_id)
  THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE notes
  SET title = p_title, content = p_content,
      updated_at = now(), updated_by = p_user_id
  WHERE id = p_note_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."update_share_permission"("p_share_id" "uuid", "p_note_id" "uuid", "p_permission" "text", "p_owner_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM notes
        WHERE id = p_note_id AND owner_id = p_owner_id
    ) THEN
        RAISE EXCEPTION 'Only the note owner can change permissions';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM note_shares
        WHERE id = p_share_id AND note_id = p_note_id
    ) THEN
        RAISE EXCEPTION 'Share not found for this note';
    END IF;

    UPDATE note_shares
    SET permission = p_permission
    WHERE id = p_share_id AND note_id = p_note_id;
END;
$$;


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


CREATE TABLE IF NOT EXISTS "public"."gpa_calculations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subjects" "jsonb" NOT NULL,
    "gpa" numeric NOT NULL,
    "total_credits" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


CREATE TABLE IF NOT EXISTS "public"."note_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "note_id" "uuid" NOT NULL,
    "shared_with" "uuid" NOT NULL,
    "permission" "text" DEFAULT 'edit'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "note_shares_permission_check" CHECK (("permission" = ANY (ARRAY['view'::"text", 'edit'::"text"])))
);

ALTER TABLE ONLY "public"."note_shares" REPLICA IDENTITY FULL;


CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."notes" REPLICA IDENTITY FULL;


CREATE TABLE IF NOT EXISTS "public"."pomodoro_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_type" "text" DEFAULT 'focus'::"text" NOT NULL,
    "duration_minutes" integer DEFAULT 25 NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "completed" boolean DEFAULT false,
    CONSTRAINT "pomodoro_sessions_session_type_check" CHECK (("session_type" = ANY (ARRAY['focus'::"text", 'short_break'::"text", 'long_break'::"text"])))
);


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text"
);


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "priority" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'todo'::"text",
    "planned_date" "date",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['ongoing'::"text", 'completed'::"text", 'archived'::"text"])))
);


-- ============================================================================
-- PRIMARY KEYS / UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gpa_calculations"
    ADD CONSTRAINT "gpa_calculations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_note_id_shared_with_key" UNIQUE ("note_id", "shared_with");

ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pomodoro_sessions"
    ADD CONSTRAINT "pomodoro_sessions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");


-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX "idx_documents_user_id" ON "public"."documents" USING "btree" ("user_id");
CREATE INDEX "idx_note_shares_note_id" ON "public"."note_shares" USING "btree" ("note_id");
CREATE INDEX "idx_note_shares_shared_with" ON "public"."note_shares" USING "btree" ("shared_with");
CREATE INDEX "idx_notes_owner_id" ON "public"."notes" USING "btree" ("owner_id");
CREATE INDEX "idx_pomodoro_started_at" ON "public"."pomodoro_sessions" USING "btree" ("user_id", "started_at");
CREATE INDEX "idx_pomodoro_user_id" ON "public"."pomodoro_sessions" USING "btree" ("user_id");
CREATE INDEX "idx_tasks_planned_date" ON "public"."tasks" USING "btree" ("user_id", "planned_date");
CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("user_id", "status");
CREATE INDEX "idx_tasks_user_id" ON "public"."tasks" USING "btree" ("user_id");


-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE TRIGGER "on_profile_delete" AFTER DELETE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."delete_auth_user_on_profile_delete"();

CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();

-- Auto-create profile row on auth.users insert
DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";
CREATE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();


-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gpa_calculations"
    ADD CONSTRAINT "gpa_calculations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."note_shares"
    ADD CONSTRAINT "note_shares_shared_with_fkey" FOREIGN KEY ("shared_with") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."pomodoro_sessions"
    ADD CONSTRAINT "pomodoro_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."gpa_calculations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."note_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."pomodoro_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


-- tasks
CREATE POLICY "Allow users to create tasks" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Allow users to delete tasks" ON "public"."tasks" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Allow users to update tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Allow users to view tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

-- note_shares
CREATE POLICY "Anyone can view shares for accessible notes" ON "public"."note_shares" FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "Authenticated users can create shares" ON "public"."note_shares" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Users can delete shares" ON "public"."note_shares" FOR DELETE TO "authenticated" USING (("shared_with" = "auth"."uid"()));
CREATE POLICY "Users can view their shares" ON "public"."note_shares" FOR SELECT TO "authenticated" USING (("shared_with" = "auth"."uid"()));

-- notes
CREATE POLICY "Owner can delete notes" ON "public"."notes" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));
CREATE POLICY "Owner can update notes" ON "public"."notes" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"()));
CREATE POLICY "Owner can view notes" ON "public"."notes" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));
CREATE POLICY "Shared editors can update notes" ON "public"."notes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."note_shares"
  WHERE (("note_shares"."note_id" = "notes"."id") AND ("note_shares"."shared_with" = "auth"."uid"()) AND ("note_shares"."permission" = 'edit'::"text"))))) WITH CHECK ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."note_shares"
  WHERE (("note_shares"."note_id" = "notes"."id") AND ("note_shares"."shared_with" = "auth"."uid"()) AND ("note_shares"."permission" = 'edit'::"text"))))));
CREATE POLICY "Shared users can edit notes" ON "public"."notes" FOR UPDATE TO "authenticated" USING ("public"."can_edit_note"("id", "auth"."uid"()));
CREATE POLICY "Shared users can view notes" ON "public"."notes" FOR SELECT TO "authenticated" USING ("public"."is_note_shared_with"("id", "auth"."uid"()));
CREATE POLICY "Users can create notes" ON "public"."notes" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));
CREATE POLICY "Users can view shared notes" ON "public"."notes" FOR SELECT USING (("id" IN ( SELECT "note_shares"."note_id"
   FROM "public"."note_shares"
  WHERE ("note_shares"."shared_with" = "auth"."uid"()))));

-- documents
CREATE POLICY "Users can delete own documents" ON "public"."documents" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can insert own documents" ON "public"."documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own documents" ON "public"."documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view own documents" ON "public"."documents" FOR SELECT USING (("auth"."uid"() = "user_id"));

-- pomodoro_sessions
CREATE POLICY "Users can delete own sessions" ON "public"."pomodoro_sessions" FOR DELETE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can insert own sessions" ON "public"."pomodoro_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can update own sessions" ON "public"."pomodoro_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));
CREATE POLICY "Users can view own sessions" ON "public"."pomodoro_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));

-- profiles
CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));
CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));
CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));

-- gpa_calculations
CREATE POLICY "Users manage own gpa calculations" ON "public"."gpa_calculations" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));


-- ============================================================================
-- REALTIME PUBLICATION
-- Required so client subscriptions on note_shares/notes deliver DELETE payloads.
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.note_shares;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;


-- ============================================================================
-- GRANTS (public schema)
-- ============================================================================

GRANT ALL ON FUNCTION "public"."can_edit_note"("p_note_id" "uuid", "p_user_id" "uuid") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."delete_auth_user_on_profile_delete"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."get_user_email_by_id"("lookup_id" "uuid") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."get_user_id_by_email"("lookup_email" "text") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."is_note_shared_with"("p_note_id" "uuid", "p_user_id" "uuid") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."remove_share"("p_share_id" "uuid", "p_note_id" "uuid", "p_owner_id" "uuid") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."save_note_downgrade"("p_note_id" "uuid", "p_title" "text", "p_content" "jsonb", "p_user_id" "uuid") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."update_share_permission"("p_share_id" "uuid", "p_note_id" "uuid", "p_permission" "text", "p_owner_id" "uuid") TO "anon", "authenticated", "service_role";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon", "authenticated", "service_role";

GRANT ALL ON TABLE "public"."documents" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."gpa_calculations" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."note_shares" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."notes" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."pomodoro_sessions" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."tasks" TO "anon", "authenticated", "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon", "authenticated", "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon", "authenticated", "service_role";
