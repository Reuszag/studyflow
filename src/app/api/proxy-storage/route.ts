import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
        return new NextResponse('Missing file path', { status: 400 })
    }

    // Download the file from Supabase Storage
    const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath)

    if (error || !data) {
        console.error('Proxy storage error:', error)
        return new NextResponse('File not found or access denied', { status: 404 })
    }

    // Stream the file back to the client
    const buffer = await data.arrayBuffer()
    return new NextResponse(buffer, {
        headers: {
            'Content-Type': data.type || 'application/octet-stream',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
