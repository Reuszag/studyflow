'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { ResizableImage } from './ResizableImageExtension'
import { CodeBlockWithDelete } from './CodeBlockExtension'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/react'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (size: string) => ReturnType
            unsetFontSize: () => ReturnType
        }
        image: {
            setImage: (options: { src: string; alt?: string; title?: string; width?: number }) => ReturnType
        }
    }
}

const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() {
        return { types: ['textStyle'] }
    },
    addGlobalAttributes() {
        return [{
            types: this.options.types,
            attributes: {
                fontSize: {
                    default: null,
                    parseHTML: (element: HTMLElement) => element.style.fontSize || null,
                    renderHTML: (attributes: Record<string, string | null>) => {
                        if (!attributes.fontSize) return {}
                        return { style: `font-size: ${attributes.fontSize}` }
                    },
                },
            },
        }]
    },
    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }) => {
                return chain().setMark('textStyle', { fontSize }).run()
            },
            unsetFontSize: () => ({ chain }) => {
                return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
            },
        }
    },
})
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { createClient } from '@/lib/supabase/client'
import { updateNote, checkDuplicateTitle } from '../actions'
import Toolbar from './Toolbar'
import ImageUpload from './ImageUpload'
import ShareDialog from './ShareDialog'
import DrawingCanvas from './DrawingCanvas'
import { getMultiSelectedSrcs, clearImageMultiSelect } from './ResizableImageExtension'

