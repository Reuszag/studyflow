// @vitest-environment jsdom
// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const channelCallbacks = {
    INSERT: [] as Array<() => void>,
    DELETE: [] as Array<() => void>,
}

const mockChannel = {
    on: vi.fn((_eventName, config, callback) => {
        if (config?.event === 'INSERT') channelCallbacks.INSERT.push(callback)
        if (config?.event === 'DELETE') channelCallbacks.DELETE.push(callback)
        return mockChannel
    }),
    subscribe: vi.fn(() => mockChannel),
}

const mockSupabase = {
    auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
}

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => mockSupabase),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

import NoteNotifications from '@/app/(dashboard)/dashboard/NoteNotifications'
import DrawingCanvas from '@/app/(dashboard)/dashboard/notes/[noteId]/DrawingCanvas'
import { NotificationProvider } from '@/lib/NotificationContext'

describe('NoteNotifications', () => {
    beforeEach(() => {
        channelCallbacks.INSERT = []
        channelCallbacks.DELETE = []
        fetchMock.mockReset()
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    })

    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('shows a toast when a note is shared', async () => {
        render(
            <NotificationProvider>
                <NoteNotifications />
            </NotificationProvider>
        )

        await waitFor(() => expect(mockSupabase.channel).toHaveBeenCalled())

        actToast(channelCallbacks.INSERT[0])

        await waitFor(() => {
            expect(screen.getByText('A note was shared with you')).toBeInTheDocument()
        })
    })

    it('shows a toast when a shared note is removed', async () => {
        render(
            <NotificationProvider>
                <NoteNotifications />
            </NotificationProvider>
        )

        await waitFor(() => expect(mockSupabase.channel).toHaveBeenCalled())

        actToast(channelCallbacks.DELETE[0])

        await waitFor(() => {
            expect(screen.getByText('A shared note was removed from your list')).toBeInTheDocument()
        })
    })
})

describe('DrawingCanvas', () => {
    const canvasContext = {
        save: vi.fn(),
        restore: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        drawImage: vi.fn(),
        lineCap: '',
        lineJoin: '',
        lineWidth: 0,
        globalCompositeOperation: 'source-over',
        strokeStyle: '#000000',
    }

    beforeEach(() => {
        fetchMock.mockReset()
        fetchMock.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ url: '/api/note-image?path=user-1/drawing.png&noteId=note-1' }),
        })

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(canvasContext as never)
        Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
            configurable: true,
            value: (callback: BlobCallback) => callback(new Blob(['drawing'], { type: 'image/png' })),
        })
        Object.defineProperty(HTMLCanvasElement.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({
                left: 0,
                top: 0,
                width: 800,
                height: 500,
                right: 800,
                bottom: 500,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }),
        })
    })

    afterEach(() => {
        cleanup()
        vi.restoreAllMocks()
        vi.clearAllMocks()
    })

    it('creates a stroke and uploads the drawing on save', async () => {
        const onSave = vi.fn()
        const onClose = vi.fn()

        render(<DrawingCanvas onSave={onSave} onClose={onClose} noteId="note-1" ownerId="user-1" />)

        const canvases = document.querySelectorAll('canvas')
        const drawingCanvas = canvases[1] as HTMLCanvasElement

        canvasContext.stroke.mockClear()

        fireEvent.mouseDown(drawingCanvas, { clientX: 10, clientY: 10 })
        fireEvent.mouseMove(drawingCanvas, { clientX: 40, clientY: 30 })
        fireEvent.mouseUp(drawingCanvas, { clientX: 40, clientY: 30 })

        expect(canvasContext.stroke).toHaveBeenCalled()

        await userEvent.click(screen.getByRole('button', { name: /insert drawing/i }))

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith('/api/upload-note-image', expect.objectContaining({ method: 'POST' }))
            expect(onSave).toHaveBeenCalledWith('/api/note-image?path=user-1/drawing.png&noteId=note-1')
        })
    })
})

function actToast(callback: (() => void) | undefined) {
    if (!callback) throw new Error('Missing toast callback')
    act(() => {
        callback()
    })
}