'use client'

import { useState, useEffect } from 'react'

export default function LiveClock({ timezone }: { timezone: string }) {
    const [time, setTime] = useState('')

    useEffect(() => {
        function updateTime() {
            const now = new Date()
            const formatted = now.toLocaleTimeString('en-GB', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            })
            setTime(formatted)
        }

        updateTime()
        const interval = setInterval(updateTime, 1000)
        return () => clearInterval(interval)
    }, [timezone])

    return (
        <span
            className="text-xs px-2.5 py-1 rounded-full font-mono"
            style={{
                color: 'var(--muted-text)',
                background: 'var(--hover-overlay)',
                border: '1px solid var(--card-border)',
            }}
        >
            🕐 {time}
        </span>
    )
}
