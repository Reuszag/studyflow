'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotification } from '@/lib/NotificationContext'

export default function NoteNotifications() {
    const { showNotification } = useNotification()

    const addNotification = useCallback((message: string) => {
        showNotification(message, 'info')
    }, [showNotification])

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
                    () => addNotification('A note was shared with you')
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'DELETE',
                        schema: 'public',
                        table: 'note_shares',
                        filter: `shared_with=eq.${user.id}`,
                    },
                    () => addNotification('A shared note was removed from your list')
                )
                .subscribe()
        })

        return () => {
            if (channel) supabase.removeChannel(channel)
        }
    }, [addNotification])

    return null
}
