'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useTimer } from '@/lib/TimerContext'

function pad(n: number) {
    return String(n).padStart(2, '0')
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${pad(m)}:${pad(s)}`
}

// Mini SVG ring dimensions
const R = 18
const CIRC = 2 * Math.PI * R

export default function MiniTimer() {
    const pathname = usePathname()
    const router = useRouter()
    const { running, timeLeft, cfg, progress, mode, setRunning } = useTimer()

    // Only show when timer is active (running or paused with time consumed) and NOT on the focus page
    const onFocusPage = pathname === '/dashboard/focus'
    const timerStarted = running || timeLeft < cfg.duration
    if (onFocusPage || !timerStarted) return null

    const strokeDashoffset = CIRC * (1 - progress)

    return (
        <div
            className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl cursor-pointer select-none transition-all duration-300 hover:scale-105 group"
            style={{
                background: 'var(--glass-bg)',
                border: `1px solid ${cfg.color}44`,
                backdropFilter: 'blur(16px)',
                boxShadow: `0 0 20px ${cfg.color}22, 0 8px 32px var(--shadow-color)`,
            }}
            onClick={() => router.push('/dashboard/focus')}
            title="Go to Focus Timer"
        >
            {/* Mini circular progress */}
            <div className="relative flex items-center justify-center shrink-0" style={{ width: 44, height: 44 }}>
                <svg width="44" height="44" className="absolute inset-0 -rotate-90">
                    <circle
                        cx="22" cy="22" r={R}
                        fill="none"
                        stroke="var(--ring-track)"
                        strokeWidth="3"
                    />
                    <circle
                        cx="22" cy="22" r={R}
                        fill="none"
                        stroke={cfg.ring}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={CIRC}
                        strokeDashoffset={strokeDashoffset}
                        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                </svg>
                <span className="text-[10px] font-bold z-10" style={{ color: cfg.color }}>
                    {mode === 'pomodoro' ? '🍅' : mode === 'short' ? '☕' : '🌴'}
                </span>
            </div>

            {/* Time and label */}
            <div className="flex flex-col min-w-0">
                <span
                    className="font-mono font-bold text-lg leading-none tracking-tight"
                    style={{ color: cfg.color }}
                >
                    {formatTime(timeLeft)}
                </span>
                <span className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--muted-text)' }}>
                    {cfg.label} {running ? '' : '(paused)'}
                </span>
            </div>

            {/* Play/Pause button */}
            <button
                className="ml-1 w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all hover:scale-110 active:scale-95"
                style={{
                    background: running ? 'var(--overlay-medium)' : `${cfg.ring}`,
                    color: running ? cfg.color : 'white',
                    border: running ? `1px solid ${cfg.color}33` : '1px solid transparent',
                }}
                onClick={(e) => {
                    e.stopPropagation()
                    setRunning((r: boolean) => !r)
                }}
                title={running ? 'Pause' : 'Resume'}
            >
                {running ? '⏸' : '▶'}
            </button>
        </div>
    )
}
