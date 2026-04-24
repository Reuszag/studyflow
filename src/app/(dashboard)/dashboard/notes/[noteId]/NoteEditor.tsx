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
import { Color, FontFamily } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import { createClient } from '@/lib/supabase/client'

// Extend Table node to carry free-positioning attributes
const PositionableTable = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            posX: {
                default: null,
                parseHTML: el => {
                    const v = el.closest('.tableWrapper')?.getAttribute('data-pos-x')
                    return v != null ? Number(v) : null
                },
                renderHTML: () => ({}),
            },
            posY: {
                default: null,
                parseHTML: el => {
                    const v = el.closest('.tableWrapper')?.getAttribute('data-pos-y')
                    return v != null ? Number(v) : null
                },
                renderHTML: () => ({}),
            },
        }
    },
})
import { updateNote, checkDuplicateTitle } from '../actions'
import Toolbar from './Toolbar'
import ImageUpload from './ImageUpload'
import ShareDialog from './ShareDialog'
import DrawingCanvas from './DrawingCanvas'
import TableControls from './TableControls'
import { getMultiSelectedSrcs, clearImageMultiSelect } from './ResizableImageExtension'

function decodeStoragePath(rawPath: string): string {
    let normalized = rawPath
    for (let i = 0; i < 3; i++) {
        try {
            const decoded = decodeURIComponent(normalized)
            if (decoded === normalized) break
            normalized = decoded
        } catch {
            break
        }
    }
    return normalized.replace(/^\/+/, '').replace(/\\/g, '/')
}

