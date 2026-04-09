import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
                    const storagePath = withoutPrefix.split('?')[0]
                    node.attrs.src = publicPrefix + storagePath
                } else if (src.startsWith(proxyPrefix)) {
                    try {
                        const params = new URLSearchParams(src.slice(proxyPrefix.length))
                        const storagePath = params.get('path')
                        if (storagePath) {
                            node.attrs.src = publicPrefix + storagePath
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

// Convert image URL to storage path
function urlToPath(url: string): string | null {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'

    if (url.startsWith(publicPrefix)) {
        return decodeURIComponent(url.slice(publicPrefix.length).split('?')[0])
    } else if (url.startsWith(proxyPrefix)) {
        try {
            const params = new URLSearchParams(url.slice(proxyPrefix.length))
            return params.get('path')
        } catch { /* skip */ }
    }
    return null
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { noteId, title, content, cleanup } = body

        if (!noteId || !title) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        // Normalize signed URLs back to public URLs before persisting
        const normalizedContent = content ? normalizeImageUrls(content) : content

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
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // After saving, clean up orphaned images if requested
        if (cleanup) {
            // Fetch ALL notes owned by this user to collect every referenced image
            const { data: ownedNotes } = await supabase
                .from('notes')
                .select('content')
                .eq('owner_id', user.id)

            // Also fetch notes shared WITH this user — they may contain images
            // uploaded by this user under their own storage path
            const { data: sharedEntries } = await supabase
                .from('note_shares')
                .select('note_id')
                .eq('shared_with', user.id)

            const sharedNoteIds = (sharedEntries || []).map(s => s.note_id)
            let sharedNotes: { content: unknown }[] = []
            if (sharedNoteIds.length > 0) {
                const { data } = await supabase
                    .from('notes')
                    .select('content')
                    .in('id', sharedNoteIds)
                sharedNotes = data || []
            }

            const allNotes = [...(ownedNotes || []), ...sharedNotes]

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

            // List all files in storage under this user's prefix
            const { data: storageFiles } = await supabase.storage
                .from('note-images')
                .list(user.id, { limit: 1000 })

            if (storageFiles && storageFiles.length > 0) {
                const orphanPaths: string[] = []
                for (const file of storageFiles) {
                    // Skip Supabase placeholder files and metadata
                    if (file.name === '.emptyFolderPlaceholder' || file.name.startsWith('.')) continue
                    const fullPath = `${user.id}/${file.name}`
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
