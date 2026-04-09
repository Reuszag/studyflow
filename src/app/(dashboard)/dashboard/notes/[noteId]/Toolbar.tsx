'use client'

import { type Editor } from '@tiptap/react'
import { useState, useRef, useEffect } from 'react'

const FONT_SIZES = ['12', '14', '16', '18', '20', '24', '30', '36']

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

export default function Toolbar({ editor, onImageUpload, onDrawingInsert }: { editor: Editor | null; onImageUpload: () => void; onDrawingInsert: () => void }) {
    // Force re-render on editor state changes so heading/font size stay in sync
    const [, setTick] = useState(0)
    useEffect(() => {
        if (!editor) return
        const handler = () => setTick(t => t + 1)
        editor.on('selectionUpdate', handler)
        editor.on('transaction', handler)
        return () => {
            editor.off('selectionUpdate', handler)
            editor.off('transaction', handler)
        }
    }, [editor])

    if (!editor) return null

    const currentFontSize = editor.getAttributes('textStyle')?.fontSize?.replace('px', '') || '16'

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
            <Dropdown
                value={`${currentFontSize}px`}
                options={FONT_SIZES.map((s) => ({ label: `${s}px`, value: s }))}
                onChange={(val) => {
                    editor.chain().focus().setFontSize(`${val}px`).run()
                }}
                title="Font size"
                width="w-16"
            />

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
            <ToolbarButton
                onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                active={editor.isActive('highlight')}
                title="Highlight"
            >
                <span className="px-0.5 rounded" style={{ background: '#fef08a', color: '#000' }}>H</span>
            </ToolbarButton>

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
