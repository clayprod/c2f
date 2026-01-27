import { createClient } from '@/lib/supabase/server';

export interface NotificationSegment {
  gender?: string[] | null;
  states?: string[] | null;
  cities?: string[] | null;
  age_min?: number | null;
  age_max?: number | null;
  income_min_cents?: number | null;
  income_max_cents?: number | null;
  plan_ids?: string[] | null;
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: Date | string | null): number | null {
  if (!birthDate) return null;

  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Validate segment criteria
 */
export function validateSegment(segment: NotificationSegment): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (segment.age_min !== null && segment.age_min !== undefined) {
    if (segment.age_min < 0 || segment.age_min > 150) {
      errors.push('Idade mínima deve estar entre 0 e 150 anos');
    }
  }

  if (segment.age_max !== null && segment.age_max !== undefined) {
    if (segment.age_max < 0 || segment.age_max > 150) {
      errors.push('Idade máxima deve estar entre 0 e 150 anos');
    }
  }

  if (
    segment.age_min !== null &&
    segment.age_min !== undefined &&
    segment.age_max !== null &&
    segment.age_max !== undefined &&
    segment.age_min > segment.age_max
  ) {
    errors.push('Idade mínima não pode ser maior que idade máxima');
  }

  if (segment.income_min_cents !== null && segment.income_min_cents !== undefined) {
    if (segment.income_min_cents < 0) {
      errors.push('Renda mínima não pode ser negativa');
    }
  }

  if (segment.income_max_cents !== null && segment.income_max_cents !== undefined) {
    if (segment.income_max_cents < 0) {
      errors.push('Renda máxima não pode ser negativa');
    }
  }

  if (
    segment.income_min_cents !== null &&
    segment.income_min_cents !== undefined &&
    segment.income_max_cents !== null &&
    segment.income_max_cents !== undefined &&
    segment.income_min_cents > segment.income_max_cents
  ) {
    errors.push('Renda mínima não pode ser maior que renda máxima');
  }

  if (segment.plan_ids && segment.plan_ids.length > 0) {
    const validPlans = ['free', 'pro', 'premium'];
    const invalidPlans = segment.plan_ids.filter((p) => !validPlans.includes(p));
    if (invalidPlans.length > 0) {
      errors.push(`Planos inválidos: ${invalidPlans.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get users that match segmentation criteria
 */
export async function getSegmentedUsers(
  segment: NotificationSegment,
  options?: { supabase?: any }
): Promise<string[]> {
  const supabase = options?.supabase ?? await createClient();

  let query = supabase
    .from('profiles')
    .select('id, gender, state, city, birth_date, monthly_income_cents')
    .not('id', 'is', null);

  // Apply gender filter
  if (segment.gender && segment.gender.length > 0) {
    query = query.in('gender', segment.gender);
  }

  // Apply state filter
  if (segment.states && segment.states.length > 0) {
    query = query.in('state', segment.states);
  }

  // Apply city filter (will be filtered in memory if states are specified)
  const { data: profiles, error } = await query;

  if (error) {
    console.error('Error fetching segmented users:', error);
    return [];
  }

  if (!profiles) return [];

  // Get billing subscriptions for plan filtering
  const { data: subscriptions } = await supabase
    .from('billing_subscriptions')
    .select('user_id, plan_id');

  const userPlanMap = new Map<string, string>();
  (subscriptions || []).forEach((sub: { user_id: string; plan_id: string }) => {
    userPlanMap.set(sub.user_id, sub.plan_id);
  });

  // Filter users based on all criteria
  const filteredUsers = profiles
    .filter((profile: any) => {
      // City filter
      if (segment.cities && segment.cities.length > 0) {
        if (!profile.city || !segment.cities.includes(profile.city)) {
          return false;
        }
      }

      // Age filter
      if (segment.age_min !== null && segment.age_min !== undefined) {
        const age = calculateAge(profile.birth_date);
        if (age === null || age < segment.age_min) {
          return false;
        }
      }

      if (segment.age_max !== null && segment.age_max !== undefined) {
        const age = calculateAge(profile.birth_date);
        if (age === null || age > segment.age_max) {
          return false;
        }
      }

      // Income filter
      if (segment.income_min_cents !== null && segment.income_min_cents !== undefined) {
        const income = profile.monthly_income_cents || 0;
        if (income < segment.income_min_cents) {
          return false;
        }
      }

      if (segment.income_max_cents !== null && segment.income_max_cents !== undefined) {
        const income = profile.monthly_income_cents || 0;
        if (income > segment.income_max_cents) {
          return false;
        }
      }

      // Plan filter
      if (segment.plan_ids && segment.plan_ids.length > 0) {
        const userPlan = userPlanMap.get(profile.id) || 'free';
        if (!segment.plan_ids.includes(userPlan)) {
          return false;
        }
      }

      return true;
    })
    .map((profile: any) => profile.id);

  return filteredUsers;
}

/**
 * Estimate how many users will be targeted by a segment
 */
export async function estimateTargetCount(
  segment: NotificationSegment,
  options?: { supabase?: any }
): Promise<number> {
  const users = await getSegmentedUsers(segment, options);
  return users.length;
}
