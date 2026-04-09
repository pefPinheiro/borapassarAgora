-- Auto-confirm emails from borapassaragora.com domain
-- This allows staff members to log in immediately without waiting for a verification email

CREATE OR REPLACE FUNCTION public.auto_confirm_corporate_emails()
RETURNS trigger AS $$
BEGIN
  IF (NEW.email LIKE '%@borapassaragora.com') THEN
    NEW.email_confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger must be on the auth.users table in the auth schema
-- We use BEFORE INSERT to modify the email_confirmed_at field before it hit the database
DROP TRIGGER IF EXISTS on_auth_user_created_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.auto_confirm_corporate_emails();

-- Also update existing users if any were pending
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email LIKE '%@borapassaragora.com' AND email_confirmed_at IS NULL;
