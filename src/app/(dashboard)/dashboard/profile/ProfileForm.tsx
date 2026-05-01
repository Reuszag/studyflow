'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateProfile, deleteAvatar, changePassword } from './actions'

interface ProfileFormProps {
    profile: {
        id: string
        full_name: string | null
        avatar_url: string | null
        preferences: Record<string, unknown> | null
    }
    email: string
}

const PASSWORD_RULES = [
    { key: 'length', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { key: 'uppercase', label: 'One uppercase letter (A-Z)', test: (pw: string) => /[A-Z]/.test(pw) },
    { key: 'lowercase', label: 'One lowercase letter (a-z)', test: (pw: string) => /[a-z]/.test(pw) },
    { key: 'number', label: 'One number (0-9)', test: (pw: string) => /[0-9]/.test(pw) },
    { key: 'special', label: 'One special character (!@#$…)', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
]

function getStrengthMeta(score: number) {
    if (score <= 1) return { label: 'Very weak', color: '#ef4444', percent: 20 }
    if (score === 2) return { label: 'Weak', color: '#f97316', percent: 40 }
    if (score === 3) return { label: 'Fair', color: '#eab308', percent: 60 }
    if (score === 4) return { label: 'Strong', color: '#22c55e', percent: 80 }
    return { label: 'Very strong', color: '#16a34a', percent: 100 }
}

export default function ProfileForm({ profile, email }: ProfileFormProps) {
    const initialFullName = profile.full_name || ''
    const initialAvatarUrl = profile.avatar_url || ''

    const [fullName, setFullName] = useState(initialFullName)
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)

    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [showAvatarMenu, setShowAvatarMenu] = useState(false)
    const [showImagePreview, setShowImagePreview] = useState(false)

    const [showPasswordSection, setShowPasswordSection] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [showCurrentPw, setShowCurrentPw] = useState(false)
    const [showNewPw, setShowNewPw] = useState(false)
    const [showConfirmNewPw, setShowConfirmNewPw] = useState(false)
    const [pwSaving, setPwSaving] = useState(false)
    const [pwMessage, setPwMessage] = useState('')
    const [pwError, setPwError] = useState('')
    const [pwTouched, setPwTouched] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    const hasChanges = fullName !== initialFullName

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

    const ruleResults = useMemo(
        () => PASSWORD_RULES.map((r) => ({ ...r, pass: r.test(newPassword) })),
        [newPassword],
    )
    const passedCount = ruleResults.filter((r) => r.pass).length
    const allPassed = passedCount === PASSWORD_RULES.length
    const strength = getStrengthMeta(passedCount)
    const passwordsMatch = newPassword === confirmNewPassword

    async function handleChangePassword() {
        setPwMessage('')
        setPwError('')
        setPwTouched(true)
        if (!allPassed) { setPwError('New password does not meet all requirements.'); return }
        if (!passwordsMatch) { setPwError('New passwords do not match.'); return }
        if (currentPassword === newPassword) { setPwError('New password must be different from current password.'); return }
        setPwSaving(true)
        const result = await changePassword(currentPassword, newPassword)
        if (result.error) {
            setPwError(result.error)
        } else {
            setPwMessage('Password changed successfully!')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
            setShowPasswordSection(false)
            setPwTouched(false)
        }
        setPwSaving(false)
    }

    const EyeIcon = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
        <button
            type="button"
            onClick={onToggle}
            className="absolute inset-y-0 right-3 flex items-center transition-opacity opacity-50 hover:opacity-100"
            style={{ color: 'var(--label-text)' }}
            tabIndex={-1}
        >
            {show ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
        </button>
    )

    return (
        <>
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
                <div className="flex flex-col items-center gap-3">
                    <div
                        className={`w-24 h-24 rounded-full overflow-hidden border-2 transition ${
                            avatarUrl
                                ? 'border-violet-500/40 cursor-pointer hover:border-violet-400 hover:opacity-90'
                                : ''
                        } `}
                        style={!avatarUrl ? { background: 'var(--sidebar-toggle-bg)', borderColor: 'var(--card-border-hover)' } : undefined}
                        onClick={() => { if (avatarUrl) setShowImagePreview(true) }}
                        title={avatarUrl ? 'Click to view full image' : ''}
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--muted-text)' }}>
                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                </svg>
                            </div>
                        )}
                    </div>

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
                                    className="w-full text-left px-4 py-2 text-sm transition flex items-center gap-2"
                                    style={{ color: 'var(--text-secondary)' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                    Upload New Picture
                                </button>
                                {avatarUrl && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteAvatar}
                                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition flex items-center gap-2"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                        Remove Picture
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
                    <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>JPEG, PNG, WebP, or GIF. Max 2MB.</p>
                </div>

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

                {/* Change Password */}
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                    <button
                        type="button"
                        onClick={() => { setShowPasswordSection(v => !v); setPwError(''); setPwMessage(''); setPwTouched(false) }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors"
                        style={{ background: 'var(--overlay-soft)', color: 'var(--text-secondary)' }}
                    >
                        <span className="flex items-center gap-2">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                            Change Password
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-quaternary)', transform: showPasswordSection ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                    </button>

                    {showPasswordSection && (
                        <div className="px-4 pb-4 pt-3 space-y-3" style={{ background: 'var(--overlay-soft)' }}>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--label-text)' }}>Current Password</label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPw ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        required
                                        className="w-full rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                                        placeholder="Enter current password"
                                    />
                                    <EyeIcon show={showCurrentPw} onToggle={() => setShowCurrentPw(v => !v)} />
                                </div>
                            </div>

                            {/* New Password */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--label-text)' }}>New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPw ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => { setNewPassword(e.target.value); setPwTouched(true) }}
                                        required
                                        className="w-full rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                                        placeholder="Enter new password"
                                    />
                                    <EyeIcon show={showNewPw} onToggle={() => setShowNewPw(v => !v)} />
                                </div>
                                
                                {/* Strength meter */}
                                {newPassword.length > 0 && (
                                    <div className="mt-2">
                                        <div
                                            className="w-full h-1.5 rounded-full overflow-hidden"
                                            style={{ background: 'var(--input-border)' }}
                                        >
                                            <div
                                                className="h-full rounded-full transition-all duration-300"
                                                style={{ width: `${strength.percent}%`, backgroundColor: strength.color }}
                                            />
                                        </div>
                                        <p className="text-[10px] mt-1 font-medium" style={{ color: strength.color }}>
                                            {strength.label}
                                        </p>
                                    </div>
                                )}

                                {/* Rule checklist */}
                                {(newPassword.length > 0 || pwTouched) && (
                                    <ul className="mt-2 space-y-0.5">
                                        {ruleResults.map((r) => (
                                            <li
                                                key={r.key}
                                                className="flex items-center gap-1.5 text-[10px]"
                                                style={{
                                                    color: r.pass ? '#22c55e' : 'var(--muted-text)',
                                                }}
                                            >
                                                <span>{r.pass ? '✓' : '○'}</span>
                                                <span>{r.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Confirm New Password */}
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--label-text)' }}>Confirm New Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmNewPw ? 'text' : 'password'}
                                        value={confirmNewPassword}
                                        onChange={e => setConfirmNewPassword(e.target.value)}
                                        required
                                        className="w-full rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                                        style={{ background: 'var(--input-bg)', border: `1px solid ${confirmNewPassword.length > 0 && !passwordsMatch ? '#f87171' : 'var(--input-border)'}`, color: 'var(--input-text)' }}
                                        placeholder="Repeat new password"
                                    />
                                    <EyeIcon show={showConfirmNewPw} onToggle={() => setShowConfirmNewPw(v => !v)} />
                                </div>
                                {confirmNewPassword.length > 0 && !passwordsMatch && (
                                    <p className="text-red-400 text-[10px] mt-1">Passwords do not match</p>
                                )}
                            </div>

                            {pwError && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">{pwError}</p>}
                            {pwMessage && <p className="text-green-400 text-xs bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-lg">{pwMessage}</p>}

                            <button
                                type="button"
                                onClick={handleChangePassword}
                                disabled={pwSaving || !currentPassword || !allPassed || !passwordsMatch}
                                className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                {pwSaving ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    )}
                </div>

                {message && (
                    <p className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 px-4 py-2.5 rounded-xl">
                        {message}
                    </p>
                )}
                {error && (
                    <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">
                        {error}
                    </p>
                )}

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
                        className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200"
                        style={{ background: 'var(--overlay-soft)', color: 'var(--text-tertiary)', border: '1px solid var(--pill-border)' }}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </>
    )
}
