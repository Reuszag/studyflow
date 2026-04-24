'use client'

import { useState } from 'react'
import { useTimer, type Mode } from '@/lib/TimerContext'

function pad(n: number) {
    return String(n).padStart(2, '0')
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${pad(m)}:${pad(s)}`
}

const POMODOROS_BEFORE_LONG = 4

// SVG ring dimensions
const R = 90
const CIRC = 2 * Math.PI * R

export default function PomodoroTimer() {
    const {
        modes, mode, timeLeft, running, pomodoroCount, sessionLabel,
        cfg, progress,
        setRunning, switchMode, handleReset, saveModeSettings,
    } = useTimer()

    const [showSettings, setShowSettings] = useState(false)
    const [tempSettings, setTempSettings] = useState({
        pomodoro: modes.pomodoro.duration / 60,
        short: modes.short.duration / 60,
        long: modes.long.duration / 60,
    })

    const strokeDashoffset = CIRC * (1 - progress)

    function saveSettings() {
        saveModeSettings(tempSettings.pomodoro, tempSettings.short, tempSettings.long)
        setShowSettings(false)
    }

    const dots = Array.from({ length: POMODOROS_BEFORE_LONG }, (_, i) => i)

    return (
        <div className="flex flex-col items-center justify-center min-h-full py-16 px-6 relative">
            {/* Settings Modal overlay */}
            {showSettings && (
                <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ background: 'color-mix(in srgb, var(--background-deep) 80%, transparent)' }}>
                    <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--dropdown-border)' }}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold" style={{ color: 'var(--heading-text)' }}>Timer Settings</h2>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="transition-colors"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block flex justify-between text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Focus Duration</span>
                                    <span className="text-violet-400">{tempSettings.pomodoro} min</span>
                                </label>
                                <input
                                    type="range" min="1" max="120"
                                    value={tempSettings.pomodoro}
                                    onChange={(e) => setTempSettings({ ...tempSettings, pomodoro: Number(e.target.value) })}
                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-violet-500"
                                    style={{ background: 'var(--overlay-strong)' }}
                                />
                            </div>

                            <div>
                                <label className="block flex justify-between text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Short Break</span>
                                    <span className="text-emerald-400">{tempSettings.short} min</span>
                                </label>
                                <input
                                    type="range" min="1" max="60"
                                    value={tempSettings.short}
                                    onChange={(e) => setTempSettings({ ...tempSettings, short: Number(e.target.value) })}
                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    style={{ background: 'var(--overlay-strong)' }}
                                />
                            </div>

                            <div>
                                <label className="block flex justify-between text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    <span>Long Break</span>
                                    <span className="text-blue-400">{tempSettings.long} min</span>
                                </label>
                                <input
                                    type="range" min="1" max="120"
                                    value={tempSettings.long}
                                    onChange={(e) => setTempSettings({ ...tempSettings, long: Number(e.target.value) })}
                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    style={{ background: 'var(--overlay-strong)' }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors"
                                style={{ color: 'var(--text-tertiary)', border: '1px solid var(--pill-border)', background: 'var(--overlay-soft)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveSettings}
                                className="flex-[2] py-2.5 rounded-xl font-medium text-sm text-white bg-violet-600 hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/50"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Card */}
            <div className="w-full max-w-md rounded-3xl p-8 flex flex-col items-center gap-8 relative overflow-hidden group" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>

                {/* Settings icon */}
                <button
                    onClick={() => {
                        setTempSettings({
                            pomodoro: modes.pomodoro.duration / 60,
                            short: modes.short.duration / 60,
                            long: modes.long.duration / 60,
                        })
                        setShowSettings(true)
                    }}
                    className="absolute top-6 right-6 w-9 h-9 rounded-full flex items-center justify-center transition-all border border-transparent z-10 opacity-70 hover:opacity-100"
                    style={{ background: 'var(--overlay-soft)', color: 'var(--text-tertiary)' }}
                    title="Timer Settings"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                    </svg>
                </button>

                {/* Title */}
                <div className="text-center mt-2 relative z-10">
                    <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--heading-text)' }}>Focus Timer</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted-text)' }}>Stay in the zone, one session at a time.</p>
                </div>

                {/* Mode selector */}
                <div className="flex gap-2 border rounded-xl p-1.5 w-full relative z-10 shadow-inner" style={{ background: 'var(--hover-overlay)', borderColor: 'var(--card-border-hover)' }}>
                    {(Object.keys(modes) as Mode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => switchMode(m)}
                            className={`flex-1 text-xs font-semibold py-2.5 px-2 rounded-lg transition-all duration-300
                                ${mode === m
                                    ? 'shadow-md border-b-[3px]'
                                    : 'border-b-[3px] border-transparent'
                                }`}
                            style={{
                                borderBottomColor: mode === m ? modes[m].color : 'transparent',
                                ...(mode === m ? { background: 'var(--sidebar-toggle-bg)', color: 'var(--heading-text)' } : { color: 'var(--muted-text)' }),
                            }}
                        >
                            {modes[m].label}
                        </button>
                    ))}
                </div>

                {/* Circular timer */}
                <div className="relative flex items-center justify-center my-4" style={{ width: 220, height: 220 }}>
                    <svg width="220" height="220" className="absolute inset-0 -rotate-90">
                        <circle
                            cx="110" cy="110" r={R}
                            fill="none"
                            stroke="var(--ring-track)"
                            strokeWidth="12"
                        />
                        <circle
                            cx="110" cy="110" r={R}
                            fill="none"
                            stroke={cfg.ring}
                            strokeWidth="12"
                            strokeLinecap="round"
                            strokeDasharray={CIRC}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                        />
                        <circle
                            cx="110" cy="110" r={R}
                            fill="none"
                            stroke={cfg.color}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={CIRC}
                            strokeDashoffset={strokeDashoffset}
                            opacity="0.3"
                            filter="url(#glow)"
                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                        />
                        <defs>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                    </svg>

                    <div className="flex flex-col items-center z-10">
                        <span
                            className="font-mono font-bold text-[3.5rem] leading-none tracking-tighter"
                            style={{ color: cfg.color, transition: 'color 0.4s ease' }}
                        >
                            {formatTime(timeLeft)}
                        </span>
                        <span className="text-[10px] mt-2 font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-quaternary)' }}>
                            {cfg.label}
                        </span>
                    </div>
                </div>

                {/* Pomodoro dots */}
                <div className="flex items-center gap-2 relative z-10 px-4 py-2 rounded-full" style={{ background: 'var(--overlay-soft)', border: '1px solid var(--pill-border)' }}>
                    {dots.map(i => (
                        <div
                            key={i}
                            className={`w-3 h-3 rounded-full transition-all duration-300 shadow-inner ${i < (pomodoroCount % POMODOROS_BEFORE_LONG)
                                    ? 'bg-violet-500 scale-110 shadow-[0_0_8px_rgba(139,92,246,0.6)]'
                                    : ''
                                }`}
                            style={i >= (pomodoroCount % POMODOROS_BEFORE_LONG) ? { background: 'var(--overlay-medium)', border: '1.5px solid var(--overlay-strong)' } : undefined}
                        />
                    ))}
                    <span className="ml-2 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        {pomodoroCount} session{pomodoroCount !== 1 ? 's' : ''} done
                    </span>
                </div>

                {/* Session notification */}
                {sessionLabel && (
                    <div className="rounded-xl px-4 py-3 text-sm font-medium text-center w-full shadow-lg relative z-10" style={{ background: 'var(--overlay-soft)', border: '1px solid var(--pill-border)', color: 'var(--text-secondary)' }}>
                        {sessionLabel}
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-4 w-full relative z-10 mt-2">
                    <button
                        onClick={handleReset}
                        className="flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95"
                        style={{ color: 'var(--text-tertiary)', background: 'var(--overlay-soft)', border: '1px solid var(--pill-border)' }}
                    >
                        Reset
                    </button>
                    <button
                        onClick={() => setRunning((r: boolean) => !r)}
                        className="flex-[2] py-3.5 rounded-xl text-base font-bold transition-all duration-200 shadow-xl active:scale-95 flex items-center justify-center gap-2"
                        style={{
                            background: running
                                ? 'var(--overlay-medium)'
                                : `linear-gradient(135deg, ${cfg.color}e6, ${cfg.ring})`,
                            color: running ? cfg.color : 'white',
                            border: running ? `1px solid ${cfg.color}33` : '1px solid transparent',
                        }}
                    >
                        {running ? (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                Pause Timer
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                Start Timer
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Tips */}
            <p className="mt-8 text-center text-xs max-w-sm" style={{ color: 'var(--text-quaternary)' }}>
                Work for your set focus time, take a short break. Every 4 sessions, take a long break. Use the settings icon to customize your times.
            </p>
        </div>
    )
}
