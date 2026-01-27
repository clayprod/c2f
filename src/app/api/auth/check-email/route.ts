import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json(
                { error: 'Email é obrigatório' },
                { status: 400 }
            );
        }

        const admin = createAdminClient();

        // Check if user exists in profiles table using case-insensitive comparison
        // Use RPC function that handles LOWER() comparison properly
        const { data, error } = await admin.rpc('check_email_exists', {
            email_param: email
        });

        if (error) {
            console.error('Erro ao verificar email no banco:', error);
            return NextResponse.json({ exists: false });
        }

        return NextResponse.json({ exists: !!data });
    } catch (error: any) {
        console.error('Erro na rota de verificação de email:', error);
        return NextResponse.json({ exists: false });
    }
}
