-- Creator/Influencer System Database Schema

-- Creator Profiles
CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  location TEXT,
  website TEXT,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  posts INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  rates JSONB DEFAULT '{}',
  niche TEXT[] DEFAULT '{}',
  verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Accounts
CREATE TABLE IF NOT EXISTS creator_socials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok', 'twitter', 'linkedin', 'facebook', 'snapchat')),
  username TEXT NOT NULL,
  url TEXT,
  followers INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  connected BOOLEAN DEFAULT false,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator Campaigns (posted by brands)
CREATE TABLE IF NOT EXISTS creator_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  brand_logo TEXT,
  title TEXT NOT NULL,
  description TEXT,
  brief TEXT,
  requirements JSONB DEFAULT '[]',
  budget DECIMAL(10,2),
  payment_type TEXT DEFAULT 'fixed' CHECK (payment_type IN ('fixed', 'per_post', 'per_scan', 'revenue_share')),
  min_followers INTEGER DEFAULT 0,
  deadline TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications from creators
CREATE TABLE IF NOT EXISTS creator_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES creator_campaigns(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  proposed_rate DECIMAL(10,2),
  pitch TEXT,
  content_ideas TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'accepted', 'rejected', 'completed')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Content Deliverables
CREATE TABLE IF NOT EXISTS creator_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES creator_applications(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES creator_campaigns(id),
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_url TEXT,
  content_caption TEXT,
  content_hashtags TEXT[] DEFAULT '{}',
  proof_url TEXT,
  proof_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'revision_requested')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
);

-- Creator Earnings
CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('sponsored_post', 'affiliate', 'dooh_scan', 'retainer', 'bonus')),
  campaign_id UUID REFERENCES creator_campaigns(id),
  application_id UUID REFERENCES creator_applications(id),
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- DOOH Content Integration
CREATE TABLE IF NOT EXISTS creator_dooh_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  content_url TEXT NOT NULL,
  content_caption TEXT,
  dooh_campaign_id TEXT,
  screen_types TEXT[] DEFAULT '{}',
  total_impressions INTEGER DEFAULT 0,
  total_scans INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Creator Verification
CREATE TABLE IF NOT EXISTS creator_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  verified_posts INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  documents TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_creators_user ON creators(user_id);
CREATE INDEX IF NOT EXISTS idx_creators_username ON creators(username);
CREATE INDEX IF NOT EXISTS idx_creators_status ON creators(status);
CREATE INDEX IF NOT EXISTS idx_socials_creator ON creator_socials(creator_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON creator_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_applications_campaign ON creator_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_applications_creator ON creator_applications(creator_id);
CREATE INDEX IF NOT EXISTS idx_earnings_creator ON creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_creator ON creator_deliverables(creator_id);

-- RLS
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_socials ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Creators viewable by all" ON creators FOR SELECT USING (true);
CREATE POLICY "Creators editable by owner" ON creators FOR ALL USING (auth.uid()::text = user_id);

CREATE POLICY "Campaigns viewable by all" ON creator_campaigns FOR SELECT USING (true);
CREATE POLICY "Brands can create campaigns" ON creator_campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Brands can update own campaigns" ON creator_campaigns FOR UPDATE USING (true);

CREATE POLICY "Creators can view applications" ON creator_applications FOR SELECT USING (true);
CREATE POLICY "Creators can apply" ON creator_applications FOR INSERT WITH CHECK (true);
