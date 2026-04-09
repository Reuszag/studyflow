'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stroke {
  points: { x: number; y: number }[]
  color: string
  size: number
  tool: 'pen' | 'eraser'
}

interface DrawingCanvasProps {
  onSave: (imageUrl: string) => void
  onClose: () => void
  initialImage?: string | null
}

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
]

export default function DrawingCanvas({ onSave, onClose, initialImage }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState('#000000')
  const [brushSize, setBrushSize] = useState(3)
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([])
  const [uploading, setUploading] = useState(false)

  const canvasWidth = 800
  const canvasHeight = 500

  // Redraw the canvas from strokes
  const redraw = useCallback((stks: Stroke[], current?: Stroke | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    // Draw background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // Draw initial image if exists
    if (initialImage) {
      const img = new window.Image()
      img.src = initialImage
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
        drawStrokes(ctx, stks)
        if (current) drawStroke(ctx, current)
      }
    } else {
      drawStrokes(ctx, stks)
      if (current) drawStroke(ctx, current)
    }
  }, [initialImage])

  function drawStrokes(ctx: CanvasRenderingContext2D, stks: Stroke[]) {
    for (const stroke of stks) {
      drawStroke(ctx, stroke)
    }
  }

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length < 2) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = stroke.size

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = stroke.color
    }

    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
    ctx.restore()
  }

  // Redraw on stroke changes
  useEffect(() => {
    redraw(strokes)
  }, [strokes, redraw])

  // Load initial image
  useEffect(() => {
    if (initialImage) {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.src = initialImage
      img.onload = () => {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight)
      }
    }
  }, [initialImage])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasWidth / rect.width
    const scaleY = canvasHeight / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    setIsDrawing(true)
    const pos = getPos(e)
    const stroke: Stroke = { points: [pos], color, size: brushSize, tool }
    setCurrentStroke(stroke)
    setUndoneStrokes([])
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !currentStroke) return
    const pos = getPos(e)
    const updated = { ...currentStroke, points: [...currentStroke.points, pos] }
    setCurrentStroke(updated)

    // Draw current stroke in real time
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    redraw(strokes, updated)
  }

  function handleMouseUp() {
    if (currentStroke && currentStroke.points.length > 1) {
      setStrokes(prev => [...prev, currentStroke])
    }
    setCurrentStroke(null)
    setIsDrawing(false)
  }

  function handleUndo() {
    setStrokes(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setUndoneStrokes(u => [...u, last])
      return prev.slice(0, -1)
    })
  }

  function handleRedo() {
    setUndoneStrokes(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setStrokes(s => [...s, last])
      return prev.slice(0, -1)
    })
  }

  function handleClear() {
    setStrokes([])
    setUndoneStrokes([])
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  }

  async function handleSaveDrawing() {
    const canvas = canvasRef.current
    if (!canvas) return

    setUploading(true)
    try {
      // Redraw final state
      redraw(strokes)

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })
      if (!blob) {
        setUploading(false)
        return
      }

      // Upload to Supabase Storage
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUploading(false)
        return
      }

      const fileName = `drawing_${Date.now()}.png`
      const filePath = `${user.id}/${fileName}`

      const { error } = await supabase.storage
        .from('note-images')
        .upload(filePath, blob, { cacheControl: '3600', upsert: false, contentType: 'image/png' })

      if (error) {
        console.error('Upload error:', error)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('note-images')
        .getPublicUrl(filePath)

      onSave(urlData.publicUrl)
    } catch (err) {
      console.error('Drawing save error:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-[880px] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <h3 className="font-bold text-base" style={{ color: 'var(--heading-text)' }}>Drawing Canvas</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDrawing}
              disabled={uploading}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}
            >
              {uploading ? 'Saving...' : 'Insert Drawing'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--overlay-medium)] transition-colors cursor-pointer"
              style={{ color: 'var(--muted-text)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Drawing toolbar */}
        <div className="drawing-toolbar">
          {/* Pen */}
          <button
            className={tool === 'pen' ? 'active' : ''}
            onClick={() => setTool('pen')}
            title="Pen"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
          </button>

          {/* Eraser */}
          <button
            className={tool === 'eraser' ? 'active' : ''}
            onClick={() => setTool('eraser')}
            title="Eraser"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0L21.4 5.6c.8.8.8 2 0 2.8L10 20"/><path d="M6 12l6.4-6.4"/></svg>
          </button>

          {/* Separator */}
          <div className="w-px h-5 mx-1" style={{ background: 'var(--card-border)' }} />

          {/* Colors */}
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen') }}
              title={c}
              style={{
                width: 22, height: 22, borderRadius: '50%', padding: 0,
                background: c,
                border: color === c && tool === 'pen' ? '2px solid var(--accent)' : c === '#ffffff' ? '1px solid var(--card-border)' : '2px solid transparent',
                boxShadow: color === c && tool === 'pen' ? '0 0 0 2px var(--card-bg), 0 0 0 4px var(--accent)' : 'none',
              }}
            />
          ))}

          <div className="w-px h-5 mx-1" style={{ background: 'var(--card-border)' }} />

          {/* Brush size */}
          <span className="text-[10px] font-medium" style={{ color: 'var(--muted-text)' }}>{brushSize}px</span>
          <input
            type="range"
            min="1"
            max="30"
            value={brushSize}
            onChange={e => setBrushSize(Number(e.target.value))}
            className="brush-size-slider"
          />

          <div className="w-px h-5 mx-1" style={{ background: 'var(--card-border)' }} />

          {/* Undo */}
          <button onClick={handleUndo} title="Undo" style={{ opacity: strokes.length === 0 ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/></svg>
          </button>
          {/* Redo */}
          <button onClick={handleRedo} title="Redo" style={{ opacity: undoneStrokes.length === 0 ? 0.3 : 1 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-5.64-11.36L23 10"/></svg>
          </button>
          {/* Clear */}
          <button onClick={handleClear} title="Clear canvas">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
        </div>

        {/* Canvas */}
        <div className="flex items-center justify-center p-4" style={{ background: '#e5e7eb' }}>
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              width: '100%',
              maxWidth: `${canvasWidth}px`,
              height: 'auto',
              cursor: tool === 'eraser' ? 'cell' : 'crosshair',
              borderRadius: '0.5rem',
              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
              background: '#fff',
            }}
          />
        </div>
      </div>
    </div>
  )
}
