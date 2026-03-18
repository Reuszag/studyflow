
-- StudyFlow — Initial Database Schema
-- Run this in your Supabase SQL Editor



-- 1. PROFILES (extends auth.users)

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();



-- 2. TASKS (Feature #2 — To-Do List)

CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
    due_date DATE,
    planned_date DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
    ON public.tasks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
    ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
    ON public.tasks FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
    ON public.tasks FOR DELETE USING (auth.uid() = user_id);



-- 3. POMODORO SESSIONS (Feature #1 — Timer)

CREATE TABLE public.pomodoro_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    session_type TEXT NOT NULL DEFAULT 'focus' CHECK (session_type IN ('focus', 'short_break', 'long_break')),
    duration_minutes INTEGER NOT NULL DEFAULT 25,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    completed BOOLEAN DEFAULT false
);

ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
    ON public.pomodoro_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON public.pomodoro_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON public.pomodoro_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON public.pomodoro_sessions FOR DELETE USING (auth.uid() = user_id);



-- 4. PLANNER EVENTS (Features #2, #3 — Calendar)

CREATE TABLE public.planner_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT DEFAULT 'other' CHECK (event_type IN ('class', 'study', 'assignment', 'reminder', 'other')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    recurrence_rule TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.planner_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
    ON public.planner_events FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own events"
    ON public.planner_events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
    ON public.planner_events FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
    ON public.planner_events FOR DELETE USING (auth.uid() = user_id);



-- 5. DOCUMENTS (Feature #7 — File Storage)

CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    category TEXT,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
    ON public.documents FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
    ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
    ON public.documents FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
    ON public.documents FOR DELETE USING (auth.uid() = user_id);



-- 6. DOCUMENT TAGS (Feature #7 — Tagging)

CREATE TABLE public.document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    UNIQUE (document_id, tag)
);

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own document tags"
    ON public.document_tags FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.documents
        WHERE documents.id = document_tags.document_id
        AND documents.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own document tags"
    ON public.document_tags FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.documents
        WHERE documents.id = document_tags.document_id
        AND documents.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own document tags"
    ON public.document_tags FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.documents
        WHERE documents.id = document_tags.document_id
        AND documents.user_id = auth.uid()
    ));



-- 7. EXAMS (Feature #8 — Exam Countdown)

CREATE TABLE public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    subject TEXT,
    exam_date TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exams"
    ON public.exams FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exams"
    ON public.exams FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exams"
    ON public.exams FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exams"
    ON public.exams FOR DELETE USING (auth.uid() = user_id);



-- 8. EXAM MILESTONES (Feature #8 — Prep tracking)

CREATE TABLE public.exam_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_date DATE,
    completed BOOLEAN DEFAULT false
);

ALTER TABLE public.exam_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own exam milestones"
    ON public.exam_milestones FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.exams
        WHERE exams.id = exam_milestones.exam_id
        AND exams.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert own exam milestones"
    ON public.exam_milestones FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.exams
        WHERE exams.id = exam_milestones.exam_id
        AND exams.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own exam milestones"
    ON public.exam_milestones FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.exams
        WHERE exams.id = exam_milestones.exam_id
        AND exams.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own exam milestones"
    ON public.exam_milestones FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.exams
        WHERE exams.id = exam_milestones.exam_id
        AND exams.user_id = auth.uid()
    ));



-- 9. HELPER: auto-update updated_at columns

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();



-- 10. INDEXES for performance

CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_status ON public.tasks(user_id, status);
CREATE INDEX idx_tasks_due_date ON public.tasks(user_id, due_date);
CREATE INDEX idx_tasks_planned_date ON public.tasks(user_id, planned_date);

CREATE INDEX idx_pomodoro_user_id ON public.pomodoro_sessions(user_id);
CREATE INDEX idx_pomodoro_started_at ON public.pomodoro_sessions(user_id, started_at);

CREATE INDEX idx_planner_user_id ON public.planner_events(user_id);
CREATE INDEX idx_planner_start_time ON public.planner_events(user_id, start_time);

CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_document_tags_document_id ON public.document_tags(document_id);

CREATE INDEX idx_exams_user_id ON public.exams(user_id);
CREATE INDEX idx_exam_milestones_exam_id ON public.exam_milestones(exam_id);
