'use client'

import { type Editor } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'

function FontSizeInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const [inputVal, setInputVal] = useState(value)
    useEffect(() => { setInputVal(value) }, [value])

    const apply = (raw: string) => {
        const num = parseInt(raw, 10)
        if (isNaN(num) || num < 12) { setInputVal(value); return }
        setInputVal(num.toString())
        onChange(num.toString())
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const filtered = e.target.value.replace(/[^0-9]/g, '')
        setInputVal(filtered)
    }

    return (
        <div className="flex items-center gap-0.5">
            <input
                type="text"
                inputMode="numeric"
                value={inputVal}
                onChange={handleChange}
                onBlur={(e) => apply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { apply((e.target as HTMLInputElement).value); e.preventDefault() } }}
                className="w-12 h-8 text-xs text-center rounded-lg border border-transparent px-1 focus:outline-none focus:border-violet-500/50"
                style={{ color: 'var(--body-text)', background: 'var(--overlay-soft)' }}
                title="Font size"
            />
            <span className="text-xs pr-1" style={{ color: 'var(--text-tertiary)' }}>px</span>
        </div>
    )
}

function ToolbarButton({ onClick, active, disabled, title, children }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-colors
                ${active
                    ? 'bg-violet-500/20 border border-violet-500/30'
                    : 'hover:bg-[var(--overlay-medium)] border border-transparent'
                }
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
            `}
            style={active ? { color: 'var(--active-nav-text)' } : { color: 'var(--body-text)' }}
        >
            {children}
        </button>
    )
}

function Divider() {
    return <div className="w-px h-6 mx-1" style={{ background: 'var(--card-border)' }} />
}

function Dropdown({ value, options, onChange, title, width = 'w-16' }: {
    value: string
    options: { label: string; value: string }[]
    onChange: (val: string) => void
    title: string
    width?: string
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                title={title}
                className={`${width} h-8 rounded-lg flex items-center justify-between px-2 text-xs font-medium transition-colors hover:bg-[var(--overlay-medium)] cursor-pointer border border-transparent`}
                style={{ color: 'var(--body-text)' }}
            >
                <span className="truncate">{value || options[0]?.label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 py-1 min-w-[80px]"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setOpen(false) }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--overlay-medium)] transition-colors cursor-pointer"
                            style={{ color: opt.value === value ? '#a78bfa' : 'var(--body-text)' }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

const FONT_FAMILIES = [
    { label: 'Default', value: '' },
    { label: 'Inter', value: 'Inter, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Courier New', value: '"Courier New", monospace' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
    { label: 'Cursive', value: 'cursive' },
]

function FontFamilyDropdown({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const currentFamily = editor.getAttributes('textStyle')?.fontFamily || ''
    const currentLabel = FONT_FAMILIES.find(f => f.value === currentFamily)?.label || 'Default'

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                title="Font family"
                className="w-24 h-8 rounded-lg flex items-center justify-between px-2 text-xs font-medium transition-colors hover:bg-[var(--overlay-medium)] cursor-pointer border border-transparent"
                style={{ color: 'var(--body-text)', fontFamily: currentFamily || 'inherit' }}
            >
                <span className="truncate">{currentLabel}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 py-1"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', minWidth: 180 }}
                >
                    {FONT_FAMILIES.map((f) => (
                        <button
                            key={f.value || 'default'}
                            type="button"
                            onClick={() => {
                                if (!f.value) {
                                    editor.chain().focus().unsetFontFamily().run()
                                } else {
                                    editor.chain().focus().setFontFamily(f.value).run()
                                }
                                setOpen(false)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--overlay-medium)] transition-colors cursor-pointer"
                            style={{
                                color: f.value === currentFamily ? '#a78bfa' : 'var(--body-text)',
                                fontFamily: f.value || 'inherit',
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

const HIGHLIGHT_COLORS = [
    { label: 'Yellow', value: '#fef08a' },
    { label: 'Green', value: '#bbf7d0' },
    { label: 'Blue', value: '#bfdbfe' },
    { label: 'Pink', value: '#fbcfe8' },
    { label: 'Orange', value: '#fed7aa' },
    { label: 'Purple', value: '#e9d5ff' },
    { label: 'Red', value: '#fecaca' },
    { label: 'Cyan', value: '#a5f3fc' },
]

function HighlightPicker({ editor }: { editor: Editor }) {
    const [open, setOpen] = useState(false)
    const [activeColor, setActiveColor] = useState('#fef08a')
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const isActive = editor.isActive('highlight')
    const currentColor = editor.getAttributes('highlight')?.color || activeColor

    return (
        <div ref={ref} className="relative flex items-center">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHighlight({ color: activeColor }).run()}
                title="Highlight"
                className={`w-8 h-8 rounded-l-lg flex items-center justify-center text-sm font-bold transition-colors border-r-0
                    ${isActive
                        ? 'bg-violet-500/20 border border-violet-500/30'
                        : 'hover:bg-[var(--overlay-medium)] border border-transparent'
                    } cursor-pointer`}
                style={isActive ? { color: 'var(--active-nav-text)' } : { color: 'var(--body-text)' }}
            >
                <span className="px-0.5 rounded text-xs font-bold" style={{ background: currentColor, color: '#000' }}>H</span>
            </button>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                title="Highlight color"
                className="w-4 h-8 rounded-r-lg flex items-center justify-center transition-colors hover:bg-[var(--overlay-medium)] border border-transparent cursor-pointer"
                style={{ color: 'var(--text-tertiary)' }}
            >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 mt-1 rounded-lg shadow-xl z-50 p-2 grid grid-cols-4 gap-1"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', minWidth: 120 }}
                >
                    {HIGHLIGHT_COLORS.map(c => (
                        <button
                            key={c.value}
                            type="button"
                            title={c.label}
                            onClick={() => {
                                setActiveColor(c.value)
                                editor.chain().focus().setHighlight({ color: c.value }).run()
                                setOpen(false)
                            }}
                            className="w-6 h-6 rounded cursor-pointer hover:scale-110 transition-transform"
                            style={{
                                background: c.value,
                                border: c.value === currentColor ? '2px solid #7c3aed' : '2px solid transparent',
                                outline: 'none',
                            }}
                        />
                    ))}
                    <div className="col-span-4 mt-1 pt-1" style={{ borderTop: '1px solid var(--card-border)' }}>
                        <div className="relative w-full">
                            <input
                                type="color"
                                className="absolute inset-0 w-full h-6 opacity-0 cursor-pointer"
                                value={currentColor}
                                onChange={(e) => {
                                    setActiveColor(e.target.value)
                                    editor.chain().focus().setHighlight({ color: e.target.value }).run()
                                }}
                                title="Custom color"
                            />
                            <div className="w-full h-6 rounded text-xs flex items-center justify-center gap-1 hover:bg-[var(--overlay-medium)]" style={{ color: 'var(--text-tertiary)', border: '1px dashed var(--card-border)' }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                Custom
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function Toolbar({ editor, onImageUpload, onDrawingInsert }: { editor: Editor | null; onImageUpload: () => void; onDrawingInsert: () => void }) {
    const [, setTick] = useState(0)
    const [lastFontSize, setLastFontSize] = useState<string | null>(null)
    const docChangedRef = useRef(false)

    useEffect(() => {
        if (!editor) return
        const tickHandler = () => setTick(t => t + 1)

        const applyStoredMarks = () => {
            if (!lastFontSize || !editor.state.selection.empty) return
            const { schema, tr } = editor.state
            const textStyleMark = schema.marks.textStyle
            if (textStyleMark) {
                editor.view.dispatch(tr.setStoredMarks([textStyleMark.create({ fontSize: `${lastFontSize}px` })]))
            }
        }

        const updateHandler = () => {
            // Content changed — flag so selectionUpdate doesn't overwrite state
            docChangedRef.current = true
            const fontSize = editor.getAttributes('textStyle')?.fontSize
            if (!fontSize) applyStoredMarks()
        }

        const selectionHandler = () => {
            if (docChangedRef.current) {
                // Selection moved due to content change (delete/type) — don't overwrite state
                docChangedRef.current = false
                return
            }
            // Pure navigation — update state from cursor position
            const fontSize = editor.getAttributes('textStyle')?.fontSize
            if (fontSize) {
                setLastFontSize(fontSize.replace('px', ''))
            } else {
                applyStoredMarks()
            }
        }

        editor.on('update', updateHandler)
        editor.on('selectionUpdate', selectionHandler)
        editor.on('transaction', tickHandler)
        return () => {
            editor.off('update', updateHandler)
            editor.off('selectionUpdate', selectionHandler)
            editor.off('transaction', tickHandler)
        }
    }, [editor, lastFontSize])

    const storedFontSize = editor?.state.storedMarks?.find(m => m.type.name === 'textStyle')?.attrs?.fontSize?.replace('px', '')
    const currentFontSize = editor?.getAttributes('textStyle')?.fontSize?.replace('px', '') || storedFontSize || lastFontSize || '16'

    // Keep cursor height in sync with current font size on empty paragraphs
    useEffect(() => {
        if (!editor) return
        const el = editor.view.dom.closest('.tiptap-editor') as HTMLElement | null
        el?.style.setProperty('--editor-cursor-size', `${currentFontSize}px`)
    })

    if (!editor) return null

    const currentHeading =
        editor.isActive('heading', { level: 1 }) ? 'H1' :
        editor.isActive('heading', { level: 2 }) ? 'H2' :
        editor.isActive('heading', { level: 3 }) ? 'H3' :
        'Normal'

    return (
        <div
            className="flex items-center gap-0.5 px-3 py-2 flex-wrap"
            style={{ borderBottom: '1px solid var(--card-border)' }}
        >
            {/* Undo / Redo */}
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/></svg>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-5.64-11.36L23 10"/></svg>
            </ToolbarButton>

            <Divider />

            {/* Headings */}
            <Dropdown
                value={currentHeading}
                options={[
                    { label: 'Normal', value: 'paragraph' },
                    { label: 'H1', value: '1' },
                    { label: 'H2', value: '2' },
                    { label: 'H3', value: '3' },
                ]}
                onChange={(val) => {
                    if (val === 'paragraph') {
                        editor.chain().focus().setParagraph().run()
                    } else {
                        editor.chain().focus().toggleHeading({ level: parseInt(val) as 1 | 2 | 3 }).run()
                    }
                }}
                title="Heading level"
                width="w-20"
            />

            {/* Font size */}
            <FontSizeInput
                value={currentFontSize}
                onChange={(val) => {
                    setLastFontSize(val)
                    editor.chain().focus().setFontSize(`${val}px`).run()
                    // Update CSS var immediately so empty-paragraph caret reflects new size
                    const el = editor.view.dom.closest('.tiptap-editor') as HTMLElement | null
                    el?.style.setProperty('--editor-cursor-size', `${val}px`)
                }}
            />

            {/* Font family */}
            <FontFamilyDropdown editor={editor} />

            <Divider />

            {/* Text formatting */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
                <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
                <em>I</em>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
                <span className="underline">U</span>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
                <span className="line-through">S</span>
            </ToolbarButton>

            <Divider />

            {/* Text color */}
            <div className="relative">
                <input
                    type="color"
                    className="absolute inset-0 w-8 h-8 opacity-0 cursor-pointer"
                    onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                    title="Text color"
                />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold cursor-pointer hover:bg-[var(--overlay-medium)]"
                    style={{ color: editor.getAttributes('textStyle')?.color || 'var(--body-text)' }}>
                    A
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                        style={{ background: editor.getAttributes('textStyle')?.color || 'var(--body-text)' }} />
                </div>
            </div>
            {/* Highlight color picker */}
            <HighlightPicker editor={editor} />

            <Divider />

            {/* Alignment */}
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
            </ToolbarButton>

            <Divider />

            {/* Lists */}
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/></svg>
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none">1</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none">2</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none">3</text></svg>
            </ToolbarButton>

            <Divider />

            {/* Table — insert only */}
            <ToolbarButton
                onClick={() => {
                    // Move cursor to the end first to avoid replacing a selected image/drawing node
                    editor.commands.focus('end')
                    editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
                }}
                title="Insert table"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            </ToolbarButton>

            <Divider />

            {/* Image */}
            <ToolbarButton onClick={onImageUpload} title="Insert image">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </ToolbarButton>

            {/* Horizontal rule */}
            <ToolbarButton onClick={() => { editor.commands.focus('end'); editor.chain().setHorizontalRule().run() }} title="Horizontal rule">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/></svg>
            </ToolbarButton>

            {/* Code block */}
            <ToolbarButton onClick={() => { editor.commands.focus('end'); editor.chain().toggleCodeBlock().run() }} active={editor.isActive('codeBlock')} title="Code block">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </ToolbarButton>

            <Divider />

            {/* Drawing */}
            <ToolbarButton onClick={onDrawingInsert} title="Insert drawing">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
            </ToolbarButton>
        </div>
    )
}
