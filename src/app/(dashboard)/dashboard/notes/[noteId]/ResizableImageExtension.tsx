'use client'

import { Node, mergeAttributes } from '@tiptap/react'
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'
import { useState, useRef, useEffect, useCallback } from 'react'

// ── Multi-select state (module-level, shared across all NodeViews) ──
const _multiSelectListeners = new Set<() => void>()
const _multiSelectedSrcs = new Set<string>()

export function toggleImageMultiSelect(src: string) {
  if (_multiSelectedSrcs.has(src)) {
    _multiSelectedSrcs.delete(src)
  } else {
    _multiSelectedSrcs.add(src)
  }
  _multiSelectListeners.forEach(fn => fn())
}

export function clearImageMultiSelect() {
  if (_multiSelectedSrcs.size === 0) return
  _multiSelectedSrcs.clear()
  _multiSelectListeners.forEach(fn => fn())
}

export function getMultiSelectedSrcs(): ReadonlySet<string> {
  return _multiSelectedSrcs
}

function useMultiSelected(src: string) {
  const [isSelected, setIsSelected] = useState(_multiSelectedSrcs.has(src))
  useEffect(() => {
    const listener = () => setIsSelected(_multiSelectedSrcs.has(src))
    _multiSelectListeners.add(listener)
    return () => { _multiSelectListeners.delete(listener) }
  }, [src])
  return isSelected
}

// ── Drag threshold (px) — below this is a click, above is a drag ──
const DRAG_THRESHOLD = 5

