'use client'

import { useState, useEffect } from 'react'

export default function LiveClock() {
    const [time, setTime] = useState('')

    useEffect(() => {
        function updateTime() {
            const now = new Date()
            const formatted = now.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            })
            setTime(formatted)
        }

        updateTime()
        const interval = setInterval(updateTime, 1000)
        return () => clearInterval(interval)
    }, [])

    return (
        <span
            className="text-lg px-4 py-1.5 rounded-xl font-mono font-bold tracking-tight"
            style={{
                color: 'var(--heading-text)',
                background: 'var(--hover-overlay)',
                border: '1px solid var(--card-border)',
                letterSpacing: '-0.02em'
            }}
        >
            {time}
        </span>
    )
}
