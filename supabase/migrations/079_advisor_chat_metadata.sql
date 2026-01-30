-- Migration: 035_advisor_chat_metadata.sql
-- Description: Add metadata column to advisor_insights for storing chat context (user message, session_id)

-- Add metadata column to store additional chat context
ALTER TABLE public.advisor_insights ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.advisor_insights.metadata IS 'Additional metadata for chat messages (user_message, session_id) to enable history reconstruction';

-- Create index for efficient querying by session_id in metadata
CREATE INDEX IF NOT EXISTS idx_advisor_insights_session_id 
ON public.advisor_insights((metadata->>'session_id'))
WHERE metadata->>'session_id' IS NOT NULL;
