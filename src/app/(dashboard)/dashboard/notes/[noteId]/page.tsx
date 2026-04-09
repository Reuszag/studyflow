import { redirect } from 'next/navigation'
import { getNote } from '../actions'
import NoteEditor from './NoteEditor'

export default async function NoteEditorPage({ params }: { params: Promise<{ noteId: string }> }) {
    const { noteId } = await params

    const result = await getNote(noteId)

    if (result.error || !result.note) {
        redirect('/dashboard/notes')
    }

    return (
        <div className="h-full flex flex-col">
            <NoteEditor
                note={result.note}
                canEdit={result.canEdit ?? false}
                currentUserId={result.currentUserId ?? ''}
            />
        </div>
    )
}
