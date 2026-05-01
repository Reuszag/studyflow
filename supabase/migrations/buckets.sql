-- StudyFlow storage setup. Run AFTER schema.sql.
-- Creates buckets and storage RLS policies via Supabase-managed APIs.
-- Use Supabase SQL Editor (postgres role can write to storage.buckets and create policies on storage.objects).

-- ============================================================================
-- BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, allowed_mime_types)
VALUES
    ('avatars',     'avatars',     true,  NULL),
    ('documents',   'documents',   false, NULL),
    ('note-images', 'note-images', true,  ARRAY['image/png','image/jpeg','image/gif','image/webp'])
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- STORAGE RLS POLICIES (storage.objects)
-- ============================================================================

-- documents (private; only owner can read/write/delete)
DROP POLICY IF EXISTS "Allow users to upload documents" ON storage.objects;
CREATE POLICY "Allow users to upload documents" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Allow users to read documents" ON storage.objects;
CREATE POLICY "Allow users to read documents" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'documents' AND auth.uid() = owner);

DROP POLICY IF EXISTS "Allow users to delete documents" ON storage.objects;
CREATE POLICY "Allow users to delete documents" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'documents' AND auth.uid() = owner);


-- avatars (publicly viewable; owner-scoped writes via folder = user id)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects
    FOR DELETE
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);


-- note-images (any authenticated user can read; owner folder enforced for writes;
-- shared editors may upload to the note owner's folder)
DROP POLICY IF EXISTS "Authenticated users can read note images" ON storage.objects;
CREATE POLICY "Authenticated users can read note images" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'note-images');

DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
CREATE POLICY "Users can upload to own folder" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'note-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
CREATE POLICY "Users can update own files" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'note-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'note-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "shared editors upload to owner folder" ON storage.objects;
CREATE POLICY "shared editors upload to owner folder" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'note-images'
        AND (
            (auth.uid())::text = (storage.foldername(name))[1]
            OR EXISTS (
                SELECT 1
                FROM public.note_shares ns
                JOIN public.notes n ON n.id = ns.note_id
                WHERE ns.shared_with = auth.uid()
                  AND ns.permission = 'edit'
                  AND (n.owner_id)::text = (storage.foldername(objects.name))[1]
            )
        )
    );
