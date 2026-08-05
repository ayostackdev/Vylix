-- Storage buckets: avatars + materials
-- avatars: public, 50 MB, image/*
-- materials: public, 50 MB, any MIME type
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 52428800, ARRAY['image/*']),
  ('materials', 'materials', true, 52428800, NULL)
ON CONFLICT (id) DO NOTHING;

-- Public read for avatars (served via /storage/v1/object/public/...)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Public read for materials (served via /storage/v1/object/public/...)
DROP POLICY IF EXISTS "materials_public_read" ON storage.objects;
CREATE POLICY "materials_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'materials');
