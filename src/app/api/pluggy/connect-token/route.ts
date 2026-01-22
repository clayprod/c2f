import { NextRequest, NextResponse } from 'next/server';
import { getUserId, isAdmin } from '@/lib/auth';
import { createConnectToken } from '@/services/pluggy/items';
import { createErrorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (Pluggy/OpenFinance is admin-only)
    const admin = await isAdmin(userId, request);
    if (!admin) {
      return NextResponse.json(
        { error: 'A integração Open Finance está disponível apenas para administradores' },
        { status: 403 }
      );
    }

    const connectToken = await createConnectToken();

    return NextResponse.json({ connectToken });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}






