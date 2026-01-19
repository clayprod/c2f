import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';

/**
 * Endpoint para adicionar as colunas image_url e image_position à tabela goals
 * Execute este endpoint uma vez para criar as colunas necessárias
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = createClientFromRequest(request);

    // Verificar se as colunas já existem
    let columns, checkError;
    try {
      const result = await supabase.rpc('exec_sql', {
        sql: `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'goals'
          AND column_name IN ('image_url', 'image_position')
        `
      });
      columns = result.data;
      checkError = result.error;
    } catch {
      // Se der erro na verificação, continuar com a migration
      columns = null;
      checkError = null;
    }

    // Se não conseguir verificar via RPC, tentar criar diretamente
    // Usar SQL direto via Supabase
    const migrationSQL = `
      ALTER TABLE public.goals 
      ADD COLUMN IF NOT EXISTS image_url TEXT;

      ALTER TABLE public.goals 
      ADD COLUMN IF NOT EXISTS image_position TEXT DEFAULT 'center';

      COMMENT ON COLUMN public.goals.image_url IS 'URL da imagem de capa do objetivo armazenada no Supabase Storage';
      COMMENT ON COLUMN public.goals.image_position IS 'Posição da imagem na capa (center, top, bottom, left, right, etc)';
    `;

    // Tentar executar via query direta (pode não funcionar dependendo das permissões)
    // A melhor forma é executar manualmente no Supabase Dashboard
    return NextResponse.json({
      success: false,
      message: 'Por favor, execute a migration manualmente no Supabase Dashboard',
      instructions: [
        '1. Acesse o Supabase Dashboard',
        '2. Vá em "SQL Editor"',
        '3. Execute o seguinte SQL:',
        '',
        migrationSQL
      ],
      sql: migrationSQL
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Erro ao verificar migration',
      instructions: 'Execute a migration manualmente no Supabase Dashboard usando o SQL em supabase/migrations/013_add_goals_image_url.sql'
    }, { status: 500 });
  }
}


