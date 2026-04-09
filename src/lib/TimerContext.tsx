'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'

export type Mode = 'pomodoro' | 'short' | 'long'

export type ModeConfig = { label: string; duration: number; color: string; ring: string }

const DEFAULT_MODES: Record<Mode, ModeConfig> = {
    pomodoro: { label: 'Focus', duration: 25 * 60, color: '#a78bfa', ring: '#7c3aed' },
    short:    { label: 'Short Break', duration: 5 * 60, color: '#34d399', ring: '#059669' },
    long:     { label: 'Long Break', duration: 15 * 60, color: '#60a5fa', ring: '#2563eb' },
}

const POMODOROS_BEFORE_LONG = 4

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

interface TimerContextType {
    modes: Record<Mode, ModeConfig>
    mode: Mode
    timeLeft: number
    running: boolean
    pomodoroCount: number
    sessionLabel: string | null
    cfg: ModeConfig
    progress: number
    setRunning: (v: boolean | ((prev: boolean) => boolean)) => void
    switchMode: (m: Mode) => void
    handleReset: () => void
    saveModeSettings: (pomodoro: number, short: number, long: number) => void
}

const TimerContext = createContext<TimerContextType | null>(null)

export function useTimer() {
    const ctx = useContext(TimerContext)
    if (!ctx) throw new Error('useTimer must be used within TimerProvider')
    return ctx
}

export function TimerProvider({ children }: { children: ReactNode }) {
    const [modes, setModes] = useState(DEFAULT_MODES)
    const [mode, setMode] = useState<Mode>('pomodoro')
    const [timeLeft, setTimeLeft] = useState(DEFAULT_MODES.pomodoro.duration)
    const [running, setRunning] = useState(false)
    const [pomodoroCount, setPomodoroCount] = useState(0)
    const [sessionLabel, setSessionLabel] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const cfg = modes[mode]
    const progress = timeLeft / cfg.duration

    // Load saved settings on mount
    useEffect(() => {
        setMounted(true)
        const saved = localStorage.getItem('studyflow_timer_settings')
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (parsed.pomodoro && parsed.short && parsed.long) {
                    setModes(parsed)
                    setTimeLeft(parsed.pomodoro.duration)
                }
            } catch {
                // Ignore parse errors
            }
        }
    }, [])

    // Update document title while running
    useEffect(() => {
        if (!mounted) return
        const formatTime = (seconds: number) => {
            const m = Math.floor(seconds / 60)
            const s = seconds % 60
            return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        }
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

    // Timer tick
    useEffect(() => {
        if (running) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current!)
                        setRunning(false)
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

    function saveModeSettings(pomodoro: number, short: number, long: number) {
        const p = Math.max(1, Math.min(120, pomodoro))
        const s = Math.max(1, Math.min(60, short))
        const l = Math.max(1, Math.min(120, long))

        const newModes = { ...modes }
        newModes.pomodoro = { ...newModes.pomodoro, duration: p * 60 }
        newModes.short = { ...newModes.short, duration: s * 60 }
        newModes.long = { ...newModes.long, duration: l * 60 }

        setModes(newModes)
        localStorage.setItem('studyflow_timer_settings', JSON.stringify(newModes))

        setRunning(false)
        setTimeLeft(newModes[mode].duration)
        setSessionLabel(null)
    }

    return (
        <TimerContext.Provider value={{
            modes, mode, timeLeft, running, pomodoroCount, sessionLabel,
            cfg, progress,
            setRunning, switchMode, handleReset, saveModeSettings,
        }}>
            {children}
        </TimerContext.Provider>
    )
}
