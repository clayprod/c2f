import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/errors';
import { listConnectors, getBrazilianConnectors, getConnectorMap, searchConnectorsByName } from '@/services/pluggy/connectors';

/**
 * GET /api/pluggy/connectors
 * 
 * List all available Pluggy connectors
 * Useful for debugging and finding correct connector IDs
 * 
 * Query params:
 * - country: Filter by country (e.g., 'BR')
 * - name: Search by name
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const name = searchParams.get('name');
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : undefined;

    // If country is BR or not specified, get Brazilian connectors
    if (country === 'BR' || !country) {
      if (name) {
        // Search by name
        const connectors = await searchConnectorsByName(name);
        return NextResponse.json({
          results: connectors,
          total: connectors.length,
          country: 'BR',
          searchTerm: name,
        });
      } else {
        // Get all Brazilian connectors
        const connectors = await getBrazilianConnectors();
        return NextResponse.json({
          results: connectors,
          total: connectors.length,
          country: 'BR',
          connectorMap: await getConnectorMap(),
        });
      }
    }

    // Generic list with filters
    const response = await listConnectors({
      country: country || undefined,
      name: name || undefined,
      page,
      pageSize,
    });

    return NextResponse.json({
      ...response,
      connectorMap: await getConnectorMap(),
    });
  } catch (error: any) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}






