import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Usar Admin API para buscar usuário pelo email
    const adminSupabase = createAdminClient();
    
    // Buscar usuário pelo email usando Admin API
    // Nota: listUsers() pode ser custoso com muitos usuários
    // Alternativa: usar getUserByEmail se disponível, ou fazer busca paginada
    const { data: usersData, error: listError } = await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000, // Ajustar conforme necessário
    });
    
    if (listError) {
      // Se falhar, assumir que precisa confirmação para não bloquear usuário
      // Log do erro para debug, mas retornar needsConfirmation: true como fallback seguro
      console.error('[check-email-status] Erro ao listar usuários:', listError);
      return NextResponse.json({ needsConfirmation: true, email });
    }

    const user = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // Usuário não existe - pode não ter se cadastrado ainda ou email diferente
      // Retornar needsConfirmation: false para não mostrar opção de reenvio desnecessariamente
      return NextResponse.json({ needsConfirmation: false, email });
    }

    // Verificar se email já foi confirmado
    // email_confirmed_at é null se não foi confirmado, ou uma data se foi confirmado
    const needsConfirmation = !user.email_confirmed_at;
    
    return NextResponse.json({ needsConfirmation, email });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    // Em caso de erro, assumir que precisa confirmação (fallback seguro)
    return NextResponse.json(
      { needsConfirmation: true, email: '' },
      { status: errorResponse.statusCode }
    );
  }
}