// Rewrite public Supabase storage URLs in TipTap content to proxy URLs so that
// every viewer loads images through our authenticated API route, bypassing
// storage RLS that may block direct public access for non-uploader users.
function rewriteContentImageUrls(content: object, noteId: string): object {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'
    type ContentNode = { type?: string; attrs?: Record<string, unknown>; content?: ContentNode[] }

    function walk(nodes: ContentNode[] | undefined) {
        if (!nodes) return
        for (const node of nodes) {
            if (node.type === 'image' && typeof node.attrs?.src === 'string') {
                const src = node.attrs.src as string
                if (src.startsWith(publicPrefix)) {
                    const storagePath = decodeStoragePath(src.slice(publicPrefix.length))
                    node.attrs.src = `/api/note-image?path=${encodeURIComponent(storagePath)}&noteId=${noteId}`
                } else if (src.startsWith(proxyPrefix)) {
                    try {
                        const params = new URLSearchParams(src.slice(proxyPrefix.length))
                        const storagePath = params.get('path')
                        if (storagePath) {
                            node.attrs.src = `/api/note-image?path=${encodeURIComponent(decodeStoragePath(storagePath))}&noteId=${noteId}`
                        }
                    } catch {
                        // Keep original if parsing fails
                    }
                }
            }
            if (node.content) walk(node.content)
        }
    }

    const copy = JSON.parse(JSON.stringify(content)) as { content?: ContentNode[] }
    walk(copy.content)
    return copy
}

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
    const [viewingUsers, setViewingUsers] = useState<string[]>([])
    const [lockedByUser, setLockedByUser] = useState<string | null>(null)
    const [editorLeft, setEditorLeft] = useState(false)
    const [showShareDialog, setShowShareDialog] = useState(false)
    const [showImageUpload, setShowImageUpload] = useState(false)
    const [showDrawingCanvas, setShowDrawingCanvas] = useState(false)
    const [duplicateWarning, setDuplicateWarning] = useState(false)
    const [isEditable, setIsEditable] = useState(canEdit)
    const [permissionNotice, setPermissionNotice] = useState<'upgraded' | 'downgraded' | null>(null)
    const [ownerPermissionNotice, setOwnerPermissionNotice] = useState<{ type: 'upgraded' | 'downgraded'; email: string } | null>(null)
    const [showReloadPrompt, setShowReloadPrompt] = useState(false)
    // Tracks whether the editor's downgrade-save has been confirmed via broadcast.
    // While true, the "editor left" banner tells users to wait instead of refreshing.
    const [pendingSaveConfirmation, setPendingSaveConfirmation] = useState(false)
    const isOwner = note.owner_id === currentUserId
    const [hasEditPermission, setHasEditPermission] = useState(isOwner || canEdit)
    const isEditableRef = useRef(canEdit)
    const dupCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())
    const latestContentRef = useRef<object | null>(null)
    const titleRef = useRef(note.title)
    const editorScrollRef = useRef<HTMLDivElement>(null)
    // Tracks whether this user currently has edit permission (updated by polling, not just initial prop)
    const hasEditPermissionRef = useRef(isOwner || canEdit)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                codeBlock: false,
            }),
            CodeBlockWithDelete,
            PositionableTable.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            ResizableImage,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Underline,
            Placeholder.configure({ placeholder: '' }),
            TextStyle,
            FontSize,
            FontFamily,
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

    // Apply table posX/posY attrs → DOM styles for ALL users (owner, editor, view-only).
    // TableControls only mounts when isEditable, so this handles view-only users too.
    useEffect(() => {
        if (!editor) return
        function applyTablePositions() {
            const tiptap = editorScrollRef.current?.querySelector('.tiptap') as HTMLElement | null
            if (!tiptap) return false
            // Ensure absolutely positioned table wrappers are anchored to the editor surface.
            if (getComputedStyle(tiptap).position === 'static') {
                tiptap.style.position = 'relative'
            }
            const tableNodes: Array<{ posX: number | null; posY: number | null }> = []
            editor!.state.doc.descendants((node: { type: { name: string }; attrs?: Record<string, unknown> }) => {
                if (node.type.name === 'table') {
                    tableNodes.push({ posX: (node.attrs?.posX ?? null) as number | null, posY: (node.attrs?.posY ?? null) as number | null })
                    return false
                }
            })
            const wrappers = Array.from(tiptap.querySelectorAll('.tableWrapper')) as HTMLElement[]
            wrappers.forEach((wrapper, i) => {
                const attrs = tableNodes[i]
                if (!attrs) return
                if (attrs.posX != null && attrs.posY != null) {
                    wrapper.style.position = 'absolute'
                    wrapper.style.left = `${attrs.posX}px`
                    wrapper.style.top = `${attrs.posY}px`
                    wrapper.style.margin = '0'
                    wrapper.style.zIndex = '10'
                } else {
                    wrapper.style.position = ''
                    wrapper.style.left = ''
                    wrapper.style.top = ''
                    wrapper.style.margin = ''
                    wrapper.style.zIndex = ''
                }
            })
            return wrappers.length > 0
        }
        // Run across multiple frames so first-load refresh reliably catches table wrappers.
        let rafId = 0
        let tries = 0
        const applyUntilReady = () => {
            tries += 1
            const hasWrappers = applyTablePositions()
            if ((!hasWrappers || tries < 6) && tries < 24) {
                rafId = requestAnimationFrame(applyUntilReady)
            }
        }
        applyUntilReady()
        editor.on('update', applyTablePositions)
        editor.on('transaction', applyTablePositions)
        return () => {
            cancelAnimationFrame(rafId)
            editor.off('update', applyTablePositions)
            editor.off('transaction', applyTablePositions)
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

    // Supabase Realtime Presence — edit lock + concurrent user detection + live content broadcast
    // All users with edit permission are equal: first to open gets the lock,
    // everyone else (including the owner) is forced to view-only until the editor leaves.
    // The editing user broadcasts content changes so view-only users see live unsaved state.
    const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
    const myEditingRef = useRef(false)
    const myEmailRef = useRef('Unknown')
    const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    // Tracks whether any other user holds the edit lock (used by permission polling)
    const someoneElseEditingRef = useRef(false)
    // Used by viewers to avoid repeatedly requesting the same initial sync snapshot.
    const requestedInitialSyncRef = useRef(false)
    // Tracks whether we have received our first presence sync after subscribing.
    // Lock claim is deferred to the first sync so presence state is fully populated
    // — prevents reloaders from claiming the lock while another editor is active.
    const initialSyncDoneRef = useRef(false)
    const activeEditorRef = useRef<string | null>(null)
    const lockedByUserRef = useRef<string | null>(null)
    // Per-tab unique id. Used as self-identity in presence so multiple tabs of
    // the same user can still run the tiebreaker (same user_id would otherwise
    // tie and leave both tabs as editors).
    const sessionIdRef = useRef<string>('')
    
    useEffect(() => {
        if (!sessionIdRef.current) {
            sessionIdRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        }
    }, [])

    const handleOwnerPermissionChange = useCallback((change: {
        targetUserId: string
        targetEmail: string | null
        newPermission: 'view' | 'edit'
    }) => {
        if (!isOwner || change.targetUserId === currentUserId) return

        setOwnerPermissionNotice({
            type: change.newPermission === 'edit' ? 'upgraded' : 'downgraded',
            email: change.targetEmail || 'The user',
        })
        setTimeout(() => setOwnerPermissionNotice(null), 6000)

        if (change.newPermission !== 'view') return

        const ch = channelRef.current
        const state = ch?.presenceState() || {}
        let downgradedActiveEditor = false
        let anotherEditorExists = false

        for (const key of Object.keys(state)) {
            for (const p of state[key]) {
                const presence = p as unknown as { user_id: string; isEditing?: boolean }
                if (presence.user_id === change.targetUserId && presence.isEditing) {
                    downgradedActiveEditor = true
                }
                if (presence.user_id !== change.targetUserId && presence.isEditing) {
                    anotherEditorExists = true
                }
            }
        }

        // Only show reload prompt if the downgraded user was the active editor
        // and no one else is currently editing
        if (downgradedActiveEditor && !anotherEditorExists) {
            setShowReloadPrompt(true)
        }

        // Only show handoff banner if the downgraded user was the active editor
        // and no one else is currently editing
        if ((downgradedActiveEditor || !!lockedByUserRef.current) && !anotherEditorExists) {
            lockedByUserRef.current = null
            setLockedByUser(null)
            setEditorLeft(true)
            setPendingSaveConfirmation(true)
            setTimeout(() => setPendingSaveConfirmation(false), 10000)
        }
    }, [isOwner, currentUserId])

    useEffect(() => {
        const supabase = createClient()
        const channel = supabase.channel(`note-presence-${note.id}`)
        channelRef.current = channel

        // Helper: check if someone else is already editing in current presence state.
        // Identity is by session_id (per-tab) not user_id, so another tab of the
        // same user also counts as "another editor" and goes through the tiebreaker.
        function getActiveEditor(state: Record<string, unknown[]>): { email: string; sessionId: string } | null {
            for (const key of Object.keys(state)) {
                for (const presence of state[key]) {
                    const p = presence as unknown as { user_id: string; email?: string; isEditing?: boolean; session_id?: string }
                    const pSid = p.session_id || p.user_id
                    if (pSid === sessionIdRef.current) continue
                    if (p.isEditing) return { email: p.email || 'Another user', sessionId: pSid }
                }
            }
            return null
        }

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState()
                const viewers: string[] = []

                for (const key of Object.keys(state)) {
                    for (const presence of state[key]) {
                        const p = presence as unknown as { user_id: string; email?: string; isEditing?: boolean; session_id?: string }
                        const pSid = p.session_id || p.user_id
                        if (pSid === sessionIdRef.current) continue
                        // Only list users who are NOT editing as "viewers"
                        if (!p.isEditing) {
                            viewers.push(p.email || 'Another user')
                        }
                    }
                }

                setViewingUsers(viewers)

                const activeEditor = getActiveEditor(state)
                const activeEditorEmail = activeEditor?.email || null
                if (activeEditorEmail !== activeEditorRef.current) {
                    activeEditorRef.current = activeEditorEmail
                    requestedInitialSyncRef.current = false
                }
                someoneElseEditingRef.current = !!activeEditor

                // First sync after subscribe: claim edit lock ONLY if no active editor.
                // Deferring to sync (instead of claiming in SUBSCRIBED) ensures presence
                // state is fully populated, so reloaders never claim while another user
                // is editing.
                if (!initialSyncDoneRef.current) {
                    initialSyncDoneRef.current = true
                    if (!activeEditor && hasEditPermissionRef.current && !myEditingRef.current) {
                        myEditingRef.current = true
                        channel.track({
                            user_id: currentUserId,
                            email: myEmailRef.current,
                            isEditing: true,
                            session_id: sessionIdRef.current,
                        })
                        setIsEditable(true)
                        setLockedByUser(null)
                        setEditorLeft(false)
                        setShowReloadPrompt(false)
                        setPendingSaveConfirmation(false)
                        if (editor) {
                            channel.send({
                                type: 'broadcast',
                                event: 'content-sync',
                                payload: {
                                    content: editor.getJSON(),
                                    title: titleRef.current,
                                },
                            })
                        }
                        return
                    }
                }

                if (activeEditor) {
                    setShowReloadPrompt(false)
                }

                // Late joiners load DB state first; request the active editor's latest unsaved snapshot
                // so inserted images/drawings are visible immediately even before any new edit occurs.
                if (activeEditor && !myEditingRef.current && !requestedInitialSyncRef.current) {
                    requestedInitialSyncRef.current = true
                    channel.send({
                        type: 'broadcast',
                        event: 'content-request',
                        payload: { fromUserId: currentUserId },
                    })
                }

                if (activeEditor) {
                    // Any active editor means the previous handoff banner is stale.
                    setEditorLeft(false)
                    setShowReloadPrompt(false)
                    setPendingSaveConfirmation(false)

                    // Someone else holds the lock — update all users who need to know
                    if (!myEditingRef.current) {
                        lockedByUserRef.current = activeEditor.email
                        setLockedByUser(activeEditor.email)
                        if (hasEditPermissionRef.current) {
                            setIsEditable(false)
                        }
                    }
                    // Race: we thought we were editing but someone else is too.
                    // Tiebreaker by session_id (lex-smaller wins). Session id is per-tab
                    // so two tabs of the same user still produce a deterministic winner.
                    if (myEditingRef.current && hasEditPermissionRef.current) {
                        const otherEditorSid = activeEditor.sessionId
                        if (sessionIdRef.current > otherEditorSid) {
                            myEditingRef.current = false
                            lockedByUserRef.current = activeEditor.email
                            channel.track({
                                user_id: currentUserId,
                                email: myEmailRef.current,
                                isEditing: false,
                                session_id: sessionIdRef.current,
                            })
                            setIsEditable(false)
                            setLockedByUser(activeEditor.email)
                        }
                        // else: we win tiebreaker — stay editor, other tab will demote
                    }
                } else if (!myEditingRef.current) {
                    // Editor left (navigated away, closed tab, or permission downgraded).
                    // Notify ALL users (edit-permission or view-only) who were watching an editor.
                    if (lockedByUserRef.current) {
                        lockedByUserRef.current = null
                        setLockedByUser(null)
                        setEditorLeft(true)
                        if (hasEditPermissionRef.current) {
                            setIsEditable(false)
                        }
                        // The departing editor may still be saving — show "waiting" until content-saved arrives.
                        setPendingSaveConfirmation(true)
                        // Fallback: clear after 10s in case broadcast is lost (e.g. tab close)
                        setTimeout(() => setPendingSaveConfirmation(false), 10000)
                    }
                }
            })
            // Respond to snapshot requests from late-joining viewers.
            .on('broadcast', { event: 'content-request' }, () => {
                if (!myEditingRef.current || !editor) return
                channel.send({
                    type: 'broadcast',
                    event: 'content-sync',
                    payload: {
                        content: editor.getJSON(),
                        title: titleRef.current,
                    },
                })
            })
            // Listen for content broadcasts from the editing user
            .on('broadcast', { event: 'content-sync' }, ({ payload }) => {
                // Only apply if we're in view-only mode (not the editor)
                if (myEditingRef.current || !editor) return
                const { content, title: remoteTitle } = payload as { content: object; title: string }
                if (content) {
                    // Rewrite any public storage URLs to proxy URLs so this viewer
                    // can load images uploaded by anyone (owner or other shared users).
                    const rewritten = rewriteContentImageUrls(content, note.id)
                    editor.commands.setContent(rewritten, { emitUpdate: false })
                    // Keep latest snapshot aligned for lock-claim and safety checks.
                    latestContentRef.current = rewritten
                }
                if (remoteTitle) {
                    setTitle(remoteTitle)
                }
            })
            // Listen for instant permission-change broadcasts from the ShareDialog.
            // This eliminates the 5s polling delay — the affected user immediately
            // saves and releases the edit lock before the owner can refresh.
            .on('broadcast', { event: 'permission-changed' }, async ({ payload }) => {
                const { targetUserId, targetEmail, newPermission } = payload as { targetUserId: string; targetEmail: string | null; newPermission: 'view' | 'edit' }

                // Owner sees a brief notice when they change someone else's permission
                if (targetUserId !== currentUserId && isOwner) {
                    handleOwnerPermissionChange({ targetUserId, targetEmail, newPermission })
                    return
                }

                if (targetUserId !== currentUserId) return

                const prev = prevPermissionRef.current
                const newCanEdit = newPermission === 'edit'
                if (newPermission === prev) return

                prevPermissionRef.current = newPermission
                hasEditPermissionRef.current = newCanEdit
                setHasEditPermission(newCanEdit)

                if (newCanEdit) {
                    setPermissionNotice('upgraded')
                    if (someoneElseEditingRef.current) {
                        // Someone else is editing — show the lock banner so user knows to wait
                        const state = channel.presenceState()
                        for (const key of Object.keys(state)) {
                            for (const p of state[key]) {
                                const presence = p as unknown as { user_id: string; email?: string; isEditing?: boolean }
                                if (presence.user_id !== currentUserId && presence.isEditing) {
                                    lockedByUserRef.current = presence.email || 'Another user'
                                    setLockedByUser(presence.email || 'Another user')
                                }
                            }
                        }
                    } else {
                        // If no one is editing, show the same green handoff/reload banner
                        // that appears after an editor leaves.
                        lockedByUserRef.current = null
                        setLockedByUser(null)
                        setEditorLeft(true)
                        setPendingSaveConfirmation(false)
                    }
                    // No else needed: if no one is editing, user can reload to claim the lock.
                    // The upgraded banner already prompts them; claimEditLock handles in-place claim.
                } else {
                    setPermissionNotice('downgraded')
                    setLockedByUser(null)
                    // Persist unsaved work BEFORE releasing lock
                    if (myEditingRef.current) {
                        const contentToSave = latestContentRef.current || (editor ? editor.getJSON() : null)
                        if (contentToSave) {
                            channel.send({
                                type: 'broadcast',
                                event: 'content-sync',
                                payload: {
                                    content: contentToSave,
                                    title: titleRef.current,
                                },
                            })
                            let saveOk = false
                            try {
                                // No keepalive: page is not unloading, keepalive's 64KB body limit
                                // would silently drop large notes (with many image URLs).
                                const resp = await fetch('/api/save-note', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        noteId: note.id,
                                        title: titleRef.current,
                                        content: contentToSave,
                                        allowDowngradeSave: true,
                                    }),
                                })
                                saveOk = resp.ok
                            } catch { /* swallow */ }
                            // Only notify others to refresh if the save actually succeeded.
                            if (saveOk) {
                                channel.send({
                                    type: 'broadcast',
                                    event: 'content-saved',
                                    payload: { savedByUserId: currentUserId },
                                })
                            }
                        }
                        myEditingRef.current = false
                        await channel.track({
                            user_id: currentUserId,
                            email: myEmailRef.current,
                            isEditing: false,
                            session_id: sessionIdRef.current,
                        })
                    }
                }
                setTimeout(() => setPermissionNotice(null), 10000)

                setIsEditable(prev => {
                    if (!newCanEdit) return false
                    if (someoneElseEditingRef.current) return false
                    return prev
                })
            })
            // Listen for content-saved confirmation from the downgraded editor.
            // This means the DB now has the latest content and it's safe to refresh.
            .on('broadcast', { event: 'content-saved' }, () => {
                if (myEditingRef.current) return // The saver doesn't need this
                setPendingSaveConfirmation(false)
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const { data: { user } } = await supabase.auth.getUser()
                    myEmailRef.current = user?.email || 'Unknown'

                    // Always join as viewer first. The 'sync' handler promotes us to
                    // editor on the first sync ONLY if no active editor exists. This
                    // guarantees a reloader never claims the lock while another user
                    // is already editing (SUBSCRIBED fires before presence state is
                    // populated, so we can't trust it here).
                    myEditingRef.current = false
                    initialSyncDoneRef.current = false
                    requestedInitialSyncRef.current = false
                    setIsEditable(false)

                    await channel.track({
                        user_id: currentUserId,
                        email: myEmailRef.current,
                        isEditing: false,
                        session_id: sessionIdRef.current,
                    })
                }
            })

        return () => {
            if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current)
            // If we were the active editor, broadcast content-saved before leaving so
            // viewers immediately know it's safe to refresh (not stuck on "waiting...").
            if (myEditingRef.current) {
                channel.send({
                    type: 'broadcast',
                    event: 'content-saved',
                    payload: { savedByUserId: currentUserId },
                })
            }
            channelRef.current = null
            supabase.removeChannel(channel)
        }
    }, [note.id, currentUserId, isOwner, editor, handleOwnerPermissionChange])

    // Broadcast content changes to view-only users (debounced, 500ms)
    useEffect(() => {
        if (!editor) return
        const handleUpdate = () => {
            if (!myEditingRef.current || !channelRef.current) return
            if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current)
            broadcastTimerRef.current = setTimeout(() => {
                channelRef.current?.send({
                    type: 'broadcast',
                    event: 'content-sync',
                    payload: {
                        content: editor.getJSON(),
                        title: titleRef.current,
                    },
                })
            }, 500)
        }
        editor.on('update', handleUpdate)
        return () => { editor.off('update', handleUpdate) }
    }, [editor])

    // Broadcast title changes to view-only users
    useEffect(() => {
        if (!myEditingRef.current || !channelRef.current || !editor) return
        channelRef.current.send({
            type: 'broadcast',
            event: 'content-sync',
            payload: {
                content: editor.getJSON(),
                title,
            },
        })
    }, [title, editor])

    // Poll permission every 5s for shared users — handles permission changes and revocation

    const prevPermissionRef = useRef<'view' | 'edit'>(canEdit ? 'edit' : 'view')

    useEffect(() => {
        if (isOwner) return // Owner doesn't have a share row to poll

        const supabase = createClient()

        async function checkPermission() {
            const { data: share, error } = await supabase
                .from('note_shares')
                .select('permission')
                .eq('note_id', note.id)
                .eq('shared_with', currentUserId)
                .single()

            if (error || !share) {
                router.push('/dashboard/notes')
                return
            }

            const newPermission = share.permission as 'view' | 'edit'
            const newCanEdit = newPermission === 'edit'
            const oldPermission = prevPermissionRef.current

            if (newPermission !== oldPermission) {
                prevPermissionRef.current = newPermission
                hasEditPermissionRef.current = newCanEdit
                setHasEditPermission(newCanEdit)
                if (newCanEdit) {
                    setShowReloadPrompt(!someoneElseEditingRef.current)
                    setPermissionNotice('upgraded')
                    // If someone else is already editing, restore the lock banner so the user
                    // knows they must wait before they can claim the edit lock.
                    if (someoneElseEditingRef.current) {
                        const ch = channelRef.current
                        if (ch) {
                            const state = ch.presenceState()
                            for (const key of Object.keys(state)) {
                                for (const p of state[key]) {
                                    const presence = p as unknown as { user_id: string; email?: string; isEditing?: boolean }
                                    if (presence.user_id !== currentUserId && presence.isEditing) {
                                        lockedByUserRef.current = presence.email || 'Another user'
                                        setLockedByUser(presence.email || 'Another user')
                                    }
                                }
                            }
                        }
                    } else {
                        // Polling fallback for instant broadcast path: show the same
                        // ready-to-edit handoff banner when no active editor exists.
                        lockedByUserRef.current = null
                        setLockedByUser(null)
                        setEditorLeft(true)
                        setPendingSaveConfirmation(false)
                    }
                    // No else needed: user sees the upgrade banner + can reload to claim lock.
                } else {
                    setShowReloadPrompt(false)
                    setPermissionNotice('downgraded')
                    setLockedByUser(null)
                    // Persist B's unsaved work BEFORE releasing lock so owner/C refresh hits fresh DB.
                    if (myEditingRef.current) {
                        const contentToSave = latestContentRef.current || (editor ? editor.getJSON() : null)
                        if (contentToSave) {
                            // Final broadcast so any viewer who claims lock in-place has latest snapshot too
                            channelRef.current?.send({
                                type: 'broadcast',
                                event: 'content-sync',
                                payload: {
                                    content: contentToSave,
                                    title: titleRef.current,
                                },
                            })
                            let saveOk = false
                            try {
                                const resp = await fetch('/api/save-note', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        noteId: note.id,
                                        title: titleRef.current,
                                        content: contentToSave,
                                        allowDowngradeSave: true,
                                    }),
                                })
                                saveOk = resp.ok
                            } catch { /* swallow */ }
                            if (saveOk) {
                                channelRef.current?.send({
                                    type: 'broadcast',
                                    event: 'content-saved',
                                    payload: { savedByUserId: currentUserId },
                                })
                            }
                        }
                        myEditingRef.current = false
                        await channelRef.current?.track({
                            user_id: currentUserId,
                            email: myEmailRef.current,
                            isEditing: false,
                            session_id: sessionIdRef.current,
                        })
                    }
                }
                setTimeout(() => setPermissionNotice(null), 10000)
            }

            setIsEditable(prev => {
                // Never auto-grant edit mode from polling. Shared users claim the lock explicitly.
                if (!newCanEdit) return false
                if (someoneElseEditingRef.current) return false
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
            // Never let passive viewers persist content on unload.
            if (!myEditingRef.current || duplicateWarning) return
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
            // Never let passive viewers persist content on unmount.
            if (!myEditingRef.current) return
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

    // Claim the edit lock in-place (no page reload needed)
    async function claimEditLock() {
        const ch = channelRef.current
        if (!ch) return
        myEditingRef.current = true
        requestedInitialSyncRef.current = false
        await ch.track({
            user_id: currentUserId,
            email: myEmailRef.current,
            isEditing: true,
            session_id: sessionIdRef.current,
        })
        if (editor) {
            ch.send({
                type: 'broadcast',
                event: 'content-sync',
                payload: {
                    content: editor.getJSON(),
                    title: titleRef.current,
                },
            })
        }
        setEditorLeft(false)
        setIsEditable(true)
    }

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

            {/* Edit lock banner — shown when another user holds the edit lock */}
            {lockedByUser && (
                <div
                    className="flex items-center gap-2 px-6 py-2.5 text-sm"
                    style={{ background: '#1e3a5f', color: '#bfdbfe', borderBottom: '1px solid #2563eb44' }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    <span>
                        <strong>{lockedByUser}</strong> is currently editing this note. You are in view-only mode. Once they save and leave, you will be able to edit.
                    </span>
                </div>
            )}

            {/* Editor left banner — shown to all users who were watching an editor */}
            {editorLeft && !lockedByUser && (
                <div
                    className="flex items-center justify-between px-5 py-3 text-sm"
                    style={{
                        background: 'linear-gradient(90deg, #0d2b1d 0%, #0f3024 60%, #0d2b1d 100%)',
                        borderBottom: '1px solid #22c55e33',
                        boxShadow: '0 2px 12px 0 rgba(34,197,94,0.07)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <span
                            className="flex items-center justify-center rounded-full shrink-0"
                            style={{ width: 30, height: 30, background: 'rgba(34,197,94,0.13)', border: '1px solid rgba(34,197,94,0.25)' }}
                        >
                            {pendingSaveConfirmation ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            )}
                        </span>
                        <span style={{ color: '#86efac' }}>
                            {pendingSaveConfirmation ? (
                                <span style={{ color: '#bbf7d0' }}>Saving changes, please wait<span className="animate-pulse">…</span></span>
                            ) : (hasEditPermission || showReloadPrompt) ? (
                                <span style={{ color: '#bbf7d0' }}>
                                    The previous editor has finished.{" "}
                                    <span style={{ color: '#86efac' }}>
                                        Reload to start editing.
                                    </span>
                                </span>
                            ) : (
                                <span style={{ color: '#bbf7d0' }}>The editor has left. The note is now up to date.</span>
                            )}
                        </span>
                    </div>
                    {!pendingSaveConfirmation && (hasEditPermission || showReloadPrompt) && (
                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer"
                            style={{
                                background: 'rgba(34,197,94,0.15)',
                                border: '1px solid rgba(34,197,94,0.35)',
                                color: '#4ade80',
                                boxShadow: '0 0 8px rgba(34,197,94,0.1)',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.28)'
                                ;(e.currentTarget as HTMLButtonElement).style.color = '#bbf7d0'
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,197,94,0.15)'
                                ;(e.currentTarget as HTMLButtonElement).style.color = '#4ade80'
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                            </svg>
                            Reload
                        </button>
                    )}
                </div>
            )}

            {/* Owner notice: someone else's permission was changed */}
            {ownerPermissionNotice && (
                <div
                    className="flex items-center gap-2 px-6 py-2.5 text-sm"
                    style={ownerPermissionNotice.type === 'upgraded'
                        ? { background: '#1a4731', color: '#bbf7d0', borderBottom: '1px solid #22c55e44' }
                        : { background: '#3b1f1a', color: '#fca5a5', borderBottom: '1px solid #ef444444' }
                    }
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>
                        {ownerPermissionNotice.type === 'upgraded'
                            ? <><strong>{ownerPermissionNotice.email}</strong> has been upgraded to <strong>edit</strong> access.</>
                            : <><strong>{ownerPermissionNotice.email}</strong> has been changed to <strong>view only</strong>.</>
                        }
                    </span>
                </div>
            )}

            {/* Permission change notice */}
            {permissionNotice === 'upgraded' && (
                <div
                    className="flex items-center gap-2 px-6 py-2.5 text-sm"
                    style={{ background: '#1a4731', color: '#bbf7d0', borderBottom: '1px solid #22c55e44' }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>The owner upgraded your permission to <strong>edit</strong>.</span>
                </div>
            )}
            {permissionNotice === 'downgraded' && (
                <div
                    className="flex items-center gap-2 px-6 py-2.5 text-sm"
                    style={{ background: '#3b1f1a', color: '#fca5a5', borderBottom: '1px solid #ef444444' }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span>The owner changed your permission to <strong>view only</strong>. You can no longer edit this note.</span>
                </div>
            )}

            {/* Viewers info — shown for the active editor when others are viewing */}
            {!lockedByUser && viewingUsers.length > 0 && (
                <div
                    className="flex items-center gap-2 px-6 py-2.5 text-sm"
                    style={{ background: '#1c1917', color: '#d6d3d1', borderBottom: '1px solid var(--card-border)' }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                    <span>
                        {viewingUsers.length === 1
                            ? `${viewingUsers[0]} is viewing this note.`
                            : `${viewingUsers.join(', ')} are viewing this note.`
                        }
                    </span>
                </div>
            )}

            {/* Toolbar */}
            {isEditable && <Toolbar editor={editor} onImageUpload={() => setShowImageUpload(true)} onDrawingInsert={() => setShowDrawingCanvas(true)} />}

            {/* Editor content — canvas-style: images/drawings can be placed anywhere */}
            <div ref={editorScrollRef} className="flex-1 overflow-y-auto overflow-x-auto relative" style={{ color: 'var(--body-text)' }}>
                <EditorContent editor={editor} className="tiptap-editor tiptap-editor-canvas" />
                {isEditable && <TableControls editor={editor} containerRef={editorScrollRef} hidden={showImageUpload || showDrawingCanvas || showShareDialog} />}
            </div>

            {/* Image upload modal */}
            {showImageUpload && (
                <ImageUpload
                    noteId={note.id}
                    ownerId={note.owner_id}
                    onInsert={handleImageInsert}
                    onClose={() => setShowImageUpload(false)}
                />
            )}

            {/* Share dialog */}
            {showShareDialog && (
                <ShareDialog
                    noteId={note.id}
                    onPermissionChanged={handleOwnerPermissionChange}
                    onClose={() => setShowShareDialog(false)}
                />
            )}

            {/* Drawing canvas modal */}
            {showDrawingCanvas && (
                <DrawingCanvas
                    noteId={note.id}
                    ownerId={note.owner_id}
                    onSave={handleDrawingSave}
                    onClose={() => setShowDrawingCanvas(false)}
                />
            )}
        </div>
    )
}
