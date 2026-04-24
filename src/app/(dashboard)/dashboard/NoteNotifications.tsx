'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Toast {
    id: number
    message: string
    type: 'share' | 'remove'
}

let toastId = 0

export default function NoteNotifications() {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = useCallback((message: string, type: Toast['type']) => {
        const id = ++toastId
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }, [])

    useEffect(() => {
        const supabase = createClient()
        let channel: ReturnType<typeof supabase.channel> | null = null

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return

            channel = supabase
                .channel(`note-notifications-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'note_shares',
                        filter: `shared_with=eq.${user.id}`,
                    },
                    () => addToast('A note was shared with you', 'share')
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'note_shares',
                        filter: `shared_with=eq.${user.id}`,
                    },
                    () => addToast('A shared note was removed from your list', 'remove')
                )
                .subscribe()
        })

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [addToast])

    if (toasts.length === 0) return null

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-none" style={{ width: 'max-content', maxWidth: '360px' }}>
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className="inline-flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto"
                    style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--active-nav-border)',
                        boxShadow: '0 8px 24px var(--shadow-color), 0 0 0 1px var(--active-nav-border) inset',
                        animation: 'slideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                >
                    <span
                        className="flex items-center justify-center shrink-0 w-7 h-7 rounded-lg"
                        style={{
                            background: 'var(--active-nav-bg)',
                            color: 'var(--accent)',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                    </span>
                    <p className="text-sm font-medium" style={{ color: 'var(--heading-text)' }}>
                        {toast.message}
                    </p>
                    <button
                        onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                        className="ml-2 opacity-40 hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--muted-text)' }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
            ))}
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(24px) scale(0.95); }
                    to { opacity: 1; transform: translateX(0) scale(1); }
                }
            `}</style>
        </div>
    )
}
