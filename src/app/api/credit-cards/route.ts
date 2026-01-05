import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { creditCardSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { isCreditCardExpired } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = createClientFromRequest(request);

    // Get all credit cards - use simple select first
    const { data: cards, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'credit_card')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Credit cards GET error (query):', error);
      throw error;
    }

    // If no cards, return empty array
    if (!cards || cards.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Get current bills for each card
    const cardIds = (cards || []).map(c => c.id);
    let billsMap = new Map<string, any[]>();
    
    if (cardIds.length > 0) {
      const { data: bills, error: billsError } = await supabase
        .from('credit_card_bills')
        .select('id, account_id, reference_month, closing_date, due_date, total_cents, minimum_payment_cents, paid_cents, status')
        .eq('user_id', userId)
        .in('account_id', cardIds)
        .in('status', ['open', 'closed']);
      
      if (billsError) {
        console.error('Error fetching credit card bills:', billsError);
        // Continue without bills if there's an error
      } else if (bills) {
        bills.forEach((bill: any) => {
          if (!billsMap.has(bill.account_id)) {
            billsMap.set(bill.account_id, []);
          }
          billsMap.get(bill.account_id)!.push(bill);
        });
      }
    }

    // Process cards to include usage percentage and format current bill
    const processedCards = (cards || []).map(card => {
      try {
        const cardBills = billsMap.get(card.id) || [];
        const openBill = cardBills.find((b: any) => b.status === 'open') || cardBills[0];

        // Convert NUMERIC to cents for calculations
        const creditLimitCents = Math.round((card.credit_limit || 0) * 100);
        const availableBalanceCents = Math.round((card.available_balance || card.credit_limit || 0) * 100);
        
        const usedLimit = creditLimitCents - availableBalanceCents;
        const usagePercentage = creditLimitCents > 0
          ? Math.round((usedLimit / creditLimitCents) * 100)
          : 0;

        const expired = isCreditCardExpired(card.expiration_date);

        return {
          ...card,
          credit_limit_cents: creditLimitCents,
          available_limit_cents: availableBalanceCents,
          current_bill: openBill || null,
          used_limit_cents: usedLimit,
          usage_percentage: usagePercentage,
          expiration_date: card.expiration_date || null,
          is_expired: expired,
        };
      } catch (cardError) {
        console.error('Error processing card:', card.id, cardError);
        // Return card without processing if there's an error
        const expired = isCreditCardExpired(card.expiration_date);

        return {
          ...card,
          credit_limit_cents: Math.round((card.credit_limit || 0) * 100),
          available_limit_cents: Math.round((card.available_balance || 0) * 100),
          current_bill: null,
          used_limit_cents: 0,
          usage_percentage: 0,
          expiration_date: card.expiration_date || null,
          is_expired: expired,
        };
      }
    });

    return NextResponse.json({ data: processedCards });
  } catch (error) {
    console.error('Credit cards GET error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = creditCardSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    // Check if this should be the default card
    const { count } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'credit_card');

    const isDefault = validated.is_default || count === 0;

    // If setting as default, unset other default cards
    if (isDefault) {
      await supabase
        .from('accounts')
        .update({ is_default: false })
        .eq('user_id', userId)
        .eq('type', 'credit_card');
    }

    // Create the credit card account
    // Convert cents to NUMERIC (reais) for database
    const creditLimit = validated.credit_limit_cents / 100;
    
    // Parse expiration_date if provided (format: YYYY-MM-DD)
    let expirationDate: string | null = null;
    if (validated.expiration_date && validated.expiration_date.trim() !== '') {
      expirationDate = validated.expiration_date;
    }
    
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        user_id: userId,
        name: validated.name,
        type: 'credit_card',
        institution: validated.institution || null,
        last_four_digits: validated.last_four_digits && validated.last_four_digits.trim() !== '' ? validated.last_four_digits : null,
        card_brand: validated.card_brand || null,
        currency: 'BRL',
        current_balance: 0,
        credit_limit: creditLimit,
        available_balance: creditLimit,
        closing_day: validated.closing_day,
        due_day: validated.due_day,
        expiration_date: expirationDate,
        color: validated.color || '#1a1a2e',
        icon: '💳', // Fixed icon for all credit cards
        is_default: isDefault,
      })
      .select('id, user_id, name, type, institution, last_four_digits, card_brand, currency, current_balance, available_balance, credit_limit, closing_day, due_day, expiration_date, color, icon, is_default, created_at, updated_at')
      .single();

    if (error) {
      console.error('Error creating credit card:', error);
      throw error;
    }

    // Create a specific category for this credit card (using card name directly)
    const categoryName = validated.name.toUpperCase();
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: categoryName,
        type: 'expense',
        icon: '💳',
        color: validated.color || '#FF1493',
        source_type: 'credit_card',
      })
      .select()
      .single();

    if (categoryError) {
      console.error('Error creating card category:', categoryError);
      // Don't fail the whole operation if category creation fails
    }

    // Store the category ID in the card for reference
    if (category) {
      await supabase
        .from('accounts')
        .update({ category_id: category.id })
        .eq('id', data.id);
    }

    // Create the current month's bill
    const today = new Date();
    const currentDay = today.getDate();
    const closingDay = validated.closing_day;
    const dueDay = validated.due_day;

    let referenceMonth: Date;
    if (currentDay > closingDay) {
      referenceMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    } else {
      referenceMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    // Calculate closing date (ensure it's valid for the month)
    const closingDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), closingDay);
    // Adjust if closing day exceeds month days (e.g., 31 in February)
    if (closingDate.getDate() !== closingDay) {
      closingDate.setDate(0); // Last day of previous month
    }

    // Calculate due date (ensure it's valid for the month)
    const dueDate = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), dueDay);
    // Adjust if due day exceeds month days
    if (dueDate.getDate() !== dueDay) {
      dueDate.setDate(0); // Last day of previous month
    }

    const { error: billError } = await supabase
      .from('credit_card_bills')
      .insert({
        user_id: userId,
        account_id: data.id,
        reference_month: referenceMonth.toISOString().split('T')[0],
        closing_date: closingDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'open',
      });

    if (billError) {
      console.error('Error creating initial bill:', billError);
    }

    // Convert NUMERIC to cents for API response
    const responseData = {
      ...data,
      balance_cents: Math.round((data.current_balance || 0) * 100),
      credit_limit_cents: Math.round((data.credit_limit || 0) * 100),
      available_limit_cents: Math.round((data.available_balance || 0) * 100),
      expiration_date: data.expiration_date || null,
      category_id: category?.id,
      category_name: category?.name,
    };

    return NextResponse.json({
      data: responseData
    }, { status: 201 });
  } catch (error: any) {
    console.error('Credit card creation error:', error);
    if (error && error.name === 'ZodError') {
      // Return more detailed validation error
      const zodError = error as any;
      const errorMessages = zodError.errors?.map((e: any) => ({
        field: e.path.join('.'),
        message: e.message,
      })) || [];
      return NextResponse.json(
        { 
          error: 'Validation error', 
          details: errorMessages,
          fullError: zodError.errors 
        },
        { status: 400 }
      );
    }
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
