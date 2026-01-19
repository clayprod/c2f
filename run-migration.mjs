import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:Hgcn2hpn**12@db.ndlqyqfxvlalootwdjxv.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!');

    // Check existing tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Existing tables:', tables.rows.map(r => r.table_name).join(', '));

    // ============================================
    // MIGRATION 019: Create global_settings table
    // ============================================
    console.log('\n=== MIGRATION 019: Creating global_settings table ===');

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.global_settings (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_password TEXT,
        smtp_from_email TEXT,
        groq_api_key TEXT,
        openai_api_key TEXT,
        ai_model TEXT CHECK (ai_model IN ('groq', 'openai')),
        ai_model_name TEXT,
        advisor_prompt TEXT,
        insights_prompt TEXT,
        stripe_price_id_pro TEXT,
        stripe_price_id_business TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Table created');

    // Insert default row if not exists
    await client.query(`
      INSERT INTO public.global_settings (id)
      SELECT gen_random_uuid()
      WHERE NOT EXISTS (SELECT 1 FROM public.global_settings LIMIT 1);
    `);
    console.log('Default row ensured');

    // Enable RLS
    await client.query(`ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;`);
    console.log('RLS enabled');

    // Create RLS policies
    const policies = [
      {
        name: 'Only admins can view global settings',
        type: 'SELECT',
        sql: `CREATE POLICY "Only admins can view global settings" ON public.global_settings
              FOR SELECT USING (
                EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
              );`
      },
      {
        name: 'Only admins can update global settings',
        type: 'UPDATE',
        sql: `CREATE POLICY "Only admins can update global settings" ON public.global_settings
              FOR UPDATE USING (
                EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
              );`
      },
      {
        name: 'Only admins can insert global settings',
        type: 'INSERT',
        sql: `CREATE POLICY "Only admins can insert global settings" ON public.global_settings
              FOR INSERT WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
              );`
      }
    ];

    for (const policy of policies) {
      try {
        await client.query(`DROP POLICY IF EXISTS "${policy.name}" ON public.global_settings;`);
        await client.query(policy.sql);
        console.log(`Policy "${policy.name}" created`);
      } catch (e) {
        console.log(`Policy "${policy.name}": ${e.message}`);
      }
    }

    // Create trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_global_settings_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('Trigger function created');

    // Create trigger
    await client.query(`DROP TRIGGER IF EXISTS update_global_settings_updated_at ON public.global_settings;`);
    await client.query(`
      CREATE TRIGGER update_global_settings_updated_at
        BEFORE UPDATE ON public.global_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_global_settings_updated_at();
    `);
    console.log('Trigger created');

    console.log('Migration 019 completed!');

    // ============================================
    // MIGRATION 024: Add advisor settings columns
    // ============================================
    console.log('\n=== MIGRATION 024: Adding advisor settings columns ===');

    const alterQueries = [
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS tips_prompt TEXT;`,
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS tips_enabled BOOLEAN DEFAULT true;`,
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS chat_max_tokens INTEGER DEFAULT 4000;`,
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS session_ttl_minutes INTEGER DEFAULT 30;`,
      `ALTER TABLE advisor_insights ADD COLUMN IF NOT EXISTS insight_type TEXT DEFAULT 'chat';`,
    ];

    for (const query of alterQueries) {
      console.log('Executing:', query.substring(0, 60) + '...');
      await client.query(query);
      console.log('OK');
    }

    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_advisor_insights_type
      ON advisor_insights(user_id, insight_type, created_at DESC);
    `);
    console.log('Index created');

    // Add constraint
    try {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'advisor_insights_type_check'
          ) THEN
            ALTER TABLE advisor_insights
            ADD CONSTRAINT advisor_insights_type_check
            CHECK (insight_type IN ('chat', 'daily_tip'));
          END IF;
        END $$;
      `);
      console.log('Constraint added or already exists');
    } catch (e) {
      console.log('Constraint check:', e.message);
    }

    // Add comments
    const comments = [
      `COMMENT ON COLUMN global_settings.tips_prompt IS 'System prompt for daily tips generation';`,
      `COMMENT ON COLUMN global_settings.tips_enabled IS 'Toggle to enable/disable daily tips feature';`,
      `COMMENT ON COLUMN global_settings.chat_max_tokens IS 'Maximum tokens allowed in chat history';`,
      `COMMENT ON COLUMN global_settings.session_ttl_minutes IS 'Session TTL in minutes for Redis cache';`,
      `COMMENT ON COLUMN advisor_insights.insight_type IS 'Type of insight: chat (conversation) or daily_tip (dashboard tips)';`,
    ];

    for (const comment of comments) {
      await client.query(comment);
    }
    console.log('Comments added');

    // ============================================
    // MIGRATION 041: Add WhatsApp Evolution API settings
    // ============================================
    console.log('\n=== MIGRATION 041: Adding WhatsApp Evolution API settings ===');

    const whatsappSettingsQueries = [
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS evolution_api_url TEXT;`,
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS evolution_api_key TEXT;`,
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT;`,
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS evolution_webhook_secret TEXT;`,
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS n8n_api_key TEXT;`,
      `ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT FALSE;`,
    ];

    for (const query of whatsappSettingsQueries) {
      console.log('Executing:', query.substring(0, 60) + '...');
      await client.query(query);
      console.log('OK');
    }

    // ============================================
    // MIGRATION 042: Create whatsapp_verifications table
    // ============================================
    console.log('\n=== MIGRATION 042: Creating whatsapp_verifications table ===');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.whatsapp_verifications (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
        phone_number TEXT NOT NULL,
        phone_number_normalized TEXT NOT NULL,
        verification_code TEXT,
        verification_code_expires_at TIMESTAMP WITH TIME ZONE,
        verified_at TIMESTAMP WITH TIME ZONE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'revoked')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id),
        UNIQUE(phone_number_normalized)
      );
    `);
    console.log('Table whatsapp_verifications created');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_user_id ON public.whatsapp_verifications(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_phone ON public.whatsapp_verifications(phone_number_normalized);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_status ON public.whatsapp_verifications(status);`);
    console.log('Indexes created');

    await client.query(`ALTER TABLE public.whatsapp_verifications ENABLE ROW LEVEL SECURITY;`);
    console.log('RLS enabled');

    // RLS Policies for whatsapp_verifications
    const verificationPolicies = [
      { name: 'Users can view own verification', sql: `CREATE POLICY "Users can view own verification" ON public.whatsapp_verifications FOR SELECT USING (user_id = auth.uid());` },
      { name: 'Users can insert own verification', sql: `CREATE POLICY "Users can insert own verification" ON public.whatsapp_verifications FOR INSERT WITH CHECK (user_id = auth.uid());` },
      { name: 'Users can update own verification', sql: `CREATE POLICY "Users can update own verification" ON public.whatsapp_verifications FOR UPDATE USING (user_id = auth.uid());` },
      { name: 'Users can delete own verification', sql: `CREATE POLICY "Users can delete own verification" ON public.whatsapp_verifications FOR DELETE USING (user_id = auth.uid());` },
      { name: 'Admins can view all verifications', sql: `CREATE POLICY "Admins can view all verifications" ON public.whatsapp_verifications FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));` },
    ];

    for (const policy of verificationPolicies) {
      try {
        await client.query(`DROP POLICY IF EXISTS "${policy.name}" ON public.whatsapp_verifications;`);
        await client.query(policy.sql);
        console.log(`Policy "${policy.name}" created`);
      } catch (e) {
        console.log(`Policy "${policy.name}": ${e.message}`);
      }
    }

    // Trigger for whatsapp_verifications
    await client.query(`
      CREATE OR REPLACE FUNCTION update_whatsapp_verifications_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`DROP TRIGGER IF EXISTS update_whatsapp_verifications_updated_at ON public.whatsapp_verifications;`);
    await client.query(`
      CREATE TRIGGER update_whatsapp_verifications_updated_at
        BEFORE UPDATE ON public.whatsapp_verifications
        FOR EACH ROW
        EXECUTE FUNCTION update_whatsapp_verifications_updated_at();
    `);
    console.log('Trigger created');

    // ============================================
    // MIGRATION 043: Create whatsapp_messages_log table
    // ============================================
    console.log('\n=== MIGRATION 043: Creating whatsapp_messages_log table ===');

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.whatsapp_messages_log (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        phone_number TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
        message_type TEXT NOT NULL CHECK (message_type IN ('text', 'audio', 'image', 'document', 'verification')),
        content_summary TEXT,
        transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
        action_type TEXT CHECK (action_type IN ('create', 'update', 'delete', 'query', 'clarify', 'verification')),
        processed_at TIMESTAMP WITH TIME ZONE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
        error_message TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Table whatsapp_messages_log created');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user_id ON public.whatsapp_messages_log(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON public.whatsapp_messages_log(phone_number);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages_log(created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages_log(status);`);
    console.log('Indexes created');

    await client.query(`ALTER TABLE public.whatsapp_messages_log ENABLE ROW LEVEL SECURITY;`);
    console.log('RLS enabled');

    // RLS Policies for whatsapp_messages_log
    const logPolicies = [
      { name: 'Users can view own message logs', sql: `CREATE POLICY "Users can view own message logs" ON public.whatsapp_messages_log FOR SELECT USING (user_id = auth.uid());` },
      { name: 'Admins can view all message logs', sql: `CREATE POLICY "Admins can view all message logs" ON public.whatsapp_messages_log FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));` },
    ];

    for (const policy of logPolicies) {
      try {
        await client.query(`DROP POLICY IF EXISTS "${policy.name}" ON public.whatsapp_messages_log;`);
        await client.query(policy.sql);
        console.log(`Policy "${policy.name}" created`);
      } catch (e) {
        console.log(`Policy "${policy.name}": ${e.message}`);
      }
    }

    console.log('\n=== All migrations completed successfully! ===');

    // Verify
    const verify = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'global_settings'
      ORDER BY ordinal_position;
    `);
    console.log('\nGlobal settings columns:');
    verify.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

    // Verify new tables
    const whatsappTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'whatsapp%';
    `);
    console.log('\nWhatsApp tables:');
    whatsappTables.rows.forEach(r => console.log(`  - ${r.table_name}`));

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

runMigration();
