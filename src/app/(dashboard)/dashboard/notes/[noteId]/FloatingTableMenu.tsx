'use client'

import { useEffect, useState, useRef } from 'react'
import { type Editor } from '@tiptap/react'

export default function FloatingTableMenu({ editor }: { editor: Editor | null }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return

    const update = () => {
      if (editor.isActive('table')) {
        // Find the table DOM element
        const { state } = editor.view
        const { from } = state.selection
        const domAtPos = editor.view.domAtPos(from)
        let node = domAtPos.node as HTMLElement
        while (node && node.tagName !== 'TABLE') {
          node = node.parentElement as HTMLElement
        }
        if (node && node.tagName === 'TABLE') {
          const rect = node.getBoundingClientRect()
          const editorRect = editor.view.dom.closest('.tiptap-editor')?.getBoundingClientRect()
          if (editorRect) {
            setPos({
              top: rect.top - editorRect.top,
              left: rect.left - editorRect.left,
              width: rect.width,
              height: rect.height,
            })
          }
          setVisible(true)
        }
      } else {
        setVisible(false)
        setShowMenu(false)
      }
    }

    editor.on('selectionUpdate', update)
    editor.on('update', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
    }
  }, [editor])

  // Close menu on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!editor || !visible) return null

  return (
    <>
      {/* Add column button (right side of table) */}
      <button
        className="table-floating-btn"
        style={{
          position: 'absolute',
          top: `${pos.top + pos.height / 2 - 10}px`,
          left: `${pos.left + pos.width + 4}px`,
          zIndex: 20,
        }}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        title="Add column"
      >
        +
      </button>

      {/* Add row button (bottom of table) */}
      <button
        className="table-floating-btn"
        style={{
          position: 'absolute',
          top: `${pos.top + pos.height + 4}px`,
          left: `${pos.left + pos.width / 2 - 10}px`,
          zIndex: 20,
        }}
        onClick={() => editor.chain().focus().addRowAfter().run()}
        title="Add row"
      >
        +
      </button>

      {/* Table options menu button (top-right corner) */}
      <div ref={menuRef}>
        <button
          className="table-floating-btn"
          style={{
            position: 'absolute',
            top: `${pos.top - 12}px`,
            left: `${pos.left + pos.width - 12}px`,
            zIndex: 20,
            width: 22,
            height: 22,
            fontSize: 11,
          }}
          onClick={() => setShowMenu(!showMenu)}
          title="Table options"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>

        {showMenu && (
          <div
            className="absolute rounded-xl shadow-2xl py-1.5 z-50"
            style={{
              top: `${pos.top - 12 + 28}px`,
              left: `${pos.left + pos.width - 140}px`,
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              minWidth: 140,
            }}
          >
            {[
              { label: 'Add column before', action: () => editor.chain().focus().addColumnBefore().run() },
              { label: 'Add column after', action: () => editor.chain().focus().addColumnAfter().run() },
              { label: 'Add row before', action: () => editor.chain().focus().addRowBefore().run() },
              { label: 'Add row after', action: () => editor.chain().focus().addRowAfter().run() },
              { label: 'Delete column', action: () => editor.chain().focus().deleteColumn().run(), danger: true },
              { label: 'Delete row', action: () => editor.chain().focus().deleteRow().run(), danger: true },
              { label: 'Delete table', action: () => editor.chain().focus().deleteTable().run(), danger: true },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => { item.action(); setShowMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--overlay-medium)] transition-colors cursor-pointer"
                style={{ color: item.danger ? '#f87171' : 'var(--body-text)' }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
