'use server'

import { createClient } from '@/lib/supabase/server'

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
    const timezone = formData.get('timezone') as string

    const { error } = await supabase
        .from('profiles')
        .update({
            full_name: fullName,
            timezone: timezone,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    if (error) {
        return { error: error.message }
    }

    return { success: true }
}

export async function uploadAvatar(formData: FormData) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const file = formData.get('avatar') as File

    if (!file || file.size === 0) {
        return { error: 'No file selected' }
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
        return { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' }
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        return { error: 'File too large. Maximum size is 2MB.' }
    }

    // Create a unique file path for this user
    const fileExtension = file.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExtension}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
            upsert: true, // overwrite if exists
        })

    if (uploadError) {
        return { error: uploadError.message }
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

    // Update profile with new avatar URL
    const { error: updateError } = await supabase
        .from('profiles')
        .update({
            avatar_url: urlData.publicUrl,
            updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

    if (updateError) {
        return { error: updateError.message }
    }

    return { success: true, avatarUrl: urlData.publicUrl }
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

    return { success: true }
}
