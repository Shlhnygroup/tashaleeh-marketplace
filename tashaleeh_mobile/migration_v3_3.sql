-- Migration Script V3.3
-- Run this if you already have V3.2 installed to apply security and profile fixes

-- 1. Add missing phone column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- 2. Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_brands ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any (to avoid duplicates)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Requests are viewable by everyone" ON public.requests;
DROP POLICY IF EXISTS "Users can create their own requests" ON public.requests;
DROP POLICY IF EXISTS "Users can update/delete own requests" ON public.requests;
DROP POLICY IF EXISTS "Responses are viewable by everyone" ON public.responses;
DROP POLICY IF EXISTS "Sellers can insert responses" ON public.responses;
DROP POLICY IF EXISTS "Users can see messages they sent or received" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Everyone can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Everyone can read brands" ON public.car_brands;

-- 4. Create Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Requests are viewable by everyone" ON public.requests FOR SELECT USING (true);
CREATE POLICY "Users can create their own requests" ON public.requests FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Users can update/delete own requests" ON public.requests FOR ALL USING (auth.uid() = buyer_id);
CREATE POLICY "Responses are viewable by everyone" ON public.responses FOR SELECT USING (true);
CREATE POLICY "Sellers can insert responses" ON public.responses FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can see messages they sent or received" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert messages in their chats" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Everyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Everyone can read brands" ON public.car_brands FOR SELECT USING (true);

-- 5. Update functions to SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.increment_request_views(request_id UUID) RETURNS void AS $$
BEGIN UPDATE public.requests SET views = COALESCE(views, 0) + 1 WHERE id = request_id; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_request_rejections(request_id UUID) RETURNS void AS $$
BEGIN UPDATE public.requests SET rejections = COALESCE(rejections, 0) + 1 WHERE id = request_id; END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
