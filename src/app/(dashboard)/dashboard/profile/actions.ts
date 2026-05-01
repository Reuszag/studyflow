'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function getProfile() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    if (error) {
        return { error: error.message }
    }

    return { profile, email: user.email }
}

export async function updateProfile(formData: FormData) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const fullName = formData.get('full_name') as string
    const timezone = formData.get('timezone') as string | null

    const updatePayload: Record<string, unknown> = {
        full_name: fullName,
        updated_at: new Date().toISOString(),
    }

    if (timezone) {
        updatePayload.timezone = timezone
    }

    const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
}

export async function deleteAvatar() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    // List files in the user's avatar folder to find the current avatar
    const { data: files } = await supabase.storage
        .from('avatars')
        .list(user.id)

    // Delete all avatar files for this user
    if (files && files.length > 0) {
        const filePaths = files.map((file) => `${user.id}/${file.name}`)
        await supabase.storage.from('avatars').remove(filePaths)
    }

    // Set avatar_url to null in profiles
    const { error } = await supabase
        .from('profiles')
        .update({
            avatar_url: null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
}

export async function changePassword(currentPassword: string, newPassword: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !user.email) return { error: 'Not authenticated' }

    // Re-authenticate with current password to verify it
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
    })
    if (signInError) return { error: 'Current password is incorrect.' }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: error.message }

    return { success: true }
}

export async function signOutUser() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
