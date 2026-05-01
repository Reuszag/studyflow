'use server'

import { createClient } from '@/lib/supabase/server'

export async function registerUser(email: string, password: string, captchaToken: string) {
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

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    if (data.session) {
        if (data.user) {
            await supabase
                .from('profiles')
                .update({ email })
                .eq('id', data.user.id)
        }
        return { success: true, redirect: '/dashboard' }
    }

    if (data.user) {
        await supabase
            .from('profiles')
            .update({ email })
            .eq('id', data.user.id)
    }

    return { success: true, confirmEmail: true }
}
