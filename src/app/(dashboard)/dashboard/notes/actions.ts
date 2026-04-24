'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function decodeStoragePath(rawPath: string): string {
    let normalized = rawPath
    for (let i = 0; i < 3; i++) {
        try {
            const decoded = decodeURIComponent(normalized)
            if (decoded === normalized) break
            normalized = decoded
        } catch {
            break
        }
    }
    return normalized.replace(/^\/+/, '').replace(/\\/g, '/')
}

export async function createNote() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // Generate unique "Untitled" name
    const { data: existingNotes } = await supabase
        .from('notes')
        .select('title')
        .eq('owner_id', user.id)

    const existingTitles = new Set((existingNotes || []).map(n => n.title?.toLowerCase()))
    let title = 'Untitled'
    if (existingTitles.has('untitled')) {
        let counter = 1
        while (existingTitles.has(`untitled${counter}`)) {
            counter++
        }
        title = `Untitled${counter}`
    }

    const { data, error } = await supabase
        .from('notes')
        .insert({
            owner_id: user.id,
            title,
            content: {},
            updated_by: user.id,
        })
        .select('id')
        .single()

    if (error) {
        console.error('Error creating note:', error)
        return { error: `Failed to create note: ${error.message}` }
    }

    revalidatePath('/dashboard/notes')
    return { id: data.id }
}

export async function checkDuplicateTitle(noteId: string, title: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { duplicate: false }

    const { data } = await supabase
        .from('notes')
        .select('id')
        .eq('owner_id', user.id)
        .ilike('title', title)
        .neq('id', noteId)
        .limit(1)

    return { duplicate: !!(data && data.length > 0) }
}

// Convert signed/proxy storage URLs back to public URLs before persisting
// so that temporary URLs are never stored in the database
function normalizeImageUrls(content: object): object {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const signedPrefix = `${supabaseUrl}/storage/v1/object/sign/note-images/`
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'

    type ContentNode = { type?: string; attrs?: Record<string, unknown>; content?: ContentNode[] }

    function walk(nodes: ContentNode[] | undefined) {
        if (!nodes) return
        for (const node of nodes) {
            if (node.type === 'image' && typeof node.attrs?.src === 'string') {
                const src = node.attrs.src as string
                if (src.startsWith(signedPrefix)) {
                    // Extract storage path from signed URL (remove query params)
                    const withoutPrefix = src.slice(signedPrefix.length)
                    const storagePath = decodeStoragePath(withoutPrefix.split('?')[0])
                    node.attrs.src = publicPrefix + storagePath
                } else if (src.startsWith(proxyPrefix)) {
                    // Extract storage path from proxy URL
                    try {
                        const params = new URLSearchParams(src.slice(proxyPrefix.length))
                        const storagePath = params.get('path')
                        if (storagePath) {
                            node.attrs.src = publicPrefix + decodeStoragePath(storagePath)
                        }
                    } catch {
                        // Keep original if parsing fails
                    }
                }
            }
            if (node.content) walk(node.content)
        }
    }

    const copy = JSON.parse(JSON.stringify(content)) as { content?: ContentNode[] }
    walk(copy.content)
    return copy
}

export async function updateNote(noteId: string, title: string, content: object) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // Normalize signed URLs back to public URLs before persisting
    const normalizedContent = normalizeImageUrls(content)

    const { error } = await supabase
        .from('notes')
        .update({
            title,
            content: normalizedContent,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
        })
        .eq('id', noteId)

    if (error) {
        console.error('Error updating note:', error)
        return { error: `Failed to save note: ${error.message}` }
    }

    revalidatePath('/dashboard/notes')
    return { success: true }
}

export async function deleteNote(noteId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // Fetch the note content to find all image URLs before deleting
    const { data: note } = await supabase
        .from('notes')
        .select('content')
        .eq('id', noteId)
        .single()

    // Delete the note from the database
    const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)

    if (error) {
        console.error('Error deleting note:', error)
        return { error: `Failed to delete note: ${error.message}` }
    }

    // Clean up images from storage (best-effort, don't block on failure)
    if (note?.content) {
        const imageUrls = extractImageUrls(note.content as Record<string, unknown>)
        if (imageUrls.length > 0) {
            const paths = imageUrlsToPaths(imageUrls)
            if (paths.length > 0) {
                await supabase.storage.from('note-images').remove(paths)
            }
        }
    }

    revalidatePath('/dashboard/notes')
    return { success: true }
}

