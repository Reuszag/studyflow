import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        const noteId = formData.get('noteId') as string | null
        const ownerId = formData.get('ownerId') as string | null

        if (!file || !noteId || !ownerId) {
            return NextResponse.json({ error: 'Missing file, noteId, or ownerId' }, { status: 400 })
        }

        if (!file.type.startsWith('image/')) {
            return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const { data: noteRow } = await supabase
            .from('notes')
            .select('owner_id')
            .eq('id', noteId)
            .single()

        if (!noteRow) {
            return NextResponse.json({ error: 'Note not found' }, { status: 404 })
        }

        if (noteRow.owner_id !== ownerId) {
            return NextResponse.json({ error: 'Owner ID mismatch' }, { status: 400 })
        }

        const isOwner = noteRow.owner_id === user.id
        if (!isOwner) {
            const { data: share } = await supabase
                .from('note_shares')
                .select('permission')
                .eq('note_id', noteId)
                .eq('shared_with', user.id)
                .single()

            if (!share || share.permission !== 'edit') {
                return NextResponse.json({ error: 'Edit permission required' }, { status: 403 })
            }
        }

        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${ownerId}/${timestamp}_${safeName}`

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const { error: uploadError } = await supabase.storage
            .from('note-images')
            .upload(filePath, buffer, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type,
            })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
        }

        const proxyUrl = `/api/note-image?path=${encodeURIComponent(filePath)}&noteId=${noteId}`
        return NextResponse.json({ url: proxyUrl })
    } catch (err) {
        console.error('Upload route error:', err)
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
}
