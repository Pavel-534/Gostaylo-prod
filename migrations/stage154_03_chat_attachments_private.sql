-- Stage 154.2 — chat-attachments private bucket; no public read (signed URLs via app/_storage/chat-attachments/*).

UPDATE storage.buckets
SET public = false
WHERE id = 'chat-attachments';

DROP POLICY IF EXISTS chat_attachments_public_read ON storage.objects;
