'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateProfile, deleteAvatar } from './actions'

const TIMEZONES = [
    'UTC',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Europe/Istanbul',
    'Europe/Moscow',
    'Asia/Baku',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Australia/Sydney',
]

interface ProfileFormProps {
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
        timezone: string | null
        preferences: Record<string, unknown> | null
    }
    email: string
}

export default function ProfileForm({ profile, email }: ProfileFormProps) {
    const initialFullName = profile.full_name || ''
    const initialTimezone = profile.timezone || 'UTC'
    const initialAvatarUrl = profile.avatar_url || ''

    const [fullName, setFullName] = useState(initialFullName)
    const [timezone, setTimezone] = useState(initialTimezone)
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)

    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [showAvatarMenu, setShowAvatarMenu] = useState(false)
    const [showImagePreview, setShowImagePreview] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    const hasChanges = fullName !== initialFullName || timezone !== initialTimezone

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowAvatarMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage('')
        setError('')
        const formData = new FormData()
        formData.set('full_name', fullName)
        formData.set('timezone', timezone)
        const result = await updateProfile(formData)
        if (result.error) {
            setError(result.error)
        } else {
            setMessage('Profile updated successfully!')
            router.refresh()
        }
        setSaving(false)
    }

    function handleCancel() {
        setFullName(initialFullName)
        setTimezone(initialTimezone)
        setMessage('')
        setError('')
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        setShowAvatarMenu(false)
        setMessage('')
        setError('')
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            
            if (!user) {
                setError('You must be logged in to upload an avatar.')
                setUploading(false)
                return
            }

            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            if (!allowedTypes.includes(file.type)) {
                setError('Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.')
                setUploading(false)
                return
            }

            if (file.size > 2 * 1024 * 1024) {
                setError('File too large. Maximum size is 2MB.')
                setUploading(false)
                return
            }

            const fileExtension = file.name.split('.').pop()
            const filePath = `${user.id}/avatar.${fileExtension}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true
                })

            if (uploadError) {
                console.error("Avatar Upload Error:", uploadError)
                setError('Failed to upload image.')
            } else {
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
                
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({
                        avatar_url: urlData.publicUrl,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', user.id)

                if (updateError) {
                    setError('Image uploaded but failed to update profile record.')
                } else {
                    setAvatarUrl(urlData.publicUrl)
                    setMessage('Avatar updated successfully!')
                    router.refresh()
                }
            }
        } catch (err) {
            console.error("Avatar exception:", err)
            setError('An unexpected error occurred.')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    async function handleDeleteAvatar() {
        setDeleting(true)
        setShowAvatarMenu(false)
        setMessage('')
        setError('')
        const result = await deleteAvatar()
        if (result.error) setError(result.error)
        else {
            setAvatarUrl('')
            setMessage('Profile picture removed.')
            router.refresh()
        }
        setDeleting(false)
    }

    return (
        <>
            {/* Image Preview Modal */}
            {showImagePreview && avatarUrl && (
                <div
                    className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center cursor-pointer backdrop-blur-sm"
                    onClick={() => setShowImagePreview(false)}
                >
                    <div className="relative max-w-md max-h-[80vh]">
                        <img
                            src={avatarUrl}
                            alt="Profile avatar preview"
                            className="rounded-2xl max-w-full max-h-[80vh] object-contain shadow-2xl"
                        />
                        <button
                            onClick={() => setShowImagePreview(false)}
                            className="absolute -top-3 -right-3 w-8 h-8 rounded-full shadow-lg flex items-center justify-center transition"
                            style={{ background: 'var(--sidebar-toggle-bg)', border: '1px solid var(--card-border-hover)', color: 'var(--muted-text)' }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-3">
                    <div
                        className={`w-24 h-24 rounded-full overflow-hidden border-2 transition ${
                            avatarUrl
                                ? 'border-violet-500/40 cursor-pointer hover:border-violet-400 hover:opacity-90'
                                : 'border-white/10'
                        } `}
                        style={!avatarUrl ? { background: 'var(--sidebar-toggle-bg)' } : undefined}
                        onClick={() => { if (avatarUrl) setShowImagePreview(true) }}
                        title={avatarUrl ? 'Click to view full image' : ''}
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">
                                👤
                            </div>
                        )}
                    </div>

                    {/* Avatar actions dropdown */}
                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                            disabled={uploading || deleting}
                            className="text-sm text-violet-400 hover:text-violet-300 disabled:opacity-50 transition"
                        >
                            {uploading ? 'Uploading...' : deleting ? 'Removing...' : 'Change Profile Picture'}
                        </button>

                        {showAvatarMenu && (
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 rounded-xl shadow-xl py-1 z-10 w-52" style={{ background: 'var(--dropdown-bg)', border: '1px solid var(--dropdown-border)' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAvatarMenu(false)
                                        fileInputRef.current?.click()
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition"
                                >
                                    📷 Upload New Picture
                                </button>
                                {avatarUrl && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAvatar}
                                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition"
                                    >
                                        🗑️ Remove Picture
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleAvatarUpload}
                        className="hidden"
                    />
                    <p className="text-xs text-gray-600">JPEG, PNG, WebP, or GIF. Max 2MB.</p>
                </div>

                {/* Email (read-only) */}
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--label-text)' }}>Email</label>
                    <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full rounded-xl px-4 py-2.5 cursor-not-allowed text-sm"
                        style={{ background: 'var(--hover-overlay)', border: '1px solid var(--card-border)', color: 'var(--muted-text)' }}
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--muted-text)' }}>Email cannot be changed here.</p>
                </div>

                {/* Full Name */}
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--label-text)' }}>Full Name</label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 text-sm transition"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                        placeholder="Enter your full name"
                    />
                </div>

                {/* Timezone */}
                <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--label-text)' }}>Timezone</label>
                    <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 text-sm transition"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                    >
                        {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz} style={{ background: 'var(--card-bg-alt)' }}>
                                {tz.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Messages */}
                {message && (
                    <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 px-4 py-2.5 rounded-xl">
                        ✅ {message}
                    </p>
                )}
                {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
                        ❌ {error}
                    </p>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={!hasChanges || saving}
                        className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                    >
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 bg-white/5 text-gray-400 py-2.5 rounded-xl font-semibold text-sm border border-white/10 hover:bg-white/10 hover:text-gray-200 transition-all duration-200"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </>
    )
}
