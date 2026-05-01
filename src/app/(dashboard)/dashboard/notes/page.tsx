import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NoteList from './NoteList'

export default async function NotesPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: ownedNotes } = await supabase
        .from('notes')
        .select('id, title, updated_at, created_at, owner_id')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })

    const { data: sharedEntries } = await supabase
        .from('note_shares')
        .select('permission, notes(id, title, updated_at, created_at, owner_id)')
        .eq('shared_with', user.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharedNotes = (sharedEntries || [])
        .map((entry: any) => {
            const note = entry.notes
            if (!note) return null
            return { ...note, shared: true, permission: entry.permission }
        })
        .filter(Boolean)

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto h-full flex flex-col w-full">
            <div className="mb-8 flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-3xl font-bold mb-1" style={{ color: 'var(--heading-text)' }}>Notes</h2>
                    <p style={{ color: 'var(--muted-text)' }}>Create and collaborate on rich text notes</p>
                </div>
            </div>

            <NoteList
                ownedNotes={(ownedNotes || []) as any}
                sharedNotes={sharedNotes as any}
            />
        </div>
    )
}
