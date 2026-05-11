const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required');
  console.error('These are server-side secrets and should NEVER be committed to version control');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function migrate() {
  console.log('Running migrations...');

  // Create campaigns table
  const { error: e1 } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        offer_text TEXT NOT NULL,
        offer_url TEXT,
        coin_budget INTEGER DEFAULT 1000,
        coins_per_scan INTEGER DEFAULT 20,
        coins_per_visit INTEGER DEFAULT 100,
        coins_per_purchase INTEGER DEFAULT 500,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (e1) console.log('campaigns:', e1.message);
  else console.log('✓ campaigns table created');

  // Create qr_codes table
  const { error: e2 } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS qr_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id),
        slug TEXT UNIQUE NOT NULL,
        location_name TEXT,
        location_address TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (e2) console.log('qr_codes:', e2.message);
  else console.log('✓ qr_codes table created');

  // Create scan_events table
  const { error: e3 } = supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS scan_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        qr_id UUID REFERENCES qr_codes(id),
        campaign_id UUID REFERENCES campaigns(id),
        user_id TEXT,
        scanned_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (e3) console.log('scan_events:', e3.message);
  else console.log('✓ scan_events table created');

  // Create visit_events table
  const { error: e4 } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS visit_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        qr_id UUID REFERENCES qr_codes(id),
        campaign_id UUID REFERENCES campaigns(id),
        user_id TEXT,
        visited_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  if (e4) console.log('visit_events:', e4.message);
  else console.log('✓ visit_events table created');

  console.log('Migration complete!');
}

migrate().catch(console.error);
