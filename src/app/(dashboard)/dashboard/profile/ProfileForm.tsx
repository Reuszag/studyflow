'use client'

import { useState, useRef, useEffect } from 'react'
import { updateProfile, uploadAvatar, deleteAvatar } from './actions'

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
    // Current values (what's saved)
    const initialFullName = profile.full_name || ''
    const initialTimezone = profile.timezone || 'UTC'
    const initialAvatarUrl = profile.avatar_url || ''

    // Form state
    const [fullName, setFullName] = useState(initialFullName)
    const [timezone, setTimezone] = useState(initialTimezone)
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)

    // UI state
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [showAvatarMenu, setShowAvatarMenu] = useState(false)
    const [showImagePreview, setShowImagePreview] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    // Track if there are unsaved changes
    const hasChanges = fullName !== initialFullName || timezone !== initialTimezone

    // Close avatar menu when clicking outside
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

        const formData = new FormData()
        formData.set('avatar', file)

        const result = await uploadAvatar(formData)

        if (result.error) {
            setError(result.error)
        } else if (result.avatarUrl) {
            setAvatarUrl(result.avatarUrl)
            setMessage('Avatar updated successfully!')
        }

        setUploading(false)
        // Reset file input so the same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    async function handleDeleteAvatar() {
        setDeleting(true)
        setShowAvatarMenu(false)
        setMessage('')
        setError('')

        const result = await deleteAvatar()

        if (result.error) {
            setError(result.error)
        } else {
            setAvatarUrl('')
            setMessage('Profile picture removed.')
        }

        setDeleting(false)
    }

    return (
        <>
            {/* Image Preview Modal */}
            {showImagePreview && avatarUrl && (
                <div
                    className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center cursor-pointer"
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
                            className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 transition"
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
                        className={`w-24 h-24 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-300 transition ${avatarUrl ? 'cursor-pointer hover:border-blue-500 hover:opacity-90' : ''
                            }`}
                        onClick={() => {
                            if (avatarUrl) setShowImagePreview(true)
                        }}
                        title={avatarUrl ? 'Click to view full image' : ''}
                    >
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Profile avatar"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400">
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
                            className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                        >
                            {uploading ? 'Uploading...' : deleting ? 'Removing...' : 'Change Profile Picture'}
                        </button>

                        {showAvatarMenu && (
                            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 w-52">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAvatarMenu(false)
                                        fileInputRef.current?.click()
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                                >
                                    📷 Upload New Picture
                                </button>
                                {avatarUrl && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAvatar}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
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
                    <p className="text-xs text-gray-400">
                        JPEG, PNG, WebP, or GIF. Max 2MB.
                    </p>
                </div>

                {/* Email (read-only) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                    </label>
                    <input
                        type="email"
                        value={email}
                        disabled
                        className="w-full border border-gray-200 rounded-lg px-4 py-2 text-gray-500 bg-gray-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Email cannot be changed here.
                    </p>
                </div>

                {/* Full Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                    </label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter your full name"
                    />
                </div>

                {/* Timezone */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Timezone
                    </label>
                    <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        {TIMEZONES.map((tz) => (
                            <option key={tz} value={tz}>
                                {tz.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Messages */}
                {message && (
                    <p className="text-green-600 text-sm bg-green-50 px-4 py-2 rounded-lg">
                        ✅ {message}
                    </p>
                )}
                {error && (
                    <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
                        ❌ {error}
                    </p>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        type="submit"
                        disabled={!hasChanges || saving}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 bg-white text-gray-700 py-2 rounded-lg font-semibold border border-gray-300 hover:bg-gray-50 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </>
    )
}
