-- Migration: Add expense_type to categories
-- Description: Add expense_type field to categorize expenses as fixed or variable

-- Add expense_type column to categories table
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS expense_type TEXT CHECK (expense_type IN ('fixed', 'variable') OR expense_type IS NULL);

-- Add comment explaining the field
COMMENT ON COLUMN public.categories.expense_type IS 'Type of expense: fixed (recurring, essential) or variable (flexible, discretionary). Only applicable when type = expense.';

-- Create index for performance when filtering by expense_type
CREATE INDEX IF NOT EXISTS idx_categories_expense_type ON public.categories(expense_type) WHERE expense_type IS NOT NULL;

-- Update RLS policies to include the new column (policies should already cover all columns)
-- No changes needed to RLS policies as they use column-level security or SELECT * patterns
