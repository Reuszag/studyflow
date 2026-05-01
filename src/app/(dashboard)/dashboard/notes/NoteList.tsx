'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createNote, deleteNote, leaveSharedNote } from './actions'
import { useNotification } from '@/lib/NotificationContext'

interface NoteItem {
    id: string
    title: string
    updated_at: string
    created_at: string
    owner_id: string
    shared?: boolean
    permission?: string
    profiles?: { full_name: string | null } | null
}

export default function NoteList({ ownedNotes: initialOwned, sharedNotes: initialShared }: { ownedNotes: NoteItem[]; sharedNotes: NoteItem[] }) {
    const router = useRouter()
    const { showNotification, confirm } = useNotification()
    const [ownedNotes, setOwnedNotes] = useState<NoteItem[]>(initialOwned)
    const [sharedNotes, setSharedNotes] = useState<NoteItem[]>(initialShared)
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchNotes = useCallback(async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: owned }, { data: sharedEntries }] = await Promise.all([
            supabase
                .from('notes')
                .select('id, title, updated_at, created_at, owner_id')
                .eq('owner_id', user.id)
                .order('updated_at', { ascending: false }),
            supabase
                .from('note_shares')
                .select('permission, notes(id, title, updated_at, created_at, owner_id)')
                .eq('shared_with', user.id),
        ])

        setOwnedNotes(owned || [])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shared = ((sharedEntries || []) as any[])
            .map((entry) => {
                const note = entry.notes
                if (!note) return null
                return { ...note, shared: true, permission: entry.permission }
            })
            .filter(Boolean) as NoteItem[]

        setSharedNotes(shared)
    }, [])

    useEffect(() => {
        const supabase = createClient()
        let sharesChannel: ReturnType<typeof supabase.channel> | null = null
        let notesChannel: ReturnType<typeof supabase.channel> | null = null

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return

            sharesChannel = supabase
                .channel(`note-shares-list-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'note_shares',
                        filter: `shared_with=eq.${user.id}`,
                    },
                    () => fetchNotes()
                )
                .subscribe()

            notesChannel = supabase
                .channel(`notes-list-${user.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'notes' },
                    () => fetchNotes()
                )
                .subscribe()
        })

        return () => {
            if (sharesChannel) supabase.removeChannel(sharesChannel)
            if (notesChannel) supabase.removeChannel(notesChannel)
        }
    }, [fetchNotes])

    async function handleCreate() {
        setCreating(true)
        setError(null)
        try {
            const result = await createNote()
            if (result.error) {
                showNotification(result.error, 'error')
                setCreating(false)
                return
            }
            if (result.id) {
                router.push(`/dashboard/notes/${result.id}`)
            }
        } catch (err) {
            showNotification(err instanceof Error ? err.message : 'Failed to create note', 'error')
        }
        setCreating(false)
    }

    async function handleDelete(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        const confirmed = await confirm('Delete this note? This cannot be undone.')
        if (!confirmed) return
        await deleteNote(id)
        await fetchNotes()
    }

    async function handleLeave(id: string, e: React.MouseEvent) {
        e.stopPropagation()
        const confirmed = await confirm('Remove this shared note from your list?')
        if (!confirmed) return
        await leaveSharedNote(id)
        await fetchNotes()
    }

    function formatDate(dateStr: string) {
        const d = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - d.getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Just now'
        if (mins < 60) return `${mins}m ago`
        const hours = Math.floor(mins / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        if (days < 7) return `${days}d ago`
        return d.toLocaleDateString()
    }

    function NoteCard({ note, isOwned }: { note: NoteItem; isOwned: boolean }) {
        return (
            <div
                onClick={() => router.push(`/dashboard/notes/${note.id}`)}
                className="group relative rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-violet-900/10"
                style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                }}
            >
                {!isOwned && (
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ background: 'var(--active-nav-bg)', color: 'var(--active-nav-text)', borderColor: 'var(--active-nav-border)' }}>
                            Shared {note.permission === 'view' ? '(view)' : ''}
                        </span>
                        <button
                            onClick={(e) => handleLeave(note.id, e)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 hover:text-white"
                            style={{ color: 'var(--muted-text)', background: 'var(--overlay-soft)' }}
                            title="Leave shared note"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    </div>
                )}

                {isOwned && (
                    <button
                        onClick={(e) => handleDelete(note.id, e)}
                        className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 hover:text-white"
                        style={{ color: 'var(--muted-text)', background: 'var(--overlay-soft)' }}
                        title="Delete note"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                    </button>
                )}

                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-violet-500/10 border border-violet-500/20" style={{ color: 'var(--accent)' }}>
                    {isOwned ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                    ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                    )}
                </div>

                <h3 className="font-semibold truncate mb-1" style={{ color: 'var(--heading-text)' }}>
                    {note.title || 'Untitled'}
                </h3>

                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-text)' }}>
                    <span>{formatDate(note.updated_at)}</span>
                    {note.profiles?.full_name && (
                        <>
                            <span className="w-1 h-1 rounded-full" style={{ background: 'var(--muted-text)' }} />
                            <span>{note.profiles.full_name}</span>
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full rounded-2xl p-5 border-2 border-dashed transition-all duration-200 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-900/10 disabled:opacity-50 cursor-pointer"
                style={{
                    borderColor: 'var(--dashed-border)',
                    color: 'var(--text-secondary)',
                }}
            >
                <div className="flex items-center justify-center gap-3">
                    <span className="text-2xl">+</span>
                    <span className="font-medium">{creating ? 'Creating...' : 'New Note'}</span>
                </div>
            </button>

            {error && (
                <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    {error}
                </p>
            )}

            {ownedNotes.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted-text)' }}>
                        My Notes ({ownedNotes.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ownedNotes.map((note) => (
                            <NoteCard key={note.id} note={note} isOwned />
                        ))}
                    </div>
                </div>
            )}

            {sharedNotes.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--muted-text)' }}>
                        Shared with me ({sharedNotes.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sharedNotes.map((note) => (
                            <NoteCard key={note.id} note={note} isOwned={false} />
                        ))}
                    </div>
                </div>
            )}

            {ownedNotes.length === 0 && sharedNotes.length === 0 && (
                <div className="text-center py-20 rounded-2xl border border-dashed" style={{ borderColor: 'var(--card-border)' }}>
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--overlay-soft)', color: 'var(--muted-text)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium" style={{ color: 'var(--body-text)' }}>No notes yet</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted-text)' }}>Create your first note to get started</p>
                </div>
            )}
        </div>
    )
}
