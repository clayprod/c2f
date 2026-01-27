'use client';

import { useCallback } from 'react';

export const OPEN_UPGRADE_MODAL_EVENT = 'open-upgrade-modal';

export function useUpgradeModal() {
    const openUpgradeModal = useCallback(() => {
        window.dispatchEvent(new CustomEvent(OPEN_UPGRADE_MODAL_EVENT));
    }, []);

    return { openUpgradeModal };
}
