--
-- PostgreSQL database dump
--

\restrict gIpsQB5FNEYWvLxwUeWpDHAmEmpUzF82tBOIaV7tnFIgiRDBhqld260twaSUfJv

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$

BEGIN

    INSERT INTO public.profiles (id, full_name, avatar_url)

    VALUES (

        NEW.id,

        NEW.raw_user_meta_data ->> 'full_name',

        NEW.raw_user_meta_data ->> 'avatar_url'

    );

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

BEGIN

    NEW.updated_at = now();

    RETURN NEW;

END;

$$;


ALTER FUNCTION public.update_updated_at() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: document_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    tag text NOT NULL
);


ALTER TABLE public.document_tags OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    file_type text,
    category text,
    file_size bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: exam_milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_id uuid NOT NULL,
    title text NOT NULL,
    target_date date,
    completed boolean DEFAULT false
);


ALTER TABLE public.exam_milestones OWNER TO postgres;

--
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    subject text,
    exam_date timestamp with time zone NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.exams OWNER TO postgres;

--
-- Name: planner_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.planner_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    event_type text DEFAULT 'other'::text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    recurrence_rule text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT planner_events_event_type_check CHECK ((event_type = ANY (ARRAY['class'::text, 'study'::text, 'assignment'::text, 'reminder'::text, 'other'::text])))
);


ALTER TABLE public.planner_events OWNER TO postgres;

--
-- Name: pomodoro_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pomodoro_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    task_id uuid,
    session_type text DEFAULT 'focus'::text NOT NULL,
    duration_minutes integer DEFAULT 25 NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    completed boolean DEFAULT false,
    CONSTRAINT pomodoro_sessions_session_type_check CHECK ((session_type = ANY (ARRAY['focus'::text, 'short_break'::text, 'long_break'::text])))
);


ALTER TABLE public.pomodoro_sessions OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    avatar_url text,
    timezone text DEFAULT 'UTC'::text,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text,
    status text DEFAULT 'todo'::text,
    planned_date date,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['ongoing'::text, 'completed'::text])))
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: document_tags document_tags_document_id_tag_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_document_id_tag_key UNIQUE (document_id, tag);


--
-- Name: document_tags document_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: exam_milestones exam_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_milestones
    ADD CONSTRAINT exam_milestones_pkey PRIMARY KEY (id);


--
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (id);


--
-- Name: planner_events planner_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.planner_events
    ADD CONSTRAINT planner_events_pkey PRIMARY KEY (id);


--
-- Name: pomodoro_sessions pomodoro_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pomodoro_sessions
    ADD CONSTRAINT pomodoro_sessions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: idx_document_tags_document_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_document_tags_document_id ON public.document_tags USING btree (document_id);


--
-- Name: idx_documents_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_user_id ON public.documents USING btree (user_id);


--
-- Name: idx_exam_milestones_exam_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exam_milestones_exam_id ON public.exam_milestones USING btree (exam_id);


--
-- Name: idx_exams_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_exams_user_id ON public.exams USING btree (user_id);


--
-- Name: idx_planner_start_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_planner_start_time ON public.planner_events USING btree (user_id, start_time);


--
-- Name: idx_planner_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_planner_user_id ON public.planner_events USING btree (user_id);


--
-- Name: idx_pomodoro_started_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pomodoro_started_at ON public.pomodoro_sessions USING btree (user_id, started_at);


--
-- Name: idx_pomodoro_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pomodoro_user_id ON public.pomodoro_sessions USING btree (user_id);


--
-- Name: idx_tasks_planned_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_planned_date ON public.tasks USING btree (user_id, planned_date);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (user_id, status);


--
-- Name: idx_tasks_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_user_id ON public.tasks USING btree (user_id);


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tasks update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: document_tags document_tags_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_tags
    ADD CONSTRAINT document_tags_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;


--
-- Name: documents documents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: exam_milestones exam_milestones_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_milestones
    ADD CONSTRAINT exam_milestones_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;


--
-- Name: exams exams_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: planner_events planner_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.planner_events
    ADD CONSTRAINT planner_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pomodoro_sessions pomodoro_sessions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pomodoro_sessions
    ADD CONSTRAINT pomodoro_sessions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: pomodoro_sessions pomodoro_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pomodoro_sessions
    ADD CONSTRAINT pomodoro_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: tasks Allow users to create tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to create tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: tasks Allow users to delete tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to delete tasks" ON public.tasks FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: tasks Allow users to update tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to update tasks" ON public.tasks FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: tasks Allow users to view tasks; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow users to view tasks" ON public.tasks FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: document_tags Users can delete own document tags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own document tags" ON public.document_tags FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.documents
  WHERE ((documents.id = document_tags.document_id) AND (documents.user_id = auth.uid())))));