interface NoteEditorProps {
    note: {
        id: string
        title: string
        content: Record<string, unknown>
        owner_id: string
        updated_at: string
        updated_by: string | null
        profiles?: { full_name: string | null; email: string | null } | null
    }
    canEdit: boolean
    currentUserId: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function NoteEditor({ note, canEdit, currentUserId }: NoteEditorProps) {
    const router = useRouter()
    const [title, setTitle] = useState(note.title)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
    const [concurrentUsers, setConcurrentUsers] = useState<string[]>([])
    const [showShareDialog, setShowShareDialog] = useState(false)
    const [showImageUpload, setShowImageUpload] = useState(false)
    const [showDrawingCanvas, setShowDrawingCanvas] = useState(false)
    const [duplicateWarning, setDuplicateWarning] = useState(false)
    const [isEditable, setIsEditable] = useState(canEdit)
    const isEditableRef = useRef(canEdit)
    const dupCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())
    const latestContentRef = useRef<object | null>(null)
    const titleRef = useRef(note.title)
    const isOwner = note.owner_id === currentUserId

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: false,
            }),
            CodeBlockWithDelete,
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            ResizableImage,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Underline,
            Placeholder.configure({ placeholder: 'Start writing...' }),
            TextStyle,
            FontSize,
            Color,
            Highlight.configure({ multicolor: true }),
        ],
        content: note.content && Object.keys(note.content).length > 0 ? note.content : undefined,
        immediatelyRender: false,
        editable: isEditable,
        onUpdate: ({ editor: ed }) => {
            if (!isEditableRef.current) return
            latestContentRef.current = ed.getJSON()
        },
        editorProps: {
            attributes: {
                class: 'outline-none min-h-[500px] px-8 py-6',
            },
        },
    })

    // Delete key handler for multi-selected images
    useEffect(() => {
        if (!editor || !isEditable) return
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key !== 'Delete' && e.key !== 'Backspace') return
            const multiSelected = getMultiSelectedSrcs()
            if (multiSelected.size === 0) return // Let ProseMirror handle single-selected node natively

            e.preventDefault()
            if (!editor) return

            // Find all image nodes with src in multiSelected and remove them
            const { tr } = editor.state
            const positions: number[] = []
            editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'image' && multiSelected.has(node.attrs.src)) {
                    positions.push(pos)
                }
            })

            // Delete in reverse order to keep earlier positions valid
            positions.sort((a, b) => b - a)
            for (const pos of positions) {
                tr.delete(pos, pos + 1)
            }

            editor.view.dispatch(tr)
            clearImageMultiSelect()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [editor, isEditable])

    // Clear multi-select when clicking on non-image content
    useEffect(() => {
        if (!editor) return
        const handleSelectionUpdate = () => {
            const { selection } = editor.state
            // If it's a NodeSelection on an image, don't clear (user clicked an image)
            if ('node' in selection && (selection as unknown as { node: { type: { name: string } } }).node?.type.name === 'image') return
            clearImageMultiSelect()
        }
        editor.on('selectionUpdate', handleSelectionUpdate)
        return () => { editor.off('selectionUpdate', handleSelectionUpdate) }
    }, [editor])

    // Initialize latestContentRef once editor is ready
    useEffect(() => {
        if (editor && !latestContentRef.current) {
            latestContentRef.current = editor.getJSON()
        }
    }, [editor])

    const save = useCallback(async () => {
        if (!editor || !isEditable || duplicateWarning) return
        setSaveStatus('saving')
        const content = editor.getJSON()
        latestContentRef.current = content
        const result = await updateNote(note.id, title, content)
        if (result.error) {
            setSaveStatus('error')
        } else {
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 2000)
        }
    }, [editor, title, note.id, isEditable, duplicateWarning])

    // Keep saveRef always pointing to latest save
    useEffect(() => {
        saveRef.current = save
    }, [save])

    // Keep titleRef in sync
    useEffect(() => { titleRef.current = title }, [title])

    // Keep isEditableRef in sync
    useEffect(() => { isEditableRef.current = isEditable }, [isEditable])

    // Check duplicate title (debounced)
    useEffect(() => {
        if (!isEditable || !title.trim()) {
            setDuplicateWarning(false)
            return
        }
        if (dupCheckTimerRef.current) clearTimeout(dupCheckTimerRef.current)
        dupCheckTimerRef.current = setTimeout(async () => {
            const result = await checkDuplicateTitle(note.id, title.trim())
            setDuplicateWarning(result.duplicate)
        }, 500)
        return () => { if (dupCheckTimerRef.current) clearTimeout(dupCheckTimerRef.current) }
    }, [title, isEditable, note.id])

    // Ctrl+S / Cmd+S manual save
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                saveRef.current()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Supabase Realtime Presence — detect other users viewing this note
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase.channel(`note-presence-${note.id}`)

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                const others: string[] = []
                for (const key of Object.keys(state)) {
                    for (const presence of state[key]) {
                        const p = presence as unknown as { user_id: string; email?: string }
                        if (p.user_id !== currentUserId) {
                            others.push(p.email || 'Another user')
                        }
                    }
                }
                setConcurrentUsers(others)
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Fetch current user's email for display to others
                    const { data: { user } } = await supabase.auth.getUser()
                    await channel.track({
                        user_id: currentUserId,
                        email: user?.email || 'Unknown',
                    })
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [note.id, currentUserId])

    // Poll permission every 5s for shared users — handles permission changes and revocation
    // without requiring note_shares Realtime to be enabled in Supabase
    useEffect(() => {
        if (isOwner) return // Owner always has edit access

        const supabase = createClient()

        async function checkPermission() {
            const { data: share, error } = await supabase
                .from('note_shares')
                .select('permission')
                .eq('note_id', note.id)
                .eq('shared_with', currentUserId)
                .single()

            if (error || !share) {
                // Access was revoked — redirect back to notes
                router.push('/dashboard/notes')
                return
            }

            const newCanEdit = share.permission === 'edit'
            setIsEditable(prev => {
                if (prev !== newCanEdit) return newCanEdit
                return prev
            })
        }

        const interval = setInterval(checkPermission, 5000)
        return () => clearInterval(interval)
    }, [note.id, currentUserId, isOwner, router])

    // Sync editor editable state when permission changes
    useEffect(() => {
        if (editor) {
            editor.setEditable(isEditable)
        }
    }, [isEditable, editor])

    // Save before navigating away (full page unload / refresh)
    const editorRef = useRef(editor)
    useEffect(() => { editorRef.current = editor }, [editor])

    useEffect(() => {
        const flushSave = () => {
            if (!isEditable || duplicateWarning) return
            const content = latestContentRef.current || (editorRef.current ? editorRef.current.getJSON() : null)
            if (content) {
                const payload = JSON.stringify({
                    noteId: note.id,
                    title: titleRef.current,
                    content,
                    cleanup: true,
                })
                navigator.sendBeacon?.('/api/save-note', new Blob([payload], { type: 'application/json' }))
            }
        }
        const handleBeforeUnload = () => { flushSave() }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [note.id, isEditable, duplicateWarning])

    // Flush save + cleanup on unmount (covers SPA navigation which doesn't trigger beforeunload)
    useEffect(() => {
        return () => {
            if (latestContentRef.current) {
                const payload = JSON.stringify({
                    noteId: note.id,
                    title: titleRef.current,
                    content: latestContentRef.current,
                    cleanup: true,
                })
                navigator.sendBeacon?.('/api/save-note', new Blob([payload], { type: 'application/json' }))
            }
        }
    }, [note.id])

    // Helper: count existing images to stagger new ones so they don't stack on top of each other
    function getNextImagePosition() {
        if (!editor) return { posX: 40, posY: 40 }
        const json = editor.getJSON()
        const imageCount = (json.content || []).filter((n: { type?: string }) => n.type === 'image').length
        return {
            posX: 40 + (imageCount % 5) * 30,
            posY: 40 + imageCount * 60,
        }
    }

    async function handleImageInsert(url: string) {
        if (!editor) return
        const pos = getNextImagePosition()
        // Move cursor to end so we append rather than replace a selected node
        editor.commands.focus('end')
        editor.chain().insertContent({
            type: 'image',
            attrs: { src: url, width: 300, posX: pos.posX, posY: pos.posY },
        }).run()
        setShowImageUpload(false)
        // Save immediately after image insert
        latestContentRef.current = editor.getJSON()
    }

    async function handleDrawingSave(url: string) {
        if (!editor) return
        const pos = getNextImagePosition()
        // Move cursor to end so we append rather than replace a selected node
        editor.commands.focus('end')
        editor.chain().insertContent({
            type: 'image',
            attrs: { src: url, width: 500, posX: pos.posX, posY: pos.posY },
        }).run()
        setShowDrawingCanvas(false)
        // Save immediately after drawing insert
        latestContentRef.current = editor.getJSON()
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* Header bar */}
            <div
                className="flex items-center justify-between px-6 py-3 shrink-0"
                style={{ borderBottom: '1px solid var(--card-border)' }}
            >
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/notes"
                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--overlay-medium)] transition-colors"
                        style={{ color: 'var(--muted-text)' }}
                        title="Back to notes"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                        </svg>
                    </Link>
                    <div className="flex flex-col">
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={!isEditable}
                            className="bg-transparent text-lg font-bold outline-none w-64 sm:w-96"
                            style={{ color: duplicateWarning ? '#f87171' : 'var(--heading-text)' }}
                            placeholder="Untitled"
                        />
                        {duplicateWarning && (
                            <span className="text-[11px] text-red-400 mt-0.5">A note with this name already exists. Please use a different name.</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Save status */}
                    <span className="text-xs" style={{
                        color: saveStatus === 'error' ? '#f87171' :
                               saveStatus === 'saving' ? '#fbbf24' :
                               saveStatus === 'saved' ? '#4ade80' :
                               'var(--muted-text)'
                    }}>
                        {saveStatus === 'saving' && 'Saving...'}
                        {saveStatus === 'saved' && 'Saved'}
                        {saveStatus === 'error' && 'Save failed'}
                    </span>

                    {/* Last updated info */}
                    {note.profiles?.full_name && (
                        <span className="text-xs hidden sm:inline" style={{ color: 'var(--muted-text)' }}>
                            Last edit: {note.profiles.full_name}
                        </span>
                    )}

                    {/* Share button — owner only */}
                    {isOwner && (
                        <button
                            onClick={() => setShowShareDialog(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--overlay-medium)] cursor-pointer"
                            style={{ color: 'var(--body-text)', border: '1px solid var(--card-border)' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v-2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                            Share
                        </button>
                    )}

                    {!isEditable && (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-600 border border-yellow-500/25">
                            View only
                        </span>
                    )}
                </div>
            </div>

            {/* Concurrent users warning */}
            {concurrentUsers.length > 0 && (
                <div
                    className="flex items-center gap-2 px-6 py-2.5 text-sm"
                    style={{ background: '#78350f', color: '#fef3c7', borderBottom: '1px solid var(--card-border)' }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span>
                        {concurrentUsers.length === 1
                            ? `${concurrentUsers[0]} is also viewing this note. Simultaneous edits may overwrite each other.`
                            : `${concurrentUsers.join(', ')} are also viewing this note. Simultaneous edits may overwrite each other.`
                        }
                    </span>
                </div>
            )}

            {/* Toolbar */}
            {isEditable && <Toolbar editor={editor} onImageUpload={() => setShowImageUpload(true)} onDrawingInsert={() => setShowDrawingCanvas(true)} />}

            {/* Editor content — canvas-style: images/drawings can be placed anywhere */}
            <div className="flex-1 overflow-auto" style={{ color: 'var(--body-text)' }}>
                <EditorContent editor={editor} className="tiptap-editor tiptap-editor-canvas" />
            </div>

            {/* Image upload modal */}
            {showImageUpload && (
                <ImageUpload
                    onInsert={handleImageInsert}
                    onClose={() => setShowImageUpload(false)}
                />
            )}

            {/* Share dialog */}
            {showShareDialog && (
                <ShareDialog
                    noteId={note.id}
                    onClose={() => setShowShareDialog(false)}
                />
            )}

            {/* Drawing canvas modal */}
            {showDrawingCanvas && (
                <DrawingCanvas
                    onSave={handleDrawingSave}
                    onClose={() => setShowDrawingCanvas(false)}
                />
            )}
        </div>
    )
}
