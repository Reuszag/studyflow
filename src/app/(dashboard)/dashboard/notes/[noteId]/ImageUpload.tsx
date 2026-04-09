'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ImageUploadProps {
    onInsert: (url: string) => void
    onClose: () => void
}

export default function ImageUpload({ onInsert, onClose }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            setError('Please select an image file')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be under 5MB')
            return
        }

        setUploading(true)
        setError('')

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setError('You must be logged in')
                setUploading(false)
                return
            }

            const timestamp = Date.now()
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const filePath = `${user.id}/${timestamp}_${safeName}`

            const { error: uploadError } = await supabase.storage
                .from('note-images')
                .upload(filePath, file, { cacheControl: '3600', upsert: false })

            if (uploadError) {
                console.error('Upload error:', uploadError)
                setError('Failed to upload image')
                setUploading(false)
                return
            }

            const { data: urlData } = supabase.storage
                .from('note-images')
                .getPublicUrl(filePath)

            onInsert(urlData.publicUrl)
        } catch {
            setError('An unexpected error occurred')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div
                className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg" style={{ color: 'var(--heading-text)' }}>Insert Image</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--overlay-medium)] transition-colors cursor-pointer"
                        style={{ color: 'var(--muted-text)' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div
                    className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors hover:border-violet-500/40"
                    style={{ borderColor: 'var(--card-border)' }}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <div className="text-3xl mb-2">{uploading ? '...' : '🖼️'}</div>
                    <p className="text-sm font-medium" style={{ color: 'var(--body-text)' }}>
                        {uploading ? 'Uploading...' : 'Click to select an image'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-text)' }}>PNG, JPG, GIF, WebP — max 5MB</p>
                </div>

                {error && (
                    <p className="text-red-400 text-sm mt-3">{error}</p>
                )}
            </div>
        </div>
    )
}
