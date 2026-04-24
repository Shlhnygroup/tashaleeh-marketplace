-- Migration Script V3.4: Security Hardening & Deletion Fix
-- This script ensures blocked users cannot bypass RLS and fixes deletion persistence.

-- 1. Function to check if a user is blocked (SECURITY DEFINER to bypass RLS on profiles)
CREATE OR REPLACE FUNCTION public.is_user_blocked(user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND is_blocked = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Requests Policies
DROP POLICY IF EXISTS "Users can create their own requests" ON public.requests;
CREATE POLICY "Users can create their own requests" ON public.requests 
FOR INSERT WITH CHECK (
  auth.uid() = buyer_id AND NOT public.is_user_blocked(auth.uid())
);

DROP POLICY IF EXISTS "Users can update/delete own requests" ON public.requests;
CREATE POLICY "Users can update/delete own requests" ON public.requests 
FOR ALL USING (
  auth.uid() = buyer_id AND NOT public.is_user_blocked(auth.uid())
);

-- 3. Update Responses Policies (For Sellers)
DROP POLICY IF EXISTS "Sellers can insert responses" ON public.responses;
CREATE POLICY "Sellers can insert responses" ON public.responses 
FOR INSERT WITH CHECK (
  auth.uid() = seller_id AND NOT public.is_user_blocked(auth.uid())
);

-- 4. Update Messages Policies
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
CREATE POLICY "Users can insert messages in their chats" ON public.messages 
FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND NOT public.is_user_blocked(auth.uid())
);

-- 5. Ensure Cascade Deletion is set (Reinforcement)
-- Requests to Responses
ALTER TABLE IF EXISTS public.responses 
DROP CONSTRAINT IF EXISTS responses_request_id_fkey,
ADD CONSTRAINT responses_request_id_fkey 
  FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;

-- Requests to Messages
ALTER TABLE IF EXISTS public.messages 
DROP CONSTRAINT IF EXISTS messages_request_id_fkey,
ADD CONSTRAINT messages_request_id_fkey 
  FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;

-- Add comment for documentation
COMMENT ON FUNCTION public.is_user_blocked IS 'Checks if a user is blocked in the profiles table. Used for RLS enforcement.';
