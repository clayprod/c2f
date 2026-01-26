-- Fix plan features structure to match code expectations
-- This migration updates the plan_features JSON structure to match what the frontend expects

-- Update Free plan features
UPDATE plan_features 
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  '{"id": "free", "name": "Free", "price": 0, "period": "month"}'::jsonb,
                  '{dashboard}', 'true'
                ),
                '{transactions}', '100'
              ),
              '{accounts}', 'true'
            ),
            '{credit_cards}', 'true'
          ),
          '{categories}', 'true'
        ),
        '{budgets}', 'false'
      ),
      '{debts}', 'false'
    ),
    '{receivables}', 'false'
  ),
  '{investments}', 'false'
)
WHERE plan_type = 'free';

-- Update Pro plan features (inherits Free + new features)
UPDATE plan_features 
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    '{"id": "pro", "name": "Pro", "price": 2900, "period": "month"}'::jsonb,
                    '{dashboard}', 'true'
                  ),
                  '{transactions}', '999999'
                ),
                '{accounts}', 'true'
              ),
              '{credit_cards}', 'true'
            ),
            '{categories}', 'true'
          ),
            '{budgets}', 'true'
          ),
            '{debts}', 'true'
          ),
            '{receivables}', 'true'
          ),
            '{investments}', 'true'
          ),
            '{goals}', 'true'
          ),
            '{ai_advisor}', '10'
          )
WHERE plan_type = 'pro';

-- Update Premium plan features (inherits Pro + new features)
UPDATE plan_features 
SET features = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(
                        jsonb_set(
                          jsonb_set(
                            '{"id": "premium", "name": "Premium", "price": 5900, "period": "month"}'::jsonb,
                            '{dashboard}', 'true'
                          ),
                          '{transactions}', '999999'
                        ),
                        '{accounts}', 'true'
                      ),
                      '{credit_cards}', 'true'
                    ),
                    '{categories}', 'true'
                  ),
                    '{budgets}', 'true'
                  ),
                    '{debts}', 'true'
                  ),
                    '{receivables}', 'true'
                  ),
                    '{investments}', 'true'
                  ),
                    '{goals}', 'true'
                  ),
                    '{ai_advisor}', '999999'
                  ),
                    '{assets}', 'true'
                  ),
                    '{reports}', 'true'
                  ),
                    '{integrations}', 'true'
                  )
WHERE plan_type = 'premium';

-- Update cache timestamp to force refresh
UPDATE global_settings 
SET settings = jsonb_set(settings, '{cache_timestamp}', to_jsonb(extract(epoch from now())::bigint))
WHERE key = 'plan_features';