function ResizableImageView(props: ReactNodeViewProps) {
  const { node, updateAttributes, selected, editor, getPos } = props
  const isEditable = editor.isEditable
  const attrs = node.attrs as {
    src: string
    alt?: string
    title?: string
    width?: number | null
    posX?: number | null
    posY?: number | null
  }
  const [resizing, setResizing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startWidth, setStartWidth] = useState(0)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const width = attrs.width || undefined
  const posX = attrs.posX ?? 0
  const posY = attrs.posY ?? 0

  // Use the src as-is — proxy URLs should stay as proxy URLs (for shared users),
  // and public URLs work directly for the owner.
  const resolvedSrc = attrs.src || ''

  const isMultiSelected = useMultiSelected(resolvedSrc)

  // ── Resize ──
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return
    e.preventDefault()
    e.stopPropagation()
    setResizing(true)
    setStartX(e.clientX)
    setStartWidth(imgRef.current?.offsetWidth || 300)
  }, [isEditable])

  useEffect(() => {
    if (!resizing) return
    const onMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX
      const newWidth = Math.max(80, startWidth + diff)
      updateAttributes({ width: newWidth })
    }
    const onMouseUp = () => setResizing(false)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [resizing, startX, startWidth, updateAttributes])

  // ── Unified mouse handler: click vs drag ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return
    e.preventDefault()

    const mouseStartX = e.clientX
    const mouseStartY = e.clientY
    const nodePosX = posX
    const nodePosY = posY
    let isDragging = false
    let lastUpdate = 0

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - mouseStartX
      const dy = moveEvent.clientY - mouseStartY

      if (!isDragging) {
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          isDragging = true
          setDragging(true)
          // Clear multi-select when starting a drag
          clearImageMultiSelect()
        }
        return
      }

      // Actual drag movement
      const editorEl = wrapperRef.current?.closest('.tiptap-editor-canvas')
      const maxX = editorEl ? editorEl.clientWidth - (attrs.width || 300) : 2000
      const maxY = editorEl ? editorEl.scrollHeight - 50 : 5000
      const newX = Math.max(0, Math.min(nodePosX + dx, maxX))
      const newY = Math.max(0, Math.min(nodePosY + dy, maxY))
      
      // Update DOM style directly for immediate smooth feedback
      if (wrapperRef.current) {
        wrapperRef.current.style.left = `${newX}px`
        wrapperRef.current.style.top = `${newY}px`
      }

      // Throttled update for real-time sync with other users
      const now = Date.now()
      if (now - lastUpdate >= 100) {
        lastUpdate = now
        try {
          const pos = getPos()
          if (typeof pos === 'number' && editor) {
            const { tr } = editor.state
            const currentNode = editor.state.doc.nodeAt(pos)
            if (currentNode && currentNode.type.name === 'image') {
              tr.setNodeMarkup(pos, undefined, { 
                ...currentNode.attrs, 
                posX: Math.round(newX), 
                posY: Math.round(newY) 
              })
              // addToHistory: false avoids polluting undo/redo with every drag step
              editor.view.dispatch(tr.setMeta('addToHistory', false))
            }
          }
        } catch {}
      }
    }

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      if (isDragging) {
        setDragging(true) // Stay in dragging state for final update
        const dx = upEvent.clientX - mouseStartX
        const dy = upEvent.clientY - mouseStartY
        const editorEl = wrapperRef.current?.closest('.tiptap-editor-canvas')
        const maxX = editorEl ? editorEl.clientWidth - (attrs.width || 300) : 2000
        const maxY = editorEl ? editorEl.scrollHeight - 50 : 5000
        const newX = Math.max(0, Math.min(nodePosX + dx, maxX))
        const newY = Math.max(0, Math.min(nodePosY + dy, maxY))
        
        // Final update ensure it's captured (without throttle)
        updateAttributes({ posX: Math.round(newX), posY: Math.round(newY) })
        setDragging(false)
        return
      }

      // It was a click (no drag)
      const pos = getPos()
      if (typeof pos !== 'number') return

      if (upEvent.ctrlKey || upEvent.metaKey) {
        // Ctrl+Click: toggle multi-select
        toggleImageMultiSelect(resolvedSrc)
      } else {
        // Regular click: clear multi-select, select this node in ProseMirror
        clearImageMultiSelect()
        editor.commands.setNodeSelection(pos)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [isEditable, posX, posY, resolvedSrc, editor, getPos, updateAttributes, attrs.width])

  const isHighlighted = selected || isMultiSelected

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`resizable-image-wrapper ${selected ? 'ProseMirror-selectednode' : ''} ${isMultiSelected ? 'is-multi-selected' : ''} ${dragging ? 'is-dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${posX}px`,
        top: `${posY}px`,
        zIndex: isHighlighted ? 20 : 10,
        cursor: isEditable ? (dragging ? 'grabbing' : 'grab') : 'default',
        width: width ? `${width}px` : 'auto',
      }}
      data-drag-handle={isEditable ? true : undefined}
    >
      {/* Loading shimmer */}
      {!imgLoaded && !imgError && (
        <div
          style={{
            width: width ? `${width}px` : '300px',
            height: '200px',
            borderRadius: '0.75rem',
            background: 'linear-gradient(90deg, var(--card-bg) 25%, var(--card-bg-alt) 50%, var(--card-bg) 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      )}
      {/* Error state */}
      {imgError && (
        <div
          style={{
            width: width ? `${width}px` : '300px',
            height: '120px',
            borderRadius: '0.75rem',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'var(--muted-text)',
            fontSize: '13px',
          }}
        >
          <span>⚠️ Image failed to load</span>
          <button
            onClick={() => { setImgError(false); setImgLoaded(false) }}
            style={{
              fontSize: '12px',
              padding: '4px 12px',
              borderRadius: '6px',
              background: 'var(--hover-overlay)',
              border: '1px solid var(--card-border)',
              color: 'var(--body-text)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
      {resolvedSrc && (
        <img
          ref={imgRef}
          src={resolvedSrc}
          alt={attrs.alt || ''}
          title={attrs.title || ''}
          onMouseDown={isEditable ? handleMouseDown : undefined}
          onLoad={() => { setImgLoaded(true); setImgError(false) }}
          onError={() => { setImgError(true); setImgLoaded(false) }}
          style={{
            width: '100%',
            userSelect: 'none',
            pointerEvents: 'auto',
            display: imgError ? 'none' : 'block',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
          draggable={false}
        />
      )}
      {isEditable && imgLoaded && (
        <div
          className="resize-handle resize-handle-br"
          onMouseDown={onResizeStart}
          contentEditable={false}
        />
      )}
    </NodeViewWrapper>
  )
}

export const ResizableImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      posX: { default: 0 },
      posY: { default: 0 },
    }
  },

  parseHTML() {
    return [{
      tag: 'img[src]',
      getAttrs: (dom) => {
        const el = dom as HTMLElement
        return {
          src: el.getAttribute('src'),
          alt: el.getAttribute('alt'),
          title: el.getAttribute('title'),
          width: el.getAttribute('data-width') ? Number(el.getAttribute('data-width')) : null,
          posX: el.getAttribute('data-pos-x') ? Number(el.getAttribute('data-pos-x')) : 0,
          posY: el.getAttribute('data-pos-y') ? Number(el.getAttribute('data-pos-y')) : 0,
        }
      },
    }]
  },

  renderHTML({ HTMLAttributes }) {
    const { posX, posY, width, ...rest } = HTMLAttributes
    return ['img', mergeAttributes(rest, {
      'data-pos-x': posX,
      'data-pos-y': posY,
      'data-width': width,
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },

  addCommands() {
    return {
      setImage: (options: { src: string; alt?: string; title?: string; width?: number; posX?: number; posY?: number }) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },
})
