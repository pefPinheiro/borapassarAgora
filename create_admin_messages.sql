CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) NOT NULL,
  recipient_id UUID REFERENCES profiles(id) NOT NULL,
  subject TEXT,
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_by_sender BOOLEAN DEFAULT FALSE,
  deleted_by_recipient BOOLEAN DEFAULT FALSE
);

-- RLS
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages sent to them or by them" ON admin_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert messages sent by them" ON admin_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update messages sent to them (read status) or by them (soft delete)" ON admin_messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
