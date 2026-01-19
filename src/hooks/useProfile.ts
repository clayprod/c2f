'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface UserProfile {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
    plan: 'free' | 'pro' | 'premium';
    role?: string;
}

export function useProfile() {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUserProfile = async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const [profileResult, planRes] = await Promise.all([
                    supabase
                        .from('profiles')
                        .select('full_name, email, avatar_url, role')
                        .eq('id', user.id)
                        .single(),
                    fetch('/api/billing/plan')
                ]);

                const profile = profileResult.data;
                let plan: 'free' | 'pro' | 'premium' = 'free';
                try {
                    if (planRes.ok) {
                        const planData = await planRes.json();
                        plan = (planData?.plan || 'free') as 'free' | 'pro' | 'premium';
                    }
                } catch {
                    // ignore
                }

                if (profile) {
                    setUserProfile({
                        full_name: profile.full_name,
                        email: profile.email || user.email || '',
                        avatar_url: profile.avatar_url,
                        plan,
                        role: profile.role,
                    });
                } else {
                    setUserProfile({
                        full_name: null,
                        email: user.email || '',
                        avatar_url: null,
                        plan,
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserProfile();

        const handleProfileUpdate = () => {
            fetchUserProfile();
        };

        window.addEventListener('profile-updated', handleProfileUpdate);
        return () => {
            window.removeEventListener('profile-updated', handleProfileUpdate);
        };
    }, []);

    return {
        userProfile,
        loading,
        refreshProfile: fetchUserProfile,
        isFree: userProfile?.plan === 'free',
        isPro: userProfile?.plan === 'pro' || userProfile?.plan === 'premium',
        isPremium: userProfile?.plan === 'premium',
        isAdmin: userProfile?.role === 'admin'
    };
}
