import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function normalizeStoragePath(rawPath: string): string {
    let path = rawPath

    // Handle accidental full-URL values by extracting the object path segment.
    if (path.startsWith('http://') || path.startsWith('https://')) {
        try {
            const url = new URL(path)
            const marker = '/storage/v1/object/public/note-images/'
            const idx = url.pathname.indexOf(marker)
            if (idx >= 0) {
                path = url.pathname.slice(idx + marker.length)
            }
        } catch {
        }
    }

    for (let i = 0; i < 3; i++) {
        try {
            const decoded = decodeURIComponent(path)
            if (decoded === path) break
            path = decoded
        } catch {
            break
        }
    }

    path = path.replace(/^\/+/, '').replace(/\\/g, '/')
    if (path.startsWith('note-images/')) {
        path = path.slice('note-images/'.length)
    }

    return path
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const rawPath = searchParams.get('path')
    const noteId = searchParams.get('noteId')

    if (!rawPath || !noteId) {
        return NextResponse.json({ error: 'Missing path or noteId' }, { status: 400 })
    }

    const path = normalizeStoragePath(rawPath)

    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                    }
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify user has access to this note (owner or shared).
    // RLS on the notes table enforces: owner OR shared_with.
    const { data: note } = await supabase
        .from('notes')
        .select('id')
        .eq('id', noteId)
        .single()

    if (!note) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const contentTypeFromPath = path.endsWith('.png') ? 'image/png'
        : path.endsWith('.gif') ? 'image/gif'
        : path.endsWith('.webp') ? 'image/webp'
        : path.endsWith('.svg') ? 'image/svg+xml'
        : 'image/jpeg'

    // Primary path: fetch via the public bucket endpoint server-side.
    // Note-level access is already verified above. Using the public CDN endpoint
    // bypasses storage.objects RLS — which otherwise blocks user A from reading
    // user B's uploaded files under their own path prefix (e.g. the note owner
    // reading images uploaded by a shared editor, or vice versa after a handoff).
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/note-images/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`

    const publicResponse = await fetch(publicUrl)
    if (publicResponse.ok) {
        const arrayBuffer = await publicResponse.arrayBuffer()
        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': publicResponse.headers.get('content-type') || contentTypeFromPath,
                'Cache-Control': 'public, max-age=3600, immutable',
            },
        })
    }

    // Fallback: signed URL (works if storage RLS permits the caller) then direct download.
    const { data: signedData } = await supabase.storage
        .from('note-images')
        .createSignedUrl(path, 60)

    if (signedData?.signedUrl) {
        const imageResponse = await fetch(signedData.signedUrl)
        if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer()
            return new NextResponse(arrayBuffer, {
                headers: {
                    'Content-Type': imageResponse.headers.get('content-type') || contentTypeFromPath,
                    'Cache-Control': 'public, max-age=3600, immutable',
                },
            })
        }
    }

    const { data: fileData } = await supabase.storage
        .from('note-images')
        .download(path)

    if (fileData) {
        const arrayBuffer = await fileData.arrayBuffer()
        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': contentTypeFromPath,
                'Cache-Control': 'public, max-age=3600, immutable',
            },
        })
    }

    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
}
