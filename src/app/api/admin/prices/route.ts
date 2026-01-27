import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { clearPricingCache } from '@/services/pricing/cache';
import { getStripeClient } from '@/services/stripe/client';
import { updateGlobalSettings, clearSettingsCache } from '@/services/admin/globalSettings';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const stripe = getStripeClient();

    // List products
    const productsResponse = await stripe.products.list({ limit: 100 });
    const products = productsResponse.data;

    // List all prices
    const pricesResponse = await stripe.prices.list({ limit: 100 });
    const allPrices = pricesResponse.data;

    // Combine products with their prices
    const productsWithPrices = products.map((product) => {
      const productPrices = allPrices.filter((price) => price.product === product.id);
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        prices: productPrices.map((p) => ({
          id: p.id,
          unit_amount: p.unit_amount,
          currency: p.currency,
          active: p.active,
        })),
      };
    });

    return NextResponse.json({ products: productsWithPrices });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Stripe products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { product_id, unit_amount, currency = 'brl' } = body;

    if (!product_id || !unit_amount) {
      return NextResponse.json(
        { error: 'product_id and unit_amount are required' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Create new price
    const newPrice = await stripe.prices.create({
      product: product_id,
      unit_amount: typeof unit_amount === 'number' ? unit_amount : parseInt(unit_amount),
      currency: currency.toLowerCase(),
    });

    clearPricingCache();

    return NextResponse.json({
      price: {
        id: newPrice.id,
        product: newPrice.product as string,
        unit_amount: newPrice.unit_amount,
        currency: newPrice.currency,
        active: newPrice.active,
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create price' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { product_id, description } = body;

    if (!product_id) {
      return NextResponse.json(
        { error: 'product_id is required' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Update product description in Stripe
    const updatedProduct = await stripe.products.update(product_id, {
      description: description || '',
    });

    clearPricingCache();

    return NextResponse.json({
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        description: updatedProduct.description,
      },
      message: 'Product description updated successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update product description' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { price_id, product_id, unit_amount, currency = 'brl', plan_type } = body;

    if (!price_id || !product_id || !unit_amount) {
      return NextResponse.json(
        { error: 'price_id, product_id and unit_amount are required' },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Stripe doesn't allow editing prices, so we create a new one
    const newPrice = await stripe.prices.create({
      product: product_id,
      unit_amount: typeof unit_amount === 'number' ? unit_amount : parseInt(unit_amount),
      currency: currency.toLowerCase(),
    });

    // Update global settings if this is a plan price
    if (plan_type === 'pro') {
      await updateGlobalSettings({ stripe_price_id_pro: newPrice.id });
      console.log('[Admin Prices] Updated stripe_price_id_pro to:', newPrice.id);
    } else if (plan_type === 'premium' || plan_type === 'business') {
      await updateGlobalSettings({ stripe_price_id_business: newPrice.id });
      console.log('[Admin Prices] Updated stripe_price_id_business to:', newPrice.id);
    }

    // Limpar ambos os caches para garantir que os novos preços sejam buscados
    clearSettingsCache(); // Limpa cache de globalSettings
    clearPricingCache(); // Limpa cache de pricing

    return NextResponse.json({
      new_price: {
        id: newPrice.id,
        product: newPrice.product as string,
        unit_amount: newPrice.unit_amount,
        currency: newPrice.currency,
        active: newPrice.active,
      },
      message: 'New price created and settings updated.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update price' },
      { status: 500 }
    );
  }
}
