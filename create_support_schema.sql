-- Tabela de Tickets de Suporte
-- Drop tables if they exist to ensure clean slate if user re-runs, or use IF NOT EXISTS carefully with ALTER
-- Since this is a new feature request, we assume tables might not exist or we want to fix them.
-- For safety, just CREATE IF NOT EXISTS but with correct references.

CREATE TABLE IF NOT EXISTS support_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    -- Reference profiles(id) to allow easy joining with Profile data (name, email, etc)
    student_id uuid REFERENCES profiles(id) NOT NULL,
    subject text NOT NULL,
    category text NOT NULL,
    status text DEFAULT 'Aberto',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de Mensagens do Suporte
CREATE TABLE IF NOT EXISTS support_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
    -- Sender can be a profile (admin or student)
    sender_id uuid REFERENCES profiles(id) NOT NULL, 
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Policies for Tickets
-- Students see their own tickets
CREATE POLICY "Students can view own tickets" ON support_tickets FOR SELECT USING (auth.uid() = student_id);
-- Students can insert their own tickets
CREATE POLICY "Students can insert own tickets" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = student_id);
-- Students can update their own tickets (e.g. close them, though UI doesn't show it yet)
CREATE POLICY "Students can update own tickets" ON support_tickets FOR UPDATE USING (auth.uid() = student_id);

-- Admins see all tickets
CREATE POLICY "Admins can view all tickets" ON support_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'super'))
);

-- Policies for Messages
-- Users can view messages of tickets they own
CREATE POLICY "Users can view messages of own tickets" ON support_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND student_id = auth.uid())
);
-- Students can insert messages to their own tickets
CREATE POLICY "Students can insert messages to own tickets" ON support_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND student_id = auth.uid())
);

-- Admins see all messages
CREATE POLICY "Admins can view/insert all messages" ON support_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR role = 'super'))
);
