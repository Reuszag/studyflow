'use client'

import { useState, useEffect } from 'react'
import { shareNote, removeShare, getNoteShares, updateSharePermission } from '../actions'
import { createClient } from '@/lib/supabase/client'

interface Share {
    id: string
    permission: string
    shared_with: string
    profiles: { email: string | null; full_name: string | null } | null
}

export default function ShareDialog({ noteId, onClose, onPermissionChanged }: {
    noteId: string
    onClose: () => void
    onPermissionChanged?: (change: { targetUserId: string; targetEmail: string | null; newPermission: 'view' | 'edit' }) => void
}) {
    const [email, setEmail] = useState('')
    const [permission, setPermission] = useState<'view' | 'edit'>('edit')
    const [shares, setShares] = useState<Share[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [removeSuccess, setRemoveSuccess] = useState('')

    async function loadShares() {
        const result = await getNoteShares(noteId)
        if (result.shares) {
            setShares(result.shares as unknown as Share[])
        }
    }

    useEffect(() => {
        loadShares()
    }, [])

    async function handleShare(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)

        const result = await shareNote(noteId, email, permission)

        if (result.error) {
            setError(result.error)
        } else {
            setSuccess(`Note shared with ${email}`)
            setEmail('')
            loadShares()
        }
        setLoading(false)
    }

    async function handleRemoveShare(shareId: string, userEmail: string) {
        await removeShare(shareId, noteId)
        setShares((prev) => prev.filter((s) => s.id !== shareId))
        setRemoveSuccess(`Access removed for ${userEmail}`)
    }

    async function handlePermissionChange(shareId: string, newPermission: 'view' | 'edit') {
        setUpdatingId(shareId)
        setError('')
        try {
            const result = await updateSharePermission(shareId, newPermission, noteId)
            if (result.error) {
                setError(result.error)
                return
            }
            setShares((prev) =>
                prev.map((s) => s.id === shareId ? { ...s, permission: newPermission } : s)
            )
            const targetShare = shares.find(s => s.id === shareId)
            if (!targetShare) return

            onPermissionChanged?.({
                targetUserId: targetShare.shared_with,
                targetEmail: targetShare.profiles?.email || null,
                newPermission,
            })

            // Fire-and-forget broadcast.
            // Reuse the existing NoteEditor channel for `note-permission-{noteId}` if it
            // already exists in this tab — owner's NoteEditor subscribed to it on mount.
            // Don't removeChannel afterward (would kill the listener and break subsequent
            // permission updates from this dialog).
            ;(async () => {
                const supabase = createClient()
                const topic = `note-permission-${noteId}`
                const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}` || c.topic === topic)
                let ch = existing
                let createdLocally = false
                if (!ch) {
                    createdLocally = true
                    ch = supabase.channel(topic, { config: { broadcast: { self: false, ack: false } } })
                    let resolved = false
                    await Promise.race([
                        new Promise<void>((resolve) => {
                            ch!.subscribe((status) => {
                                if (status === 'SUBSCRIBED' && !resolved) {
                                    resolved = true
                                    resolve()
                                }
                            })
                        }),
                        new Promise<void>((resolve) => setTimeout(() => { resolved = true; resolve() }, 1500)),
                    ])
                }
                try {
                    await ch.send({
                        type: 'broadcast',
                        event: 'permission-changed',
                        payload: {
                            targetUserId: targetShare.shared_with,
                            targetEmail: targetShare.profiles?.email || null,
                            newPermission,
                        },
                    })
                } catch { /* swallow */ }
                if (createdLocally) supabase.removeChannel(ch)
            })()
        } finally {
            setUpdatingId(null)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div
                className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-lg" style={{ color: 'var(--heading-text)' }}>Share Note</h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--overlay-medium)] transition-colors cursor-pointer"
                        style={{ color: 'var(--muted-text)' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {/* Share form */}
                <form onSubmit={handleShare} className="space-y-3 mb-6">
                    <div className="flex gap-2">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="Enter email address"
                            className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            style={{
                                background: 'var(--input-bg)',
                                border: '1px solid var(--input-border)',
                                color: 'var(--input-text)',
                            }}
                        />
                        <select
                            value={permission}
                            onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
                            className="rounded-lg px-2 py-2 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
                            style={{
                                background: 'var(--input-bg)',
                                border: '1px solid var(--input-border)',
                                color: 'var(--input-text)',
                            }}
                        >
                            <option value="edit">Can edit</option>
                            <option value="view">View only</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full py-2 rounded-lg font-medium text-sm text-white disabled:opacity-50 cursor-pointer transition-colors"
                        style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}
                    >
                        {loading ? 'Sharing...' : 'Share'}
                    </button>

                    {error && <p className="text-red-400 text-sm">{error}</p>}
                    {success && <p className="text-green-400 text-sm">{success}</p>}
                    {removeSuccess && <p className="text-orange-400 text-sm">{removeSuccess}</p>}
                </form>

                {/* Current shares */}
                {shares.length > 0 && (
                    <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted-text)' }}>
                            People with access
                        </h4>
                        <div className="space-y-2">
                            {shares.map((share) => (
                                <div
                                    key={share.id}
                                    className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                                    style={{ background: 'var(--input-bg)' }}
                                >
                                    <div className="min-w-0 flex-1 mr-3">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--body-text)' }}>
                                            {share.profiles?.email || 'Unknown user'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Permission toggle */}
                                        <select
                                            value={share.permission}
                                            onChange={(e) => handlePermissionChange(share.id, e.target.value as 'view' | 'edit')}
                                            disabled={updatingId === share.id}
                                            className="rounded-md px-1.5 py-1 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
                                            style={{
                                                background: 'var(--card-bg)',
                                                border: '1px solid var(--card-border)',
                                                color: share.permission === 'edit' ? '#a78bfa' : '#fbbf24',
                                            }}
                                        >
                                            <option value="edit">Can edit</option>
                                            <option value="view">View only</option>
                                        </select>
                                        {/* Revoke access button */}
                                        <button
                                            onClick={() => handleRemoveShare(share.id, share.profiles?.email || 'Unknown user')}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors cursor-pointer"
                                            style={{ color: 'var(--muted-text)' }}
                                            title="Revoke access"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
