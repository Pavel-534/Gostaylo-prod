-- 012: Per-participant read timestamps (renter vs host/partner).
-- Unread for renter: incoming (sender <> renter) with read_at_renter IS NULL.
-- Unread for host side: incoming (sender = renter) with read_at_partner IS NULL.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at_renter TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at_partner TIMESTAMPTZ;

COMMENT ON COLUMN messages.read_at_renter IS 'Renter has read this message (typically sent by host/partner).';
COMMENT ON COLUMN messages.read_at_partner IS 'Host/partner side has read this message (typically sent by renter).';

-- Legacy is_read meant "the recipient has read". Map to the correct side.
-- (messages has created_at, not updated_at — do not use m.updated_at.)
UPDATE messages m
SET
  read_at_partner = COALESCE(m.read_at_partner, m.created_at, now())
FROM conversations p
WHERE p.id = m.conversation_id
  AND m.is_read IS TRUE
  AND p.renter_id IS NOT NULL
  AND m.sender_id::text = p.renter_id::text;

UPDATE messages m
SET
  read_at_renter = COALESCE(m.read_at_renter, m.created_at, now())
FROM conversations p
WHERE p.id = m.conversation_id
  AND m.is_read IS TRUE
  AND p.renter_id IS NOT NULL
  AND m.sender_id::text <> p.renter_id::text;