// Extract all image src URLs from TipTap JSON content
function extractImageUrls(content: Record<string, unknown>): string[] {
    const urls: string[] = []
    type ContentNode = { type?: string; attrs?: Record<string, unknown>; content?: ContentNode[] }
    function walk(nodes: ContentNode[] | undefined) {
        if (!nodes) return
        for (const node of nodes) {
            if (node.type === 'image' && typeof node.attrs?.src === 'string') {
                urls.push(node.attrs.src as string)
            }
            if (node.content) walk(node.content)
        }
    }
    walk((content as { content?: ContentNode[] }).content)
    return urls
}

// Convert public/proxy image URLs to storage paths for deletion
function imageUrlsToPaths(urls: string[]): string[] {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'
    const paths: string[] = []

    for (const url of urls) {
        if (url.startsWith(publicPrefix)) {
            paths.push(decodeStoragePath(url.slice(publicPrefix.length).split('?')[0]))
        } else if (url.startsWith(proxyPrefix)) {
            try {
                const params = new URLSearchParams(url.slice(proxyPrefix.length))
                const path = params.get('path')
                if (path) paths.push(decodeStoragePath(path))
            } catch { /* skip */ }
        }
    }

    return paths
}


export async function shareNote(noteId: string, email: string, permission: 'view' | 'edit') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // Verify the current user owns this note
    const { data: note } = await supabase
        .from('notes')
        .select('owner_id')
        .eq('id', noteId)
        .single()

    if (!note || note.owner_id !== user.id) {
        return { error: 'Only the note owner can share it' }
    }

    // Find the target user by email — try profiles table first, then fall back to RPC
    let targetUserId: string | null = null

    // Try profiles table
    const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

    if (targetProfile) {
        targetUserId = targetProfile.id
    } else {
        // Fallback: look up via auth.users using database function
        const { data: rpcResult } = await supabase
            .rpc('get_user_id_by_email', { lookup_email: email })

        if (rpcResult) {
            targetUserId = rpcResult
            // Backfill the email into profiles so future lookups (e.g. ShareDialog)
            // can display the user's email instead of "Unknown user"
            await supabase
                .from('profiles')
                .update({ email })
                .eq('id', rpcResult)
        }
    }

    if (!targetUserId) {
        return { error: 'No user found with that email address' }
    }

    if (targetUserId === user.id) {
        return { error: 'You cannot share a note with yourself' }
    }

    const { error } = await supabase
        .from('note_shares')
        .insert({
            note_id: noteId,
            shared_with: targetUserId,
            permission,
        })

    if (error) {
        if (error.code === '23505') {
            return { error: 'This note is already shared with that user' }
        }
        console.error('Error sharing note:', error)
        return { error: `Failed to share note: ${error.message}` }
    }

    revalidatePath('/dashboard/notes')
    return { success: true }
}

export async function updateSharePermission(shareId: string, permission: 'view' | 'edit', noteId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // Verify the current user owns this note (owner can always access their own notes via RLS)
    const { data: note } = await supabase
        .from('notes')
        .select('owner_id')
        .eq('id', noteId)
        .single()

    if (!note || note.owner_id !== user.id) {
        return { error: 'Only the note owner can change permissions' }
    }

    // Use RPC function to bypass RLS — the note owner isn't in shared_with,
    // so RLS on note_shares blocks direct UPDATE from the owner
    const { error } = await supabase.rpc('update_share_permission', {
        p_share_id: shareId,
        p_note_id: noteId,
        p_permission: permission,
        p_owner_id: user.id,
    })

    if (error) {
        console.error('Error updating share permission:', error)
        return { error: `Failed to update permission: ${error.message}` }
    }

    revalidatePath('/dashboard/notes')
    return { success: true }
}

export async function removeShare(shareId: string, noteId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    // Use RPC to bypass RLS — the note owner isn't in shared_with,
    // so RLS on note_shares blocks direct DELETE from the owner
    const { error } = await supabase.rpc('remove_share', {
        p_share_id: shareId,
        p_note_id: noteId,
        p_owner_id: user.id,
    })

    if (error) {
        console.error('Error removing share:', error)
        return { error: `Failed to remove share: ${error.message}` }
    }

    revalidatePath('/dashboard/notes')
    return { success: true }
}

