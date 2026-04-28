'use server'

import { createClient } from '@/lib/supabase/server'

export async function registerUser(email: string, password: string, captchaToken: string) {
    // 1. Verify reCAPTCHA token server-side
    const secretKey = process.env.RECAPTCHA_SECRET_KEY
    if (!secretKey) {
        return { error: 'Server configuration error: missing CAPTCHA secret key.' }
    }

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${secretKey}&response=${captchaToken}`,
    })

    const verifyData = await verifyRes.json()

    if (!verifyData.success) {
        return { error: 'CAPTCHA verification failed. Please try again.' }
    }

    // 2. Create user via Supabase
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    // Duplicate email: Supabase silently "succeeds" but returns no identities
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
        return { error: 'An account with this email already exists. Please sign in instead.' }
    }

    // If email confirmation is OFF → session exists immediately
    if (data.session) {
        // Ensure the profiles table has the email stored
        if (data.user) {
            await supabase
                .from('profiles')
                .update({ email })
                .eq('id', data.user.id)
        }
        return { success: true, redirect: '/dashboard' }
    }

    // If email confirmation is ON, try to store email in profiles for the new user
    if (data.user) {
        await supabase
            .from('profiles')
            .update({ email })
            .eq('id', data.user.id)
    }

    // If email confirmation is ON → tell user to check email
    return { success: true, confirmEmail: true }
}