--
-- Name: documents Users can delete own documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own documents" ON public.documents FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: planner_events Users can delete own events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own events" ON public.planner_events FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: exam_milestones Users can delete own exam milestones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own exam milestones" ON public.exam_milestones FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.exams
  WHERE ((exams.id = exam_milestones.exam_id) AND (exams.user_id = auth.uid())))));


--
-- Name: exams Users can delete own exams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own exams" ON public.exams FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: pomodoro_sessions Users can delete own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete own sessions" ON public.pomodoro_sessions FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: document_tags Users can insert own document tags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own document tags" ON public.document_tags FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.documents
  WHERE ((documents.id = document_tags.document_id) AND (documents.user_id = auth.uid())))));


--
-- Name: documents Users can insert own documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own documents" ON public.documents FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: planner_events Users can insert own events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own events" ON public.planner_events FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: exam_milestones Users can insert own exam milestones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own exam milestones" ON public.exam_milestones FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.exams
  WHERE ((exams.id = exam_milestones.exam_id) AND (exams.user_id = auth.uid())))));


--
-- Name: exams Users can insert own exams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own exams" ON public.exams FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: pomodoro_sessions Users can insert own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own sessions" ON public.pomodoro_sessions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: documents Users can update own documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own documents" ON public.documents FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: planner_events Users can update own events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own events" ON public.planner_events FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: exam_milestones Users can update own exam milestones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own exam milestones" ON public.exam_milestones FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.exams
  WHERE ((exams.id = exam_milestones.exam_id) AND (exams.user_id = auth.uid())))));


--
-- Name: exams Users can update own exams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own exams" ON public.exams FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: pomodoro_sessions Users can update own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own sessions" ON public.pomodoro_sessions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: document_tags Users can view own document tags; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own document tags" ON public.document_tags FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.documents
  WHERE ((documents.id = document_tags.document_id) AND (documents.user_id = auth.uid())))));


--
-- Name: documents Users can view own documents; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own documents" ON public.documents FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: planner_events Users can view own events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own events" ON public.planner_events FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: exam_milestones Users can view own exam milestones; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own exam milestones" ON public.exam_milestones FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.exams
  WHERE ((exams.id = exam_milestones.exam_id) AND (exams.user_id = auth.uid())))));


--
-- Name: exams Users can view own exams; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own exams" ON public.exams FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: pomodoro_sessions Users can view own sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own sessions" ON public.pomodoro_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: document_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: exam_milestones; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.exam_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: exams; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

--
-- Name: planner_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.planner_events ENABLE ROW LEVEL SECURITY;

--
-- Name: pomodoro_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: TABLE document_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.document_tags TO anon;
GRANT ALL ON TABLE public.document_tags TO authenticated;
GRANT ALL ON TABLE public.document_tags TO service_role;


--
-- Name: TABLE documents; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.documents TO anon;
GRANT ALL ON TABLE public.documents TO authenticated;
GRANT ALL ON TABLE public.documents TO service_role;


--
-- Name: TABLE exam_milestones; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exam_milestones TO anon;
GRANT ALL ON TABLE public.exam_milestones TO authenticated;
GRANT ALL ON TABLE public.exam_milestones TO service_role;


--
-- Name: TABLE exams; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exams TO anon;
GRANT ALL ON TABLE public.exams TO authenticated;
GRANT ALL ON TABLE public.exams TO service_role;


--
-- Name: TABLE planner_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.planner_events TO anon;
GRANT ALL ON TABLE public.planner_events TO authenticated;
GRANT ALL ON TABLE public.planner_events TO service_role;


--
-- Name: TABLE pomodoro_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.pomodoro_sessions TO anon;
GRANT ALL ON TABLE public.pomodoro_sessions TO authenticated;
GRANT ALL ON TABLE public.pomodoro_sessions TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tasks TO anon;
GRANT ALL ON TABLE public.tasks TO authenticated;
GRANT ALL ON TABLE public.tasks TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict gIpsQB5FNEYWvLxwUeWpDHAmEmpUzF82tBOIaV7tnFIgiRDBhqld260twaSUfJv

