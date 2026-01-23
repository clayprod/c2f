import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInstitutionLogoUrl, extractBankCode, getConnectorIdFromBankCode, getConnectorIdFromName } from '@/services/pluggy/bankMapping';
import { pluggyClient } from '@/services/pluggy/client';
import { getBrazilianConnectors, searchConnectorsByName } from '@/services/pluggy/connectors';

/**
 * Debug endpoint to see how logos are being detected
 * Shows the raw data and the detection process for each account
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all Pluggy items
    const { data: items, error: itemsError } = await supabase
      .from('pluggy_items')
      .select('item_id, connector_id, connector_name')
      .eq('user_id', user.id);

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch items', details: itemsError }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ message: 'No Pluggy items found' });
    }

    const debugResults: any[] = [];

    // For each item, get accounts and debug logo detection
    for (const item of items) {
      try {
        // Fetch raw accounts from Pluggy API
        const response = await pluggyClient.get<{ results: any[] }>(`/accounts?itemId=${item.item_id}`);
        
        const itemDebug: any = {
          item_id: item.item_id,
          item_connector_id: item.connector_id,
          item_connector_name: item.connector_name,
          accounts: [],
        };

        for (const apiAccount of (response.results || [])) {
          const transferNumber = apiAccount.bankData?.transferNumber;
          const bankCode = extractBankCode(transferNumber);
          const connectorIdFromBank = getConnectorIdFromBankCode(bankCode);
          const connectorIdFromName = getConnectorIdFromName(apiAccount.name);
          const finalLogoUrl = getInstitutionLogoUrl(apiAccount.name, transferNumber);
          
          // Extract connector ID from final logo URL
          const connectorIdFromLogo = finalLogoUrl?.match(/connector-icons\/(\d+)\.svg/)?.[1];

          itemDebug.accounts.push({
            id: apiAccount.id,
            name: apiAccount.name,
            type: apiAccount.type,
            subtype: apiAccount.subtype,
            transferNumber: transferNumber,
            bankCode: bankCode,
            detection: {
              connectorIdFromBankCode: connectorIdFromBank,
              connectorIdFromName: connectorIdFromName,
              finalConnectorId: connectorIdFromLogo,
              finalLogoUrl: finalLogoUrl,
            },
            raw: {
              bankData: apiAccount.bankData,
            },
          });
        }

        debugResults.push(itemDebug);
      } catch (error: any) {
        debugResults.push({
          item_id: item.item_id,
          error: error.message,
        });
      }
    }

    // Try to find Caixa and other banks in the connectors list
    let connectorsInfo: any = {};
    try {
      const allBrazilianConnectors = await getBrazilianConnectors();
      
      // Look for Caixa variations
      const caixaVariations = ['caixa', 'cef', 'economica', 'federal'];
      const caixaConnector = allBrazilianConnectors.find(c => 
        caixaVariations.some(v => c.name.toLowerCase().includes(v))
      );
      
      // Look for other banks mentioned in the debug results
      const nubankConnector = allBrazilianConnectors.find(c => 
        c.name.toLowerCase().includes('nubank') || c.name.toLowerCase().includes('nu pagamentos')
      );
      
      connectorsInfo = {
        caixa: caixaConnector ? {
          id: caixaConnector.id,
          name: caixaConnector.name,
          logoUrl: `https://cdn.pluggy.ai/assets/connector-icons/${caixaConnector.id}.svg`,
        } : 'Not found in connectors list',
        nubank: nubankConnector ? {
          id: nubankConnector.id,
          name: nubankConnector.name,
          logoUrl: `https://cdn.pluggy.ai/assets/connector-icons/${nubankConnector.id}.svg`,
        } : 'Not found in connectors list',
        totalConnectors: allBrazilianConnectors.length,
        // Show first 20 connectors for reference
        sampleConnectors: allBrazilianConnectors.slice(0, 20).map(c => ({
          id: c.id,
          name: c.name,
        })),
      };
    } catch (error: any) {
      connectorsInfo.error = error.message;
    }

    return NextResponse.json({
      message: 'Logo detection debug information',
      results: debugResults,
      connectorsInfo,
      note: 'If Caixa is not found, the connector ID might need to be manually identified. Check the sample connectors or search the full list at /api/pluggy/connectors?country=BR',
    });
  } catch (error: any) {
    console.error('Error in GET /api/pluggy/debug-logo-detection:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

