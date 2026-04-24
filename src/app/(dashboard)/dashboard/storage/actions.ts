'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveDocumentMetadata(fileName: string, filePath: string, fileType: string, fileSize: number) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const { error: dbError } = await supabase.from('documents').insert({
        user_id: user.id,
        file_name: fileName,
        file_path: filePath,
        file_type: fileType,
        file_size: fileSize,
    })

    if (dbError) {
        console.error('DB insert error:', dbError)
        return { error: 'File uploaded, but failed to save metadata' }
    }

    revalidatePath('/dashboard/storage')
    return { success: true }
}

export async function deleteFile(documentId: string, filePath: string) {
    const supabase = await createClient()

    // 1. Delete from database
    const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

    if (dbError) {
        return { error: 'Failed to delete file record' }
    }

    // 2. Delete from storage
    const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath])

    if (storageError) {
        console.error('Storage delete error:', storageError)
        // The record is already gone, which is acceptable, but storage has an orphan
    }

    revalidatePath('/dashboard/storage')
    return { success: true }
}

export async function getSignedUrl(filePath: string, download = false) {
    const supabase = await createClient()

    const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(filePath, 3600, download ? { download: true } : {})

    if (error || !data) {
        return { error: 'Failed to generate link' }
    }

    return { signedUrl: data.signedUrl }
}
