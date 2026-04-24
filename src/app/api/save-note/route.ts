import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

// Convert signed/proxy storage URLs back to public URLs before persisting
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
                    const withoutPrefix = src.slice(signedPrefix.length)
                    const storagePath = decodeStoragePath(withoutPrefix.split('?')[0])
                    node.attrs.src = publicPrefix + storagePath
                } else if (src.startsWith(proxyPrefix)) {
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

// Extract all image src URLs from TipTap JSON content
function extractImageUrls(content: Record<string, unknown>): string[] {
    const urls: string[] = []
    type N = { type?: string; attrs?: Record<string, unknown>; content?: N[] }
    function walk(nodes: N[] | undefined) {
        if (!nodes) return
        for (const node of nodes) {
            if (node.type === 'image' && typeof node.attrs?.src === 'string') {
                urls.push(node.attrs.src as string)
            }
            if (node.content) walk(node.content)
        }
    }
    walk((content as { content?: N[] }).content)
    return urls
}

// Convert image URL to storage path (userId/filename)
function urlToPath(url: string): string | null {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'

    if (url.startsWith(publicPrefix)) {
        return decodeStoragePath(url.slice(publicPrefix.length).split('?')[0])
    } else if (url.startsWith(proxyPrefix)) {
        try {
            const params = new URLSearchParams(url.slice(proxyPrefix.length))
            const path = params.get('path')
            return path ? decodeStoragePath(path) : null
        } catch { /* skip */ }
    }
    return null
}


export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { noteId, title, content, cleanup, allowDowngradeSave } = body

        if (!noteId || !title) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Verify user has permission to save this note (owner OR shared editor).
        // We do this check ourselves instead of relying on RLS so that shared editors
        // (who are not the owner) can also persist content via this beacon endpoint.
        const { data: noteRow } = await supabase
            .from('notes')
            .select('owner_id')
            .eq('id', noteId)
            .single()

        if (!noteRow) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 })
        }

        const isOwner = noteRow.owner_id === user.id
        if (!isOwner) {
            // Check for share permission
            const { data: share } = await supabase
                .from('note_shares')
                .select('permission')
                .eq('note_id', noteId)
                .eq('shared_with', user.id)
                .single()

            if (!share) {
                return NextResponse.json({ error: 'Access denied' }, { status: 403 })
            }

            // Shared users can persist only while they are editors,
            // except the explicit downgrade-save path from the editor client.
            if (share.permission !== 'edit' && allowDowngradeSave !== true) {
                return NextResponse.json({ error: 'Edit permission required' }, { status: 403 })
            }
        }

        // Normalize signed URLs back to public URLs before persisting
        const normalizedContent = content ? normalizeImageUrls(content) : content

        if (allowDowngradeSave && !isOwner) {
            // Permission was already revoked at DB level when this save fires.
            // Use a SECURITY DEFINER RPC that bypasses notes table RLS.
            const { error: rpcError } = await supabase.rpc('save_note_downgrade', {
                p_note_id: noteId,
                p_title: title,
                p_content: normalizedContent,
                p_user_id: user.id,
            })
            if (rpcError) {
                return NextResponse.json({ error: rpcError.message }, { status: 500 })
            }
        } else {
            const { data: updatedRows, error } = await supabase
                .from('notes')
                .update({
                    title,
                    content: normalizedContent,
                    updated_at: new Date().toISOString(),
                    updated_by: user.id,
                })
                .eq('id', noteId)
                .select('id')

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            // If RLS silently blocked the update, no rows are returned.
            if (!updatedRows || updatedRows.length === 0) {
                return NextResponse.json({ error: 'Update blocked — check notes table RLS policies' }, { status: 403 })
            }
        }

        // After saving, clean up orphaned images if requested
        if (cleanup) {
            // Step 1: Collect all notes visible to this user (owned + shared-with)
            const { data: ownedNotes } = await supabase
                .from('notes')
                .select('content')
                .eq('owner_id', user.id)

            const { data: sharedEntries } = await supabase
                .from('note_shares')
                .select('note_id')
                .eq('shared_with', user.id)

            const sharedNoteIds = (sharedEntries || []).map(s => s.note_id)
            let sharedNotes: { content: unknown; owner_id: string }[] = []
            if (sharedNoteIds.length > 0) {
                const { data } = await supabase
                    .from('notes')
                    .select('content, owner_id')
                    .in('id', sharedNoteIds)
                sharedNotes = (data || []) as { content: unknown; owner_id: string }[]
            }

            const allNotes = [...(ownedNotes || []), ...sharedNotes]

            // Step 2: Build set of all referenced storage paths across all visible notes
            const referencedPaths = new Set<string>()
            for (const n of allNotes) {
                if (n.content && typeof n.content === 'object') {
                    const urls = extractImageUrls(n.content as Record<string, unknown>)
                    for (const url of urls) {
                        const path = urlToPath(url)
                        if (path) referencedPaths.add(path)
                    }
                }
            }

            // Step 3: Build set of uploader prefixes we are authorized to clean.
            // We can clean: our own prefix + the owner prefix of each shared note
            // (since those notes may contain images uploaded by those owners that are
            // now deleted — e.g. User B deleted User A's image from a shared note).
            const authorizedPrefixes = new Set<string>([user.id])
            for (const n of sharedNotes) {
                if (n.owner_id) authorizedPrefixes.add(n.owner_id)
            }

            // Step 4: Scan each authorized prefix and delete unreferenced files
            for (const prefix of authorizedPrefixes) {
                const { data: storageFiles } = await supabase.storage
                    .from('note-images')
                    .list(prefix, { limit: 1000 })

                if (!storageFiles || storageFiles.length === 0) continue

                const orphanPaths: string[] = []
                for (const file of storageFiles) {
                    if (file.name === '.emptyFolderPlaceholder' || file.name.startsWith('.')) continue
                    const fullPath = `${prefix}/${file.name}`
                    if (!referencedPaths.has(fullPath)) {
                        orphanPaths.push(fullPath)
                    }
                }

                if (orphanPaths.length > 0) {
                    await supabase.storage
                        .from('note-images')
                        .remove(orphanPaths)
                }
            }
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}
