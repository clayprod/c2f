import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/errors';
import { z } from 'zod';

const ruleSchema = z.object({
  rule_type: z.enum(['debt_due', 'receivable_due', 'budget_limit', 'budget_empty']),
  enabled: z.boolean().default(true),
  threshold_days: z.number().int().min(1).optional().nullable(),
  threshold_percentage: z.number().min(0).max(100).optional().nullable(),
  frequency_hours: z.number().int().min(1).default(24),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('notification_rules')
      .select('*')
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('user_id', { ascending: false })
      .order('rule_type', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
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
    const validated = ruleSchema.parse(body);

    const supabase = await createClient();

    // Validate thresholds based on rule type
    if (validated.rule_type === 'debt_due' || validated.rule_type === 'receivable_due') {
      if (validated.threshold_days === null || validated.threshold_days === undefined) {
        return NextResponse.json(
          { error: 'threshold_days is required for debt_due and receivable_due rules' },
          { status: 400 }
        );
      }
    }

    if (validated.rule_type === 'budget_limit') {
      if (validated.threshold_percentage === null || validated.threshold_percentage === undefined) {
        return NextResponse.json(
          { error: 'threshold_percentage is required for budget_limit rule' },
          { status: 400 }
        );
      }
    }

    const { data, error } = await supabase
      .from('notification_rules')
      .upsert(
        {
          user_id: userId,
          rule_type: validated.rule_type,
          enabled: validated.enabled,
          threshold_days: validated.threshold_days ?? null,
          threshold_percentage: validated.threshold_percentage ?? null,
          frequency_hours: validated.frequency_hours,
        },
        {
          onConflict: 'user_id,rule_type',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
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