export async function getNoteShares(noteId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated', shares: [] }

    // Fetch shares without the FK join to avoid silent failures if the FK name doesn't match
    const { data: shares, error } = await supabase
        .from('note_shares')
        .select('id, permission, shared_with')
        .eq('note_id', noteId)

    if (error) {
        console.error('Error fetching shares:', error)
        return { error: error.message, shares: [] }
    }

    if (!shares || shares.length === 0) return { shares: [] }

    // Look up each shared user's email via RPC (SECURITY DEFINER bypasses RLS)
    const emailMap = new Map<string, string>()
    for (const share of shares) {
        const { data: email } = await supabase.rpc('get_user_email_by_id', { lookup_id: share.shared_with })
        if (email) emailMap.set(share.shared_with, email)
    }

    const enrichedShares = shares.map(s => ({
        ...s,
        profiles: { email: emailMap.get(s.shared_with) || null },
    }))

    return { shares: enrichedShares }
}

export async function leaveSharedNote(noteId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
        .from('note_shares')
        .delete()
        .eq('note_id', noteId)
        .eq('shared_with', user.id)

    if (error) {
        console.error('Error leaving shared note:', error)
        return { error: `Failed to leave note: ${error.message}` }
    }

    revalidatePath('/dashboard/notes')
    return { success: true }
}

// Replace Supabase public storage URLs with proxy URLs in note content
// so shared users can access images through our API proxy which handles auth
function resolveImageUrls(
    content: Record<string, unknown>,
    noteId: string
): Record<string, unknown> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'

    type ContentNode = { type?: string; attrs?: Record<string, unknown>; content?: ContentNode[] }

    function walk(nodes: ContentNode[] | undefined) {
        if (!nodes) return
        for (const node of nodes) {
            if (node.type === 'image' && typeof node.attrs?.src === 'string') {
                const src = node.attrs.src as string
                if (src.startsWith(publicPrefix)) {
                    const storagePath = decodeStoragePath(src.slice(publicPrefix.length))
                    // Replace with proxy URL that handles auth and access control
                    node.attrs.src = `/api/note-image?path=${encodeURIComponent(storagePath)}&noteId=${noteId}`
                } else if (src.startsWith(proxyPrefix)) {
                    // Re-canonicalize existing proxy URLs to avoid encoded-path drift.
                    try {
                        const params = new URLSearchParams(src.slice(proxyPrefix.length))
                        const storagePath = params.get('path')
                        if (storagePath) {
                            node.attrs.src = `/api/note-image?path=${encodeURIComponent(decodeStoragePath(storagePath))}&noteId=${noteId}`
                        }
                    } catch {
                        // Keep original if parsing fails
                    }
                }
            }
            if (node.content) walk(node.content)
        }
    }

    const contentCopy = JSON.parse(JSON.stringify(content)) as { content?: ContentNode[] }
    walk(contentCopy.content)

    return contentCopy as Record<string, unknown>
}

export async function getNote(noteId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not authenticated', note: null }

    // Try to fetch the note — RLS will enforce access
    const { data: note, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single()

    if (error || !note) {
        // PGRST116 = no rows found (deleted note, access denied) — not a real error
        if (error && (error as { code?: string }).code !== 'PGRST116') {
            console.error('Error fetching note:', error)
        }
        return { error: 'Note not found or access denied', note: null }
    }

    // Fetch the last editor's profile separately (avoids FK dependency)
    let profiles: { full_name: string | null; email: string | null } | null = null
    if (note.updated_by) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', note.updated_by)
            .single()
        profiles = profile
    }
    note.profiles = profiles

    // Rewrite public storage URLs to proxy URLs for ALL users (including the owner).
    // Storage RLS on the note-images bucket may block direct public access for files
    // uploaded by a different user. Routing everything through the proxy ensures
    // both the owner and shared users can see images uploaded by anyone.
    if (note.content) {
        note.content = resolveImageUrls(
            note.content as Record<string, unknown>,
            noteId
        )
    }

    // Determine if the current user can edit
    let canEdit = note.owner_id === user.id
    if (!canEdit) {
        const { data: share } = await supabase
            .from('note_shares')
            .select('permission')
            .eq('note_id', noteId)
            .eq('shared_with', user.id)
            .single()

        canEdit = share?.permission === 'edit'
    }

    return { note, canEdit, currentUserId: user.id }
}
