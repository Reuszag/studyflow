'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { Editor } from '@tiptap/react'

interface RowCtrl { top: number; left: number; height: number; idx: number }
interface ColCtrl { top: number; left: number; idx: number }
interface Tooltip { x: number; y: number; lines: string[] }
interface TableMoveHandle { top: number; left: number }

const GHOST_ID = '__tbl-drag-ghost__'
const COL_CTRL_WIDTH = 66
const NOTESHEET_TOP_SAFE_GAP = 14

export default function TableControls({
    editor,
    containerRef,
    hidden = false,
}: {
    editor: Editor | null
    containerRef: React.RefObject<HTMLDivElement | null>
    hidden?: boolean
}) {
    const [rowCtrl, setRowCtrl] = useState<RowCtrl | null>(null)
    const [colCtrl, setColCtrl] = useState<ColCtrl | null>(null)
    const [ctrlLeft, setCtrlLeft] = useState(0)
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
    const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set())
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
    const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isTableMoveDragging, setIsTableMoveDragging] = useState(false)
    const [tooltip, setTooltip] = useState<Tooltip | null>(null)
    const [tableMoveHandle, setTableMoveHandle] = useState<TableMoveHandle | null>(null)
    const [, forceUpdate] = useState(0)

    const tableElRef = useRef<HTMLTableElement | null>(null)
    const tablePmRef = useRef<{ node: any; pos: number } | null>(null)
    const dragFromRef = useRef<number | null>(null)
    const dragOverRef = useRef<number | null>(null)
    const dragColFromRef = useRef<number | null>(null)
    const dragColOverRef = useRef<number | null>(null)
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const overControlsRef = useRef(false)

    const getContainerRect = useCallback(() => {
        return containerRef.current?.getBoundingClientRect() ?? null
    }, [containerRef])

    const getColumnControlTop = useCallback((tableEl: HTMLTableElement) => {
        const tableRect = tableEl.getBoundingClientRect()
        const containerRect = getContainerRect()

        const minTop = (containerRect?.top ?? 0) + NOTESHEET_TOP_SAFE_GAP
        const maxTopBase = (containerRect?.bottom ?? window.innerHeight) - 28
        const maxTop = Math.max(minTop, maxTopBase)
        const preferredTop = tableRect.top - 28

        return Math.min(Math.max(preferredTop, minTop), maxTop)
    }, [getContainerRect])

    const clearControls = useCallback(() => {
        setRowCtrl(null)
        setColCtrl(null)
        setTooltip(null)
        setTableMoveHandle(null)
    }, [])

    const cachePmTable = useCallback((tableEl: HTMLTableElement) => {
        if (!editor) return
        try {
            editor.state.doc.descendants((node: any, pos: number) => {
                if (node.type.name !== 'table') return
                try {
                    const dom = editor.view.nodeDOM(pos) as HTMLElement | null
                    if (dom && (dom === tableEl || dom.contains(tableEl) || tableEl.closest('[data-node-view-wrapper]') === dom)) {
                        tablePmRef.current = { node, pos }
                        return false
                    }
                } catch {}
            })
        } catch {}
    }, [editor])

    const recalc = useCallback((
        tableEl: HTMLTableElement,
        tr: HTMLTableRowElement | null,
        cell: HTMLElement | null,
    ) => {
        const wrapper = (tableEl.closest('.tableWrapper') as HTMLElement) ?? tableEl
        const wrapperRect = wrapper.getBoundingClientRect()
        const containerRect = getContainerRect()

        tableElRef.current = tableEl
        cachePmTable(tableEl)

        const left = wrapperRect.left - 78
        setCtrlLeft(left)

        // Table move handle — top-left corner of the wrapper
        setTableMoveHandle({
            top: wrapperRect.top - 22,
            left: wrapperRect.left - 22,
        })

        if (tr) {
            const rows = Array.from(tableEl.querySelectorAll('tr'))
            const idx = rows.indexOf(tr)
            if (idx >= 0) {
                const rowRect = tr.getBoundingClientRect()
                setRowCtrl({ top: rowRect.top, left, height: rowRect.height, idx })
            }
        } else {
            setRowCtrl(null)
        }

        if (cell) {
            const row = cell.closest('tr')
            const idx = row ? Array.from(row.children).indexOf(cell) : -1
            if (idx >= 0) {
                const cellRect = cell.getBoundingClientRect()
                const colLeftRaw = cellRect.left + (cellRect.width / 2) - (COL_CTRL_WIDTH / 2)
                const minColLeft = (containerRect?.left ?? 0) + 4
                const maxColLeftBase = (containerRect?.right ?? window.innerWidth) - COL_CTRL_WIDTH - 4
                const maxColLeft = Math.max(minColLeft, maxColLeftBase)
                const colLeft = Math.min(Math.max(colLeftRaw, minColLeft), maxColLeft)

                setColCtrl({
                    top: getColumnControlTop(tableEl),
                    left: colLeft,
                    idx,
                })
                return
            }
        }
        setColCtrl(null)
    }, [cachePmTable, getContainerRect, getColumnControlTop])

    function focusRow(idx: number) {
        const tableEl = tableElRef.current
        if (!tableEl || !editor) return
        const cell = (tableEl.querySelectorAll('tr')[idx] as HTMLTableRowElement)?.cells[0]
        if (!cell) return
        try {
            const pos = editor.view.posAtDOM(cell, 0)
            editor.chain().setTextSelection(pos).run()
            setTimeout(() => cachePmTable(tableEl), 0)
        } catch {}
    }

    function focusColumn(idx: number) {
        const tableEl = tableElRef.current
        if (!tableEl || !editor) return
        const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
        const cell = firstRow?.cells[idx]
        if (!cell) return
        try {
            const pos = editor.view.posAtDOM(cell, 0)
            editor.chain().setTextSelection(pos).run()
            setTimeout(() => cachePmTable(tableEl), 0)
        } catch {}
    }

    function moveRow(from: number, to: number) {
        if (from === to || !editor) return
        const stored = tablePmRef.current
        if (!stored) return
        let tableNode: any = null, tablePos = -1
        try {
            const node = editor.state.doc.nodeAt(stored.pos)
            if (node?.type.name === 'table') { tableNode = node; tablePos = stored.pos }
        } catch {}
        if (!tableNode || tablePos < 0) return
        const rows: any[] = []
        tableNode.forEach((r: any) => rows.push(r))
        if (from >= rows.length || to >= rows.length) return
        const [moved] = rows.splice(from, 1)
        rows.splice(to, 0, moved)
        const newTable = tableNode.type.create(tableNode.attrs, rows)
        editor.view.dispatch(editor.state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable))
        tablePmRef.current = { node: newTable, pos: tablePos }
    }

    function moveColumn(from: number, to: number) {
        if (from === to || !editor) return
        const stored = tablePmRef.current
        if (!stored) return

        let tableNode: any = null
        let tablePos = -1
        try {
            const node = editor.state.doc.nodeAt(stored.pos)
            if (node?.type.name === 'table') {
                tableNode = node
                tablePos = stored.pos
            }
        } catch {}

        if (!tableNode || tablePos < 0) return

        const newRows: any[] = []
        let valid = true
        tableNode.forEach((rowNode: any) => {
            const cells: any[] = []
            rowNode.forEach((cellNode: any) => cells.push(cellNode))

            if (from >= cells.length || to >= cells.length) {
                valid = false
                return
            }

            const [moved] = cells.splice(from, 1)
            cells.splice(to, 0, moved)
            newRows.push(rowNode.type.create(rowNode.attrs, cells))
        })

        if (!valid || newRows.length === 0) return

        const newTable = tableNode.type.create(tableNode.attrs, newRows)
        editor.view.dispatch(editor.state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable))
        tablePmRef.current = { node: newTable, pos: tablePos }
    }

    function startTableMoveDrag(e: React.PointerEvent) {
        e.preventDefault()
        e.stopPropagation()
        setTooltip(null)

        const stored = tablePmRef.current
        if (!stored || !editor) return

        const tableEl = tableElRef.current
        if (!tableEl) return

        const wrapper = (tableEl.closest('.tableWrapper') as HTMLElement) ?? tableEl
        const tiptapEl = containerRef.current?.querySelector('.tiptap') as HTMLElement | null
        const scrollEl = containerRef.current

        // Current free position stored in node attrs (null = not yet free-positioned)
        const tableNode = editor.state.doc.nodeAt(stored.pos)
        const startPosX: number = (tableNode?.attrs?.posX ?? null) !== null ? tableNode!.attrs.posX : (() => {
            const tRect = tiptapEl?.getBoundingClientRect()
            const wRect = wrapper.getBoundingClientRect()
            return tRect ? Math.round(wRect.left - tRect.left) : 0
        })()
        const startPosY: number = (tableNode?.attrs?.posY ?? null) !== null ? tableNode!.attrs.posY : (() => {
            const tRect = tiptapEl?.getBoundingClientRect()
            const wRect = wrapper.getBoundingClientRect()
            // Both rects are viewport-relative; difference gives offset within tiptap
            // Add scrollTop to convert to document position within tiptap
            return tRect ? Math.round(wRect.top - tRect.top + (scrollEl?.scrollTop ?? 0)) : 0
        })()

        const mouseStartX = e.clientX
        const mouseStartY = e.clientY

        setIsDragging(true)
        setIsTableMoveDragging(true)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'

        let lastUpdate = 0
        function throttledUpdateAttrs(x: number, y: number) {
            const now = Date.now()
            if (now - lastUpdate < 100) return
            lastUpdate = now

            try {
                const s = tablePmRef.current
                if (!s || !editor) return
                const node = editor.state.doc.nodeAt(s.pos)
                if (!node || node.type.name !== 'table') return
                const { tr } = editor.state
                tr.setNodeMarkup(s.pos, undefined, { ...node.attrs, posX: Math.round(x), posY: Math.round(y) })
                // Use addToHistory: false to avoid polluting undo/redo with every drag step
                editor.view.dispatch(tr.setMeta('addToHistory', false))
            } catch {}
        }

        function onMove(ev: PointerEvent) {
            const dx = ev.clientX - mouseStartX
            const dy = ev.clientY - mouseStartY

            const tRect = tiptapEl?.getBoundingClientRect()
            const tiptapW = tiptapEl?.scrollWidth ?? 2000
            const tiptapH = tiptapEl?.scrollHeight ?? 5000
            const tableW = wrapper.offsetWidth || 300
            const tableH = wrapper.offsetHeight || 100

            // Clamp within notesheet
            const MARGIN = 8
            const newX = Math.max(MARGIN, Math.min(startPosX + dx, tiptapW - tableW - MARGIN))
            const newY = Math.max(MARGIN, Math.min(startPosY + dy, tiptapH - tableH - MARGIN))

            // Update wrapper style directly for smooth live drag
            wrapper.style.position = 'absolute'
            wrapper.style.left = `${newX}px`
            wrapper.style.top = `${newY}px`
            wrapper.style.margin = '0'
            wrapper.style.zIndex = '15'

            // Update move handle position (viewport coords)
            if (tRect) {
                setTableMoveHandle({
                    top: tRect.top + newY - 22,
                    left: tRect.left + newX - 22,
                })
            }

            // Real-time update for view-only users
            throttledUpdateAttrs(newX, newY)
        }

        function onUp(ev: PointerEvent) {
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            setIsDragging(false)
            setIsTableMoveDragging(false)

            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('pointercancel', onUp)

            // Compute final position from wrapper's current style
            const finalX = parseFloat(wrapper.style.left) || startPosX
            const finalY = parseFloat(wrapper.style.top) || startPosY

            // Final persist into ProseMirror node attrs (ensure history is captured for the final drop)
            try {
                const s = tablePmRef.current
                if (!s || !editor) return
                const node = editor.state.doc.nodeAt(s.pos)
                if (!node || node.type.name !== 'table') return
                const { tr } = editor.state
                tr.setNodeMarkup(s.pos, undefined, { ...node.attrs, posX: Math.round(finalX), posY: Math.round(finalY) })
                editor.view.dispatch(tr)
            } catch {}
        }

        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('pointercancel', onUp)
    }

    function deleteSelectedRows() {
        const stored = tablePmRef.current
        if (!stored || !editor || selectedRows.size === 0) return
        let tableNode: any = null, tablePos = -1
        try {
            const node = editor.state.doc.nodeAt(stored.pos)
            if (node?.type.name === 'table') { tableNode = node; tablePos = stored.pos }
        } catch {}
        if (!tableNode || tablePos < 0) return
        const rows: any[] = []
        let i = 0
        tableNode.forEach((r: any) => { if (!selectedRows.has(i++)) rows.push(r) })
        if (rows.length === 0) editor.chain().focus().deleteTable().run()
        else {
            const newTable = tableNode.type.create(tableNode.attrs, rows)
            editor.view.dispatch(editor.state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable))
            tablePmRef.current = { node: newTable, pos: tablePos }
        }
        setSelectedRows(new Set())
    }

    function deleteSelectedColumns() {
        const stored = tablePmRef.current
        if (!stored || !editor || selectedCols.size === 0) return
        let tableNode: any = null
        let tablePos = -1
        try {
            const node = editor.state.doc.nodeAt(stored.pos)
            if (node?.type.name === 'table') {
                tableNode = node
                tablePos = stored.pos
            }
        } catch {}
        if (!tableNode || tablePos < 0) return

        const selected = [...selectedCols].sort((a, b) => b - a)
        const newRows: any[] = []

        tableNode.forEach((rowNode: any) => {
            const cells: any[] = []
            rowNode.forEach((cellNode: any) => cells.push(cellNode))
            for (const idx of selected) {
                if (idx >= 0 && idx < cells.length) cells.splice(idx, 1)
            }
            if (cells.length > 0) {
                newRows.push(rowNode.type.create(rowNode.attrs, cells))
            }
        })

        if (newRows.length === 0) {
            editor.chain().focus().deleteTable().run()
        } else {
            const newTable = tableNode.type.create(tableNode.attrs, newRows)
            editor.view.dispatch(editor.state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable))
            tablePmRef.current = { node: newTable, pos: tablePos }
        }

        setSelectedCols(new Set())
    }

    // Clean up controls if the tracked table is deleted
    useEffect(() => {
        if (!editor) return
        function checkTableGone() {
            // Check if any table node exists in the doc at all
            let hasTable = false
            try {
                editor!.state.doc.descendants((node: any) => {
                    if (node.type.name === 'table') { hasTable = true; return false }
                })
            } catch {}

            if (!hasTable) {
                tableElRef.current = null
                tablePmRef.current = null
                clearControls()
                setSelectedRows(new Set())
                setSelectedCols(new Set())
                return
            }

            // Tracked table's DOM node gone from document
            if (tableElRef.current && !document.contains(tableElRef.current)) {
                tableElRef.current = null
                tablePmRef.current = null
                clearControls()
                setSelectedRows(new Set())
                setSelectedCols(new Set())
            }
        }

        editor.on('update', checkTableGone)
        return () => {
            editor.off('update', checkTableGone)
        }
    }, [editor, clearControls])

    // Document-level mouse tracking — catches mouse between table and controls panel
    useEffect(() => {
        if (hidden) {
            clearControls()
            return
        }

        function onMove(e: MouseEvent) {
            if (isDragging) return

            const target = e.target
            const el = target instanceof Element ? target : null
            const onCtrl = !!el?.closest('[data-tbl-ctrl="1"]')
            if (onCtrl) {
                overControlsRef.current = true
                if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
                return
            }
            overControlsRef.current = false

            const tableEl = el?.closest('table') as HTMLTableElement | null

            if (!tableEl) {
                if (!hideTimerRef.current) {
                    hideTimerRef.current = setTimeout(() => {
                        if (!overControlsRef.current) clearControls()
                        hideTimerRef.current = null
                    }, 350)
                }
                return
            }

            // Only care about tables inside the editor
            const editorRoot = containerRef.current?.querySelector('.tiptap')
            if (!editorRoot?.contains(tableEl)) { clearControls(); return }

            if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }

            const rowEl = el?.closest('tr') as HTMLTableRowElement | null
            let cellEl = el?.closest('td,th') as HTMLElement | null
            if (!cellEl) {
                const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
                const fallbackIdx = colCtrl?.idx ?? Math.max(0, (firstRow?.cells.length ?? 1) - 1)
                cellEl = (firstRow?.cells[fallbackIdx] as HTMLElement | undefined) ?? (firstRow?.lastElementChild as HTMLElement | null)
            }

            recalc(
                tableEl,
                rowEl,
                cellEl,
            )
        }

        function onScroll() {
            const tableEl = tableElRef.current
            if (tableEl) {
                const rows = tableEl.querySelectorAll('tr')
                const tr = rowCtrl ? (rows[rowCtrl.idx] as HTMLTableRowElement | undefined) ?? null : null
                const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
                const selectedIdx = selectedCols.size > 0 ? [...selectedCols].sort((a, b) => a - b)[0] : null
                const targetColIdx = colCtrl?.idx ?? selectedIdx
                const cell = targetColIdx != null ? (firstRow?.cells[targetColIdx] as HTMLElement | undefined) ?? null : null
                recalc(tableEl, tr, cell)
            }
            forceUpdate(n => n + 1)
        }

        document.addEventListener('mousemove', onMove)
        window.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        containerRef.current?.addEventListener('scroll', onScroll)
        const c = containerRef.current
        return () => {
            document.removeEventListener('mousemove', onMove)
            window.removeEventListener('scroll', onScroll, true)
            window.removeEventListener('resize', onScroll)
            c?.removeEventListener('scroll', onScroll)
        }
    }, [recalc, clearControls, isDragging, containerRef, rowCtrl, colCtrl, selectedCols, hidden])

    // Drop-target highlight
    useEffect(() => {
        const tableEl = tableElRef.current
        if (!tableEl) return
        const rows = Array.from(tableEl.querySelectorAll('tr')) as HTMLTableRowElement[]
        rows.forEach((r, i) => {
            r.style.outline = i === dragOverIdx ? '2px solid var(--accent)' : ''
            r.style.outlineOffset = i === dragOverIdx ? '-1px' : ''
        })
    }, [dragOverIdx])

    // Column drag highlight (all cells in target column)
    useEffect(() => {
        const tableEl = tableElRef.current
        if (!tableEl) return

        const rows = Array.from(tableEl.querySelectorAll('tr')) as HTMLTableRowElement[]
        rows.forEach((row) => {
            Array.from(row.cells).forEach((cell, idx) => {
                const active = idx === dragOverColIdx
                cell.style.outline = active ? '2px solid var(--accent)' : ''
                cell.style.outlineOffset = active ? '-1px' : ''
                // Fallback inner ring so highlight remains visible on collapsed table borders.
                // Add outer glow to make drag target obvious across both themes.
                cell.style.boxShadow = ''
                cell.style.borderColor = ''
            })
        })
    }, [dragOverColIdx])

    function addColumnAt(columnIdx: number, addLeft: boolean) {
        focusColumn(columnIdx)

        setTimeout(() => {
            if (addLeft) editor?.chain().focus().addColumnBefore().run()
            else editor?.chain().focus().addColumnAfter().run()

            requestAnimationFrame(() => {
                const activeTable = tableElRef.current
                if (!activeTable) return

                const firstRow = activeTable.querySelector('tr') as HTMLTableRowElement | null
                const targetIdx = addLeft
                    ? columnIdx
                    : Math.min(columnIdx + 1, (firstRow?.cells.length ?? 1) - 1)
                const targetCell = firstRow?.cells[targetIdx] as HTMLElement | undefined

                const row = activeTable.querySelectorAll('tr')[rowCtrl?.idx ?? 0] as HTMLTableRowElement | undefined
                recalc(activeTable, row ?? null, targetCell ?? null)

                const activeWrapper = (activeTable.closest('.tableWrapper') as HTMLElement) ?? activeTable
                const scroller = containerRef.current
                if (scroller) {
                    const wrapperRight = activeWrapper.offsetLeft + activeWrapper.offsetWidth
                    const visibleRight = scroller.scrollLeft + scroller.clientWidth
                    if (wrapperRight + 40 > visibleRight) {
                        scroller.scrollTo({
                            left: wrapperRight - scroller.clientWidth + 40,
                            behavior: 'smooth',
                        })
                    }
                }
            })
        }, 10)
    }

    function createColumnGhost(e: React.PointerEvent, columnIdx: number) {
        const COL_GHOST_ID = '__tbl-col-drag-ghost__'
        document.getElementById(COL_GHOST_ID)?.remove()
        const tableEl = tableElRef.current
        if (!tableEl) return

        const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
        const srcCell = firstRow?.cells[columnIdx]
        if (!srcCell) return

        const cellRect = srcCell.getBoundingClientRect()
        const tableRect = tableEl.getBoundingClientRect()
        const offsetX = e.clientX - cellRect.left

        const rows = Array.from(tableEl.querySelectorAll('tr')) as HTMLTableRowElement[]

        const tbl = document.createElement('table')
        tbl.style.cssText = `border-collapse:collapse;width:${cellRect.width}px;table-layout:fixed;margin:0`
        const tbody = document.createElement('tbody')

        rows.forEach(row => {
            const cell = row.cells[columnIdx]
            if (!cell) return
            const clonedCell = cell.cloneNode(true) as HTMLElement
            clonedCell.querySelectorAll('button, input, textarea, [contenteditable]').forEach(el => el.remove())
            clonedCell.style.outline = ''
            clonedCell.style.outlineOffset = ''
            clonedCell.style.boxShadow = ''
            clonedCell.style.border = '1px solid rgba(128,128,128,0.25)'
            clonedCell.style.padding = '0.5rem 0.85rem'
            clonedCell.style.fontSize = '0.875rem'
            clonedCell.style.verticalAlign = 'top'
            clonedCell.style.color = 'var(--body-text)'
            clonedCell.style.background = 'transparent'
            clonedCell.style.overflow = 'hidden'
            clonedCell.style.whiteSpace = 'nowrap'
            clonedCell.style.textOverflow = 'ellipsis'
            const tr = document.createElement('tr')
            tr.appendChild(clonedCell)
            tbody.appendChild(tr)
        })

        tbl.appendChild(tbody)

        const ghost = document.createElement('div')
        ghost.id = COL_GHOST_ID
        ghost.dataset.offsetX = String(offsetX)
        ghost.appendChild(tbl)

        Object.assign(ghost.style, {
            position: 'fixed',
            left: `${cellRect.left}px`,
            top: `${tableRect.top}px`,
            width: `${cellRect.width}px`,
            height: `${tableRect.height}px`,
            borderRadius: '6px',
            border: '2px solid var(--accent)',
            boxShadow: 'none',
            opacity: '0.6',
            zIndex: '99999',
            pointerEvents: 'none',
            overflow: 'hidden',
            background: 'var(--card-bg)',
        })

        document.body.appendChild(ghost)
    }

    function startColumnDrag(e: React.PointerEvent, columnIdx: number) {
        e.preventDefault()
        e.stopPropagation()
        setTooltip(null)

        dragColFromRef.current = columnIdx
        dragColOverRef.current = columnIdx
        setDragOverColIdx(columnIdx)
        setIsDragging(true)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'

        createColumnGhost(e, columnIdx)

        const COL_GHOST_ID = '__tbl-col-drag-ghost__'

        function onMove(ev: PointerEvent) {
            const g = document.getElementById(COL_GHOST_ID)
            if (g) {
                g.style.left = `${ev.clientX - parseFloat(g.dataset.offsetX || '0')}px`
            }

            const tableEl = tableElRef.current
            if (!tableEl) return
            const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
            if (!firstRow) return
            const cells = Array.from(firstRow.cells)

            for (let i = 0; i < cells.length; i++) {
                const rect = cells[i].getBoundingClientRect()
                if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
                    if (dragColOverRef.current !== i) {
                        dragColOverRef.current = i
                        setDragOverColIdx(i)
                    }
                    return
                }
            }
        }

        function onUp() {
            document.getElementById(COL_GHOST_ID)?.remove()
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
            setIsDragging(false)

            const from = dragColFromRef.current
            const to = dragColOverRef.current
            const finalIdx = dragColOverRef.current

            if (from != null && to != null) {
                moveColumn(from, to)
            }

            dragColFromRef.current = null
            dragColOverRef.current = null
            setDragOverColIdx(null)

            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            document.removeEventListener('pointercancel', onUp)

            requestAnimationFrame(() => {
                const tableEl = tableElRef.current
                if (!tableEl) return
                const rows = tableEl.querySelectorAll('tr')
                const tr = (rowCtrl ? rows[rowCtrl.idx] : null) as HTMLTableRowElement | null
                const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
                const cell = (finalIdx != null ? firstRow?.cells[finalIdx] : null) as HTMLElement | null
                recalc(tableEl, tr, cell)
            })
        }

        document.addEventListener('pointermove', onMove)
        document.addEventListener('pointerup', onUp)
        document.addEventListener('pointercancel', onUp)
    }

    function createGhost(e: React.PointerEvent, rowIdx: number) {
        document.getElementById(GHOST_ID)?.remove()
        const tableEl = tableElRef.current
        if (!tableEl) return

        const srcRow = tableEl.querySelectorAll('tr')[rowIdx] as HTMLTableRowElement | undefined
        if (!srcRow) return

        const rowRect = srcRow.getBoundingClientRect()
        const wrapper = (tableEl.closest('.tableWrapper') as HTMLElement) ?? tableEl
        const wrapperRect = wrapper.getBoundingClientRect()
        const offsetY = e.clientY - rowRect.top

        const clonedRow = srcRow.cloneNode(true) as HTMLTableRowElement
        clonedRow.querySelectorAll('button, input, textarea, [contenteditable]').forEach(el => el.remove())
        clonedRow.style.outline = ''
        clonedRow.style.outlineOffset = ''

        // Apply inline cell styles so appearance is correct outside the editor DOM
        Array.from(clonedRow.querySelectorAll('td, th')).forEach(cell => {
            const c = cell as HTMLElement
            c.style.border = '1px solid rgba(128,128,128,0.25)'
            c.style.padding = '0.5rem 0.85rem'
            c.style.fontSize = '0.875rem'
            c.style.verticalAlign = 'top'
            c.style.color = 'var(--body-text)'
            c.style.background = 'transparent'
            c.style.overflow = 'hidden'
            c.style.whiteSpace = 'nowrap'
            c.style.textOverflow = 'ellipsis'
        })

        const tbl = document.createElement('table')
        tbl.style.cssText = `border-collapse:collapse;width:${rowRect.width}px;table-layout:fixed;margin:0`
        const tbody = document.createElement('tbody')
        tbody.appendChild(clonedRow)
        tbl.appendChild(tbody)

        const ghost = document.createElement('div')
        ghost.id = GHOST_ID
        ghost.dataset.offsetY = String(offsetY)
        ghost.appendChild(tbl)

        Object.assign(ghost.style, {
            position: 'fixed',
            // X aligned with table left — doesn't move horizontally
            left: `${wrapperRect.left}px`,
            top: `${e.clientY - offsetY}px`,
            width: `${rowRect.width}px`,
            borderRadius: '6px',
            border: '2px solid var(--accent)',
            boxShadow: 'none',
            opacity: '0.6',
            zIndex: '99999',
            pointerEvents: 'none',
            overflow: 'hidden',
            background: 'var(--card-bg)',
        })

        document.body.appendChild(ghost)
    }

    const ctrlHandlers = {
        onMouseEnter: () => {
            overControlsRef.current = true
            if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
        },
        onMouseLeave: () => {
            overControlsRef.current = false
            setTooltip(null)
            hideTimerRef.current = setTimeout(() => {
                if (!overControlsRef.current) clearControls()
                hideTimerRef.current = null
            }, 350)
        },
    }

    // Selected row checkbox positions (computed at render — position:fixed tracks viewport)
    const selectedRowRects = Array.from(selectedRows).map(idx => {
        const tableEl = tableElRef.current
        if (!tableEl) return null
        const tr = tableEl.querySelectorAll('tr')[idx] as HTMLTableRowElement | undefined
        if (!tr) return null
        const rect = tr.getBoundingClientRect()
        return { idx, top: rect.top, height: rect.height }
    }).filter(Boolean) as Array<{ idx: number; top: number; height: number }>

    const selectedColRects = Array.from(selectedCols).map(idx => {
        const tableEl = tableElRef.current
        if (!tableEl) return null
        const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
        const cell = firstRow?.cells[idx]
        if (!cell) return null
        const rect = cell.getBoundingClientRect()
        return { idx, centerX: rect.left + rect.width / 2 }
    }).filter(Boolean) as Array<{ idx: number; centerX: number }>

    const colControlTop = (() => {
        const tableEl = tableElRef.current
        if (!tableEl) return null
        return getColumnControlTop(tableEl)
    })()

    // Delete-row anchor — persists while rows selected even when hover controls hidden
    let deleteBtnPos: { top: number; left: number } | null = null
    if (selectedRows.size > 0 && tableElRef.current) {
        const wrapper = (tableElRef.current.closest('.tableWrapper') as HTMLElement) ?? tableElRef.current
        const wr = wrapper.getBoundingClientRect()
        const containerRect = getContainerRect()
        deleteBtnPos = { top: wr.bottom + 8, left: wr.left }
    }

    let deleteColsBtnPos: { top: number; left: number } | null = null
    if (selectedCols.size > 0 && tableElRef.current) {
        const tableRect = tableElRef.current.getBoundingClientRect()
        const containerRect = getContainerRect()
        // Only show when the table's right edge is visible (user scrolled to the end)
        if (!containerRect || tableRect.right <= containerRect.right + 4) {
            const firstRow = tableElRef.current.querySelector('tr') as HTMLTableRowElement | null
            const firstRowRect = firstRow?.getBoundingClientRect()
            const topBase = firstRowRect
                ? firstRowRect.top + Math.max(2, (firstRowRect.height - 28) / 2)
                : (colControlTop ?? tableRect.top) + 14
            const minTop = (containerRect?.top ?? 0) + NOTESHEET_TOP_SAFE_GAP
            const maxTopBase = (containerRect?.bottom ?? window.innerHeight) - 34
            const maxTop = Math.max(minTop, maxTopBase)
            const top = Math.min(Math.max(topBase, minTop), maxTop)
            deleteColsBtnPos = { top, left: tableRect.right + 12 }
        }
    }

    const rowDragOverlayRect = (() => {
        const tableEl = tableElRef.current
        if (!tableEl || dragOverIdx == null) return null
        const row = tableEl.querySelectorAll('tr')[dragOverIdx] as HTMLTableRowElement | undefined
        if (!row) return null

        const tableRect = tableEl.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()

        return {
            left: tableRect.left,
            top: rowRect.top,
            width: tableRect.width,
            height: rowRect.height,
        }
    })()

    const colDragOverlayRect = (() => {
        const tableEl = tableElRef.current
        if (!tableEl || dragOverColIdx == null) return null
        const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
        const cell = firstRow?.cells[dragOverColIdx]
        if (!cell) return null

        const tableRect = tableEl.getBoundingClientRect()
        const cellRect = cell.getBoundingClientRect()

        return {
            left: cellRect.left,
            top: tableRect.top,
            width: cellRect.width,
            height: tableRect.height,
        }
    })()

    const hasAnything = rowCtrl || colCtrl || selectedRowRects.length > 0 || selectedColRects.length > 0 || !!rowDragOverlayRect || !!colDragOverlayRect || !!tableMoveHandle
    if (!hasAnything) return null
    if (hidden) return null

    const checkboxStyle: React.CSSProperties = {
        width: 20, height: 20, flexShrink: 0,
        borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    }

    return (
        <>
            {/* Table move handle — top-left corner, like Word's move icon */}
            {tableMoveHandle && (
                <div
                    data-tbl-ctrl="1"
                    {...ctrlHandlers}
                    onPointerDown={startTableMoveDrag}
                    onMouseEnter={(e) => {
                        ctrlHandlers.onMouseEnter()
                        setTooltip({ x: e.clientX, y: e.clientY, lines: ['Drag to move table'] })
                    }}
                    onMouseLeave={() => {
                        ctrlHandlers.onMouseLeave()
                        setTooltip(null)
                    }}
                    style={{
                        position: 'fixed',
                        top: tableMoveHandle.top,
                        left: tableMoveHandle.left,
                        width: 20,
                        height: 20,
                        zIndex: 9999,
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 5,
                        color: 'var(--muted-text)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                        pointerEvents: isDragging ? 'none' : 'auto',
                    }}
                >
                    <MoveIcon />
                </div>
            )}

            {/* Row drag overlay highlight */}
            {rowDragOverlayRect && (
                <div
                    style={{
                        position: 'fixed',
                        left: rowDragOverlayRect.left,
                        top: rowDragOverlayRect.top,
                        width: rowDragOverlayRect.width,
                        height: rowDragOverlayRect.height,
                        pointerEvents: 'none',
                        zIndex: 9998,
                        outline: '2px solid var(--accent)',
                        outlineOffset: '-1px',
                        borderRadius: 2,
                        background: 'rgba(124, 58, 237, 0.14)',
                        boxShadow: 'none',
                    }}
                />
            )}

            {/* Column drag overlay highlight */}
            {colDragOverlayRect && (
                <div
                    style={{
                        position: 'fixed',
                        left: colDragOverlayRect.left,
                        top: colDragOverlayRect.top,
                        width: colDragOverlayRect.width,
                        height: colDragOverlayRect.height,
                        pointerEvents: 'none',
                        zIndex: 10000,
                        outline: '2px solid var(--accent)',
                        outlineOffset: '-1px',
                        borderRadius: 2,
                        background: 'rgba(124, 58, 237, 0.14)',
                        boxShadow: 'none',
                    }}
                />
            )}

            {/* Tooltip */}
            {tooltip && (
                <div style={{
                    position: 'fixed', top: tooltip.y + 28, left: tooltip.x - 8,
                    zIndex: 99999, pointerEvents: 'none',
                    background: 'rgba(15,15,15,0.9)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '6px 10px',
                    fontSize: 12, lineHeight: 1.6, color: '#e5e7eb',
                    whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                    {tooltip.lines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
            )}

            {/* Checkboxes for all selected rows not currently hovered */}
            {!isTableMoveDragging && selectedRowRects.map(({ idx, top, height }) => {
                if (idx === rowCtrl?.idx) return null
                return (
                    <div key={idx} data-tbl-ctrl="1" {...ctrlHandlers} style={{
                        position: 'fixed',
                        top,
                        left: ctrlLeft + 46,
                        height,
                        display: 'flex',
                        alignItems: 'center',
                        zIndex: 9999, pointerEvents: isDragging ? 'none' : 'auto',
                    }}>
                        <div
                            onClick={() => setSelectedRows(prev => { const next = new Set(prev); next.delete(idx); return next })}
                            style={{ ...checkboxStyle, background: 'var(--accent)', border: '1.5px solid var(--accent)' }}
                        >
                            <CheckIcon />
                        </div>
                    </div>
                )
            })}

            {/* Checkboxes for selected columns not currently hovered */}
            {!isTableMoveDragging && selectedColRects.map(({ idx, centerX }) => {
                if (colControlTop == null || idx === colCtrl?.idx) return null
                const containerRect = getContainerRect()
                const minLeft = (containerRect?.left ?? 0) + 4
                const maxLeftBase = (containerRect?.right ?? window.innerWidth) - 24
                const maxLeft = Math.max(minLeft, maxLeftBase)
                const clampedLeft = Math.min(Math.max(centerX - 10, minLeft), maxLeft)
                return (
                    <div key={`col-${idx}`} data-tbl-ctrl="1" {...ctrlHandlers} style={{
                        position: 'fixed',
                        top: colControlTop,
                        left: clampedLeft,
                        width: 20,
                        height: 20,
                        zIndex: 9999,
                        pointerEvents: isDragging ? 'none' : 'auto',
                    }}>
                        <div
                            onClick={() => setSelectedCols(prev => { const next = new Set(prev); next.delete(idx); return next })}
                            style={{ ...checkboxStyle, background: 'var(--accent)', border: '1.5px solid var(--accent)' }}
                        >
                            <CheckIcon />
                        </div>
                    </div>
                )
            })}

            {/* Hovered row controls */}
            {rowCtrl && !isTableMoveDragging && (
                <div data-tbl-ctrl="1" {...ctrlHandlers} style={{
                    position: 'fixed', top: rowCtrl.top, left: rowCtrl.left, height: rowCtrl.height,
                    display: 'flex', alignItems: 'center', gap: 3,
                    zIndex: 9999, pointerEvents: isDragging ? 'none' : 'auto',
                }}>
                    {/* + add row */}
                    <Btn
                        onMouseDown={(e) => {
                            e.preventDefault()
                            overControlsRef.current = true
                            if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
                            focusRow(rowCtrl.idx)
                            const alt = e.getModifierState('Alt')
                            setTimeout(() => {
                                if (alt) editor?.chain().focus().addRowBefore().run()
                                else editor?.chain().focus().addRowAfter().run()
                                requestAnimationFrame(() => {
                                    const tableEl = tableElRef.current
                                    if (!tableEl) return
                                    const rows = tableEl.querySelectorAll('tr')
                                    const targetIdx = alt ? rowCtrl.idx : Math.min(rowCtrl.idx + 1, rows.length - 1)
                                    const tr = rows[targetIdx] as HTMLTableRowElement | undefined
                                    const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
                                    const cell = colCtrl ? (firstRow?.cells[colCtrl.idx] as HTMLElement | undefined) ?? null : null
                                    recalc(tableEl, tr ?? null, cell)
                                })
                            }, 10)
                        }}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, lines: ['Click  –  add row below', 'Alt-click  –  add row above'] })}
                        onMouseLeave={() => setTooltip(null)}
                    ><PlusIcon /></Btn>

                    {/* drag handle */}
                    <Btn
                        style={{ cursor: 'grab' }}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, lines: ['Drag to move row'] })}
                        onMouseLeave={() => setTooltip(null)}
                        onPointerDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setTooltip(null)
                            dragFromRef.current = rowCtrl.idx
                            dragOverRef.current = rowCtrl.idx
                            setIsDragging(true)
                            document.body.style.cursor = 'grabbing'
                            document.body.style.userSelect = 'none'

                            createGhost(e, rowCtrl.idx)

                            function onMove(ev: PointerEvent) {
                                const g = document.getElementById(GHOST_ID)
                                if (g) {
                                    // X stays fixed at table left, only Y tracks cursor
                                    g.style.top = `${ev.clientY - parseFloat(g.dataset.offsetY || '0')}px`
                                }
                                if (!tableElRef.current) return
                                const rows = Array.from(tableElRef.current.querySelectorAll('tr')) as HTMLTableRowElement[]
                                for (let i = 0; i < rows.length; i++) {
                                    const rect = rows[i].getBoundingClientRect()
                                    if (ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
                                        if (dragOverRef.current !== i) { dragOverRef.current = i; setDragOverIdx(i) }
                                        return
                                    }
                                }
                            }

                            function onUp() {
                                document.getElementById(GHOST_ID)?.remove()
                                document.body.style.cursor = ''
                                document.body.style.userSelect = ''
                                setIsDragging(false)
                                const finalIdx = dragOverRef.current
                                if (dragFromRef.current !== null && dragOverRef.current !== null) {
                                    moveRow(dragFromRef.current, dragOverRef.current)
                                }
                                dragFromRef.current = null; dragOverRef.current = null
                                setDragOverIdx(null)
                                document.removeEventListener('pointermove', onMove)
                                document.removeEventListener('pointerup', onUp)
                                document.removeEventListener('pointercancel', onUp)
                                overControlsRef.current = true
                                if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null }
                                requestAnimationFrame(() => {
                                    const tableEl = tableElRef.current
                                    if (!tableEl) return
                                    const rows = tableEl.querySelectorAll('tr')
                                    const tr = (finalIdx != null ? rows[finalIdx] : null) as HTMLTableRowElement | null
                                    const firstRow = tableEl.querySelector('tr') as HTMLTableRowElement | null
                                    const cell = colCtrl ? (firstRow?.cells[colCtrl.idx] as HTMLElement | undefined) ?? null : null
                                    recalc(tableEl, tr, cell)
                                })
                            }

                            document.addEventListener('pointermove', onMove)
                            document.addEventListener('pointerup', onUp)
                            document.addEventListener('pointercancel', onUp)
                        }}
                    ><DragIcon /></Btn>

                    {/* checkbox */}
                    <div
                        {...ctrlHandlers}
                        onClick={() => setSelectedRows(prev => {
                            const next = new Set(prev)
                            next.has(rowCtrl.idx) ? next.delete(rowCtrl.idx) : next.add(rowCtrl.idx)
                            return next
                        })}
                        style={{
                            ...checkboxStyle,
                            background: selectedRows.has(rowCtrl.idx) ? 'var(--accent)' : 'var(--card-bg)',
                            border: `1.5px solid ${selectedRows.has(rowCtrl.idx) ? 'var(--accent)' : 'var(--card-border)'}`,
                        }}
                    >
                        {selectedRows.has(rowCtrl.idx) && <CheckIcon />}
                    </div>
                </div>
            )}

            {/* Column controls on top of hovered column */}
            {colCtrl && !isTableMoveDragging && (
                <div key={`col-ctrl-${colCtrl.idx}`} data-tbl-ctrl="1" {...ctrlHandlers} style={{
                    position: 'fixed',
                    top: colControlTop ?? 0,
                    left: colCtrl.left,
                    width: COL_CTRL_WIDTH,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    zIndex: 9999,
                    pointerEvents: isDragging ? 'none' : 'auto',
                }}>
                    <Btn
                        onMouseDown={(e) => {
                            e.preventDefault()
                            const alt = e.getModifierState('Alt')
                            addColumnAt(colCtrl.idx, alt)
                        }}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, lines: ['Click  –  add column right', 'Alt-click  –  add column left'] })}
                        onMouseLeave={() => setTooltip(null)}
                    ><PlusIcon /></Btn>

                    <Btn
                        style={{ cursor: 'grab' }}
                        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, lines: ['Drag to move column'] })}
                        onMouseLeave={() => setTooltip(null)}
                        onPointerDown={(e) => startColumnDrag(e, colCtrl.idx)}
                    ><DragIcon /></Btn>

                    <div
                        {...ctrlHandlers}
                        onClick={() => setSelectedCols(prev => {
                            const next = new Set(prev)
                            next.has(colCtrl.idx) ? next.delete(colCtrl.idx) : next.add(colCtrl.idx)
                            return next
                        })}
                        style={{
                            ...checkboxStyle,
                            background: selectedCols.has(colCtrl.idx) ? 'var(--accent)' : 'var(--card-bg)',
                            border: `1.5px solid ${selectedCols.has(colCtrl.idx) ? 'var(--accent)' : 'var(--card-border)'}`,
                        }}
                    >
                        {selectedCols.has(colCtrl.idx) && <CheckIcon />}
                    </div>
                </div>
            )}

            {/* Delete selected — anchored to table bottom, persists while rows selected */}
            {deleteBtnPos && (
                <button
                    data-tbl-ctrl="1"
                    {...ctrlHandlers}
                    onMouseDown={(e) => { e.preventDefault(); deleteSelectedRows() }}
                    style={{
                        position: 'fixed',
                        top: deleteBtnPos.top,
                        left: deleteBtnPos.left,
                        zIndex: 9999,
                        padding: '4px 14px',
                        borderRadius: 8,
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171',
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                >
                    Delete {selectedRows.size} row{selectedRows.size > 1 ? 's' : ''}
                </button>
            )}

            {/* Delete selected columns */}
            {deleteColsBtnPos && (
                <button
                    data-tbl-ctrl="1"
                    {...ctrlHandlers}
                    onMouseDown={(e) => {
                        e.preventDefault()
                        deleteSelectedColumns()
                    }}
                    style={{
                        position: 'fixed',
                        top: deleteColsBtnPos.top,
                        left: deleteColsBtnPos.left,
                        zIndex: 9999,
                        padding: '4px 14px',
                        borderRadius: 8,
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                >
                    Delete {selectedCols.size} column{selectedCols.size > 1 ? 's' : ''}
                </button>
            )}
        </>
    )
}

function Btn({ onMouseDown, onPointerDown, onMouseEnter, onMouseLeave, children, style }: {
    onMouseDown?: (e: React.MouseEvent) => void
    onPointerDown?: (e: React.PointerEvent) => void
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
    children: React.ReactNode
    style?: React.CSSProperties
}) {
    return (
        <button
            onMouseDown={onMouseDown} onPointerDown={onPointerDown}
            onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
            style={{
                width: 20, height: 20, flexShrink: 0,
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--muted-text)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                cursor: 'pointer', ...style,
            }}
        >{children}</button>
    )
}

function PlusIcon() {
    return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function DragIcon() {
    return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
}
function CheckIcon() {
    return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
function MoveIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 9 2 12 5 15"/>
            <polyline points="9 5 12 2 15 5"/>
            <polyline points="15 19 12 22 9 19"/>
            <polyline points="19 9 22 12 19 15"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
        </svg>
    )
}
