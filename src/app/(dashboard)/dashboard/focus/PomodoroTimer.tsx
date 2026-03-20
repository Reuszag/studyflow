'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Mode = 'pomodoro' | 'short' | 'long'

const DEFAULT_MODES: Record<Mode, { label: string; duration: number; color: string; ring: string }> = {
    pomodoro: { label: 'Focus', duration: 25 * 60, color: '#a78bfa', ring: '#7c3aed' },
    short:    { label: 'Short Break', duration: 5 * 60, color: '#34d399', ring: '#059669' },
    long:     { label: 'Long Break', duration: 15 * 60, color: '#60a5fa', ring: '#2563eb' },
}

const POMODOROS_BEFORE_LONG = 4

function pad(n: number) {
    return String(n).padStart(2, '0')
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${pad(m)}:${pad(s)}`
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.4, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.8)

        // Second beep
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.9)
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.9)
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6)
        osc2.start(ctx.currentTime + 0.9)
        osc2.stop(ctx.currentTime + 1.6)
    } catch {
        // Audio not available
    }
}

// SVG ring dimensions
const R = 90
const CIRC = 2 * Math.PI * R

export default function PomodoroTimer() {
    const [modes, setModes] = useState(DEFAULT_MODES)
    const [mode, setMode] = useState<Mode>('pomodoro')
    const [timeLeft, setTimeLeft] = useState(DEFAULT_MODES.pomodoro.duration)
    const [running, setRunning] = useState(false)
    const [pomodoroCount, setPomodoroCount] = useState(0)
    const [sessionLabel, setSessionLabel] = useState<string | null>(null)
    const [showSettings, setShowSettings] = useState(false)
    const [tempSettings, setTempSettings] = useState({
        pomodoro: 25,
        short: 5,
        long: 15
    })
    
    // To avoid hydration mismatch, check if mounted
    const [mounted, setMounted] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const cfg = modes[mode]
    const progress = timeLeft / cfg.duration
    const strokeDashoffset = CIRC * (1 - progress)

    useEffect(() => {
        setMounted(true)
        const saved = localStorage.getItem('studyflow_timer_settings')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                // Need to validate it matches our shape just in case
                if (parsed.pomodoro && parsed.short && parsed.long) {
                    setModes(parsed)
                    setTimeLeft(parsed.pomodoro.duration)
                    setTempSettings({
                        pomodoro: parsed.pomodoro.duration / 60,
                        short: parsed.short.duration / 60,
                        long: parsed.long.duration / 60
                    })
                }
            } catch (e) {
                // Ignore parse errors
            }
        }
    }, [])

    // Update document title while running
    useEffect(() => {
        if (!mounted) return
        
        if (running) {
            document.title = `${formatTime(timeLeft)} – ${cfg.label} | StudyFlow`
        } else {
            document.title = 'StudyFlow'
        }
        return () => { document.title = 'StudyFlow' }
    }, [running, timeLeft, cfg.label, mounted])

    const advanceMode = useCallback((completedMode: Mode, currentCount: number) => {
        playBeep()
        if (completedMode === 'pomodoro') {
            const newCount = currentCount + 1
            setPomodoroCount(newCount)
            if (newCount % POMODOROS_BEFORE_LONG === 0) {
                setMode('long')
                setTimeLeft(modes.long.duration)
                setSessionLabel(`🎉 ${newCount} Pomodoros done! Long break time.`)
            } else {
                setMode('short')
                setTimeLeft(modes.short.duration)
                setSessionLabel(`✅ Pomodoro #${newCount} done! Short break.`)
            }
        } else {
            setMode('pomodoro')
            setTimeLeft(modes.pomodoro.duration)
            setSessionLabel(`🍅 Break over. Back to focus!`)
        }
        setRunning(false)
    }, [modes])

    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current!)
                        setRunning(false)
                        // Use a timeout so state is flushed before mode advance
                        setTimeout(() => {
                            setMode(m => {
                                setPomodoroCount(c => {
                                    advanceMode(m, c)
                                    return c
                                })
                                return m
                            })
                        }, 50)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [running, advanceMode])

    function switchMode(m: Mode) {
        setRunning(false)
        setMode(m)
        setTimeLeft(modes[m].duration)
        setSessionLabel(null)
    }

    function handleReset() {
        setRunning(false)
        setTimeLeft(cfg.duration)
        setSessionLabel(null)
    }

    function saveSettings() {
        // Validate inputs
        const p = Math.max(1, Math.min(120, tempSettings.pomodoro))
        const s = Math.max(1, Math.min(60, tempSettings.short))
        const l = Math.max(1, Math.min(120, tempSettings.long))
        
        const newModes = { ...modes }
        newModes.pomodoro.duration = p * 60
        newModes.short.duration = s * 60
        newModes.long.duration = l * 60
        
        setModes(newModes)
        localStorage.setItem('studyflow_timer_settings', JSON.stringify(newModes))
        
        // Reset current active timer to its new default
        setRunning(false)
        setTimeLeft(newModes[mode].duration)
        setSessionLabel(null)
        setShowSettings(false)
    }

    const dots = Array.from({ length: POMODOROS_BEFORE_LONG }, (_, i) => i)

    if (!mounted) return null // Prevent hydration mismatch

    return (
        <div className="flex flex-col items-center justify-center min-h-full py-16 px-6 relative">
            {/* Settings Modal overlay */}
            {showSettings && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0c12]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-[#161822] border border-white/10 rounded-3xl p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Timer Settings</h2>
                            <button 
                                onClick={() => setShowSettings(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block flex justify-between text-sm font-medium text-gray-300 mb-1">
                                    <span>Focus Duration</span>
                                    <span className="text-violet-400">{tempSettings.pomodoro} min</span>
                                </label>
                                <input 
                                    type="range" min="1" max="120" 
                                    value={tempSettings.pomodoro} 
                                    onChange={(e) => setTempSettings({...tempSettings, pomodoro: Number(e.target.value)})}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500" 
                                />
                            </div>
                            
                            <div>
                                <label className="block flex justify-between text-sm font-medium text-gray-300 mb-1">
                                    <span>Short Break</span>
                                    <span className="text-emerald-400">{tempSettings.short} min</span>
                                </label>
                                <input 
                                    type="range" min="1" max="60" 
                                    value={tempSettings.short} 
                                    onChange={(e) => setTempSettings({...tempSettings, short: Number(e.target.value)})}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                                />
                            </div>
                            
                            <div>
                                <label className="block flex justify-between text-sm font-medium text-gray-300 mb-1">
                                    <span>Long Break</span>
                                    <span className="text-blue-400">{tempSettings.long} min</span>
                                </label>
                                <input 
                                    type="range" min="1" max="120" 
                                    value={tempSettings.long} 
                                    onChange={(e) => setTempSettings({...tempSettings, long: Number(e.target.value)})}
                                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-3 mt-8">
                            <button 
                                onClick={() => setShowSettings(false)}
                                className="flex-1 py-2.5 rounded-xl font-medium text-sm text-gray-400 border border-white/5 bg-white/5 hover:bg-white/10 hover:text-gray-200 transition-colors"
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
            <div className="w-full max-w-md rounded-3xl bg-[#161822] border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 flex flex-col items-center gap-8 relative overflow-hidden group">
                
                {/* Settings icon */}
                <button 
                    onClick={() => {
                        // Initialize temp settings with current modes
                        setTempSettings({
                            pomodoro: modes.pomodoro.duration / 60,
                            short: modes.short.duration / 60,
                            long: modes.long.duration / 60,
                        })
                        setShowSettings(true)
                    }}
                    className="absolute top-6 right-6 w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10 z-10 opacity-70 hover:opacity-100"
                    title="Timer Settings"
                >
                    ⚙️
                </button>

                {/* Title */}
                <div className="text-center mt-2 relative z-10">
                    <h1 className="text-2xl font-bold text-white tracking-tight">Focus Timer</h1>
                    <p className="text-gray-500 text-sm mt-1">Stay in the zone, one session at a time.</p>
                </div>

                {/* Mode selector */}
                <div className="flex gap-2 bg-white/5 border border-white/10 rounded-xl p-1.5 w-full relative z-10 shadow-inner">
                    {(Object.keys(modes) as Mode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => switchMode(m)}
                            className={`flex-1 text-xs font-semibold py-2.5 px-2 rounded-lg transition-all duration-300
                                ${mode === m
                                    ? 'bg-[#2a2c3a] text-white shadow-md border-b-[3px]'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border-b-[3px] border-transparent'
                                }`}
                            style={{ borderBottomColor: mode === m ? modes[m].color : 'transparent' }}
                        >
                            {modes[m].label}
                        </button>
                    ))}
                </div>

                {/* Circular timer */}
                <div className="relative flex items-center justify-center my-4" style={{ width: 220, height: 220 }}>
                    <svg width="220" height="220" className="absolute inset-0 -rotate-90">
                        {/* Track */}
                        <circle
                            cx="110" cy="110" r={R}
                            fill="none"
                            stroke="rgba(255,255,255,0.03)"
                            strokeWidth="12"
                        />
                        {/* Progress */}
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
                        {/* Glow */}
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

                    {/* Center time display */}
                    <div className="flex flex-col items-center z-10">
                        <span
                            className="font-mono font-bold text-[3.5rem] leading-none tracking-tighter"
                            style={{ color: cfg.color, transition: 'color 0.4s ease' }}
                        >
                            {formatTime(timeLeft)}
                        </span>
                        <span className="text-gray-500 text-[10px] mt-2 font-bold uppercase tracking-[0.2em]">
                            {cfg.label}
                        </span>
                    </div>
                </div>

                {/* Pomodoro dots */}
                <div className="flex items-center gap-2 relative z-10 bg-black/20 px-4 py-2 rounded-full border border-white/5">
                    {dots.map(i => {
                        const filled = i < (pomodoroCount % POMODOROS_BEFORE_LONG) || (pomodoroCount > 0 && pomodoroCount % POMODOROS_BEFORE_LONG === 0)
                        return (
                            <div
                                key={i}
                                className={`w-3 h-3 rounded-full transition-all duration-300 shadow-inner ${
                                    i < (pomodoroCount % POMODOROS_BEFORE_LONG)
                                        ? 'bg-violet-500 scale-110 shadow-[0_0_8px_rgba(139,92,246,0.6)]'
                                        : 'bg-white/10'
                                }`}
                            />
                        )
                    })}
                    <span className="ml-2 text-xs text-gray-400 font-medium">
                        {pomodoroCount} session{pomodoroCount !== 1 ? 's' : ''} done
                    </span>
                </div>

                {/* Session notification */}
                {sessionLabel && (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-gray-200 text-center w-full shadow-lg relative z-10">
                        {sessionLabel}
                    </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-4 w-full relative z-10 mt-2">
                    <button
                        onClick={handleReset}
                        className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-gray-400 bg-white/5 hover:bg-white/10 hover:text-gray-200 transition-all duration-200 border border-white/5 hover:border-white/10 active:scale-95"
                    >
                        Reset
                    </button>
                    <button
                        onClick={() => setRunning(r => !r)}
                        className="flex-[2] py-3.5 rounded-xl text-base font-bold transition-all duration-200 shadow-xl active:scale-95 flex items-center justify-center gap-2"
                        style={{
                            background: running
                                ? 'rgba(255,255,255,0.08)'
                                : `linear-gradient(135deg, ${cfg.color}e6, ${cfg.ring})`,
                            color: running ? cfg.color : 'white',
                            border: running ? `1px solid ${cfg.color}33` : '1px solid transparent',
                        }}
                    >
                        {running ? '⏸ Pause Timer' : '▶ Start Timer'}
                    </button>
                </div>
            </div>

            {/* Tips */}
            <p className="mt-8 text-center text-xs text-gray-600 max-w-sm">
                💡 Work for your set focus time, take a short break. Every 4 sessions, you deserve a long break. ⚙️ Click the gear to customize your times.
            </p>
        </div>
    )
}
