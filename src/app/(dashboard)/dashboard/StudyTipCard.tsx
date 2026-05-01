'use client'

import { useEffect, useState } from 'react'
import studyTips from '@/data/study-tips.json'

const STORAGE_KEY = 'studyflow:last-study-tip-index'

export default function StudyTipCard() {
    const [tipIndex, setTipIndex] = useState(0)

    useEffect(() => {
        const tips = studyTips as string[]
        if (tips.length === 0) return

        let previousIndex: number | null = null
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored !== null) previousIndex = Number(stored)
        } catch {
            previousIndex = null
        }

        let nextIndex = Math.floor(Math.random() * tips.length)
        if (tips.length > 1 && previousIndex !== null && nextIndex === previousIndex) {
            nextIndex = (nextIndex + 1) % tips.length
        }

        setTipIndex(nextIndex)
        try {
            localStorage.setItem(STORAGE_KEY, String(nextIndex))
        } catch {}
    }, [])

    const tip = (studyTips as string[])[tipIndex] || ''

    return (
        <div className="p-6 rounded-2xl border-[1.5px] bg-violet-600/5 border-violet-500/30 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-violet-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 12l2 2 4-4" />
                    <path d="M12 2a7 7 0 00-7 7c0 2.2 1 4.2 2.7 5.5L8 18h8l.3-3.5A7.2 7.2 0 0019 9a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest">Study Tip</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--body-text)' }}>
                {tip}
            </p>
        </div>
    )
}