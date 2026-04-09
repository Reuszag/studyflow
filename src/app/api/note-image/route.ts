import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    const noteId = searchParams.get('noteId')

    if (!path || !noteId) {
        return NextResponse.json({ error: 'Missing path or noteId' }, { status: 400 })
    }

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
                        // Ignored in read-only context
                    }
                },
            },
        }
    )

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Verify user has access to this note (owner or shared)
    const { data: note } = await supabase
        .from('notes')
        .select('id')
        .eq('id', noteId)
        .single()

    if (!note) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Download the image from storage using a signed URL
    // Use createSignedUrl which works server-side regardless of who owns the file
    // because the server can generate signed URLs for any path
    const { data: signedData, error: signedError } = await supabase.storage
        .from('note-images')
        .createSignedUrl(path, 60)

    if (signedError || !signedData?.signedUrl) {
        // Fallback: try downloading directly
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('note-images')
            .download(path)

        if (downloadError || !fileData) {
            return NextResponse.json({ error: 'Image not found' }, { status: 404 })
        }

        const arrayBuffer = await fileData.arrayBuffer()
        const contentType = path.endsWith('.png') ? 'image/png'
            : path.endsWith('.gif') ? 'image/gif'
            : path.endsWith('.webp') ? 'image/webp'
            : 'image/jpeg'

        return new NextResponse(arrayBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600, immutable',
            },
        })
    }

    // Fetch the image via the signed URL and proxy it
    const imageResponse = await fetch(signedData.signedUrl)
    if (!imageResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
    }

    const arrayBuffer = await imageResponse.arrayBuffer()
    const contentType = imageResponse.headers.get('content-type') || 'image/png'

    return new NextResponse(arrayBuffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600, immutable',
        },
    })
}
