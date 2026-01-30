-- Migration: Add Transfer Support to Transactions
-- Description: Add fields to support transfer detection and linking between accounts

-- 1. Add transfer-related columns to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS transfer_type TEXT CHECK (transfer_type IN ('outgoing', 'incoming'));

-- 2. Create index for linked transactions lookup
CREATE INDEX IF NOT EXISTS idx_transactions_linked 
ON public.transactions(linked_transaction_id) 
WHERE linked_transaction_id IS NOT NULL;

-- 3. Create index for transfer filtering
CREATE INDEX IF NOT EXISTS idx_transactions_is_transfer 
ON public.transactions(user_id, is_transfer) 
WHERE is_transfer = TRUE;

-- 4. Create composite index for transfer detection queries
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_detection 
ON public.transactions(user_id, posted_at, amount, account_id) 
WHERE is_transfer = FALSE;

-- 5. Add comments for documentation
COMMENT ON COLUMN public.transactions.linked_transaction_id IS 'Reference to the paired transaction in a transfer (outgoing <-> incoming)';
COMMENT ON COLUMN public.transactions.is_transfer IS 'Whether this transaction is part of a transfer between accounts';
COMMENT ON COLUMN public.transactions.transfer_type IS 'Type of transfer: outgoing (money left this account) or incoming (money entered this account)';

-- 6. Create function to automatically link transfer transactions
CREATE OR REPLACE FUNCTION link_transfer_transactions(
    p_user_id UUID,
    p_transaction_id UUID
) RETURNS VOID AS $$
DECLARE
    v_transaction RECORD;
    v_match RECORD;
BEGIN
    -- Get the transaction details
    SELECT * INTO v_transaction
    FROM public.transactions
    WHERE id = p_transaction_id AND user_id = p_user_id;
    
    IF NOT FOUND OR v_transaction.is_transfer THEN
        RETURN;
    END IF;
    
    -- Look for a matching transaction on the same day with opposite amount
    -- and different account
    SELECT * INTO v_match
    FROM public.transactions
    WHERE user_id = p_user_id
        AND posted_at = v_transaction.posted_at
        AND amount = -v_transaction.amount
        AND account_id != v_transaction.account_id
        AND is_transfer = FALSE
        AND id != p_transaction_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF FOUND THEN
        -- Link the transactions
        UPDATE public.transactions
        SET linked_transaction_id = v_match.id,
            is_transfer = TRUE,
            transfer_type = CASE WHEN amount < 0 THEN 'outgoing' ELSE 'incoming' END
        WHERE id = p_transaction_id;
        
        UPDATE public.transactions
        SET linked_transaction_id = p_transaction_id,
            is_transfer = TRUE,
            transfer_type = CASE WHEN amount < 0 THEN 'outgoing' ELSE 'incoming' END
        WHERE id = v_match.id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to unlink transfer transactions
CREATE OR REPLACE FUNCTION unlink_transfer_transactions(
    p_user_id UUID,
    p_transaction_id UUID
) RETURNS VOID AS $$
DECLARE
    v_linked_id UUID;
BEGIN
    -- Get the linked transaction id
    SELECT linked_transaction_id INTO v_linked_id
    FROM public.transactions
    WHERE id = p_transaction_id AND user_id = p_user_id;
    
    IF v_linked_id IS NOT NULL THEN
        -- Unlink both transactions
        UPDATE public.transactions
        SET linked_transaction_id = NULL,
            is_transfer = FALSE,
            transfer_type = NULL
        WHERE id IN (p_transaction_id, v_linked_id);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to auto-detect transfers for a date range
CREATE OR REPLACE FUNCTION auto_detect_transfers(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE(
    detected_count INTEGER,
    matched_pairs JSONB
) AS $$
DECLARE
    v_count INTEGER := 0;
    v_pairs JSONB := '[]'::JSONB;
BEGIN
    -- Find and link matching transaction pairs
    WITH potential_matches AS (
        SELECT 
            t1.id as outgoing_id,
            t2.id as incoming_id,
            t1.account_id as from_account_id,
            t2.account_id as to_account_id,
            ABS(t1.amount) as transfer_amount,
            t1.posted_at as transfer_date
        FROM public.transactions t1
        JOIN public.transactions t2 
            ON t1.user_id = t2.user_id
            AND t1.posted_at = t2.posted_at
            AND t1.amount = -t2.amount
            AND t1.account_id != t2.account_id
            AND t1.amount < 0  -- t1 is outgoing (negative)
        WHERE t1.user_id = p_user_id
            AND t1.posted_at BETWEEN p_start_date AND p_end_date
            AND t1.is_transfer = FALSE
            AND t2.is_transfer = FALSE
            AND t1.linked_transaction_id IS NULL
            AND t2.linked_transaction_id IS NULL
    ),
    linked AS (
        UPDATE public.transactions t
        SET 
            linked_transaction_id = CASE 
                WHEN t.id = pm.outgoing_id THEN pm.incoming_id
                ELSE pm.outgoing_id
            END,
            is_transfer = TRUE,
            transfer_type = CASE 
                WHEN t.id = pm.outgoing_id THEN 'outgoing'
                ELSE 'incoming'
            END
        FROM potential_matches pm
        WHERE t.id IN (pm.outgoing_id, pm.incoming_id)
        RETURNING t.id, t.linked_transaction_id, t.transfer_type
    )
    SELECT 
        COUNT(DISTINCT linked_transaction_id)::INTEGER,
        jsonb_agg(
            jsonb_build_object(
                'outgoing_id', pm.outgoing_id,
                'incoming_id', pm.incoming_id,
                'amount', pm.transfer_amount,
                'date', pm.transfer_date
            )
        )
    INTO v_count, v_pairs
    FROM potential_matches pm;
    
    RETURN QUERY SELECT v_count, COALESCE(v_pairs, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- 9. Add comments for functions
COMMENT ON FUNCTION link_transfer_transactions IS 'Links a transaction with its matching counterpart to mark as transfer';
COMMENT ON FUNCTION unlink_transfer_transactions IS 'Removes transfer linkage from a transaction pair';
COMMENT ON FUNCTION auto_detect_transfers IS 'Automatically detects and links transfer transactions within a date range';
