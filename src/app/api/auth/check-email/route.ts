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

        // Check if user exists in profiles table
        // Using email.toLowerCase() because we should store/compare emails case-insensitively
        const { data, error } = await admin
            .from('profiles')
            .select('id')
            .ilike('email', email)
            .maybeSingle();

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
