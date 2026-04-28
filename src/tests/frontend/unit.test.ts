import { describe, it, expect } from 'vitest'

// ─── GPA logic (from GPACalculator.tsx) ──────────────────────────────────────

interface Subject {
    id: string
    name: string
    credits: number
    grade: number
}

function calcStats(subjects: Subject[]) {
    if (subjects.length === 0) return null
    const totalCredits = subjects.reduce((s, x) => s + x.credits, 0)
    const weightedSum = subjects.reduce((s, x) => s + x.grade * x.credits, 0)
    return { gpa: weightedSum / totalCredits, totalCredits, weightedSum }
}

function gpaColor(gpa: number | null): string {
    if (gpa === null) return 'var(--text-secondary)'
    if (gpa >= 4.5) return '#a78bfa'
    if (gpa >= 3.5) return '#6ee7b7'
    if (gpa >= 2.5) return '#fbbf24'
    return '#f87171'
}

// ─── Password rules (from register/page.tsx) ──────────────────────────────────

const PASSWORD_RULES = [
    { key: 'length',    test: (pw: string) => pw.length >= 8 },
    { key: 'uppercase', test: (pw: string) => /[A-Z]/.test(pw) },
    { key: 'lowercase', test: (pw: string) => /[a-z]/.test(pw) },
    { key: 'number',    test: (pw: string) => /[0-9]/.test(pw) },
    { key: 'special',   test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
]

function getStrengthMeta(score: number) {
    if (score <= 1) return { label: 'Very weak',   percent: 20 }
    if (score === 2) return { label: 'Weak',        percent: 40 }
    if (score === 3) return { label: 'Fair',        percent: 60 }
    if (score === 4) return { label: 'Strong',      percent: 80 }
    return              { label: 'Very strong',  percent: 100 }
}

// ─── Timer logic (from TimerContext.tsx) ──────────────────────────────────────

const POMODOROS_BEFORE_LONG = 4

type Mode = 'pomodoro' | 'short' | 'long'

const DEFAULT_DURATIONS: Record<Mode, number> = {
    pomodoro: 25 * 60,
    short: 5 * 60,
    long: 15 * 60,
}

function advanceMode(completedMode: Mode, currentCount: number): {
    nextMode: Mode
    nextCount: number
    nextDuration: number
} {
    if (completedMode === 'pomodoro') {
        const newCount = currentCount + 1
        if (newCount % POMODOROS_BEFORE_LONG === 0) {
            return { nextMode: 'long', nextCount: newCount, nextDuration: DEFAULT_DURATIONS.long }
        }
        return { nextMode: 'short', nextCount: newCount, nextDuration: DEFAULT_DURATIONS.short }
    }
    return { nextMode: 'pomodoro', nextCount: currentCount, nextDuration: DEFAULT_DURATIONS.pomodoro }
}

function clampModeDuration(minutes: number, min = 1, max = 120): number {
    return Math.max(min, Math.min(max, minutes))
}

function calcProgress(timeLeft: number, duration: number): number {
    return timeLeft / duration
}

// ─── calcStats tests ──────────────────────────────────────────────────────────

describe('calcStats', () => {
    it('calculates ECTS-weighted GPA correctly', () => {
        const subjects: Subject[] = [
            { id: '1', name: 'Math',    credits: 5, grade: 5 },
            { id: '2', name: 'History', credits: 3, grade: 4 },
        ]
        const result = calcStats(subjects)
        // (5×5 + 3×4) / (5+3) = (25+12)/8 = 37/8 = 4.625
        expect(result?.gpa).toBeCloseTo(4.625)
    })

    it('returns GPA equal to grade for single subject', () => {
        const subjects: Subject[] = [{ id: '1', name: 'Math', credits: 4, grade: 3 }]
        expect(calcStats(subjects)?.gpa).toBe(3)
    })

    it('returns null for empty subjects', () => {
        expect(calcStats([])).toBeNull()
    })

    it('calculates total credits correctly', () => {
        const subjects: Subject[] = [
            { id: '1', name: 'A', credits: 5, grade: 5 },
            { id: '2', name: 'B', credits: 3, grade: 4 },
        ]
        expect(calcStats(subjects)?.totalCredits).toBe(8)
    })

    it('weights higher-credit subject more', () => {
        const subjects: Subject[] = [
            { id: '1', name: 'A', credits: 10, grade: 5 },
            { id: '2', name: 'B', credits: 1,  grade: 1 },
        ]
        const result = calcStats(subjects)
        // Heavy credit subject dominates — GPA should be much closer to 5 than 1
        expect(result!.gpa).toBeGreaterThan(4)
    })
})

// ─── gpaColor tests ───────────────────────────────────────────────────────────

describe('gpaColor', () => {
    it('returns violet for GPA >= 4.5', () => {
        expect(gpaColor(4.5)).toBe('#a78bfa')
        expect(gpaColor(5.0)).toBe('#a78bfa')
    })

    it('returns green for GPA >= 3.5 and < 4.5', () => {
        expect(gpaColor(3.5)).toBe('#6ee7b7')
        expect(gpaColor(4.4)).toBe('#6ee7b7')
    })

    it('returns yellow for GPA >= 2.5 and < 3.5', () => {
        expect(gpaColor(2.5)).toBe('#fbbf24')
        expect(gpaColor(3.4)).toBe('#fbbf24')
    })

    it('returns red for GPA < 2.5', () => {
        expect(gpaColor(1.0)).toBe('#f87171')
        expect(gpaColor(2.4)).toBe('#f87171')
    })

    it('returns CSS variable for null GPA', () => {
        expect(gpaColor(null)).toBe('var(--text-secondary)')
    })
})

// ─── PASSWORD_RULES tests ─────────────────────────────────────────────────────

describe('PASSWORD_RULES', () => {
    const rule = (key: string) => PASSWORD_RULES.find(r => r.key === key)!

    it('length rule passes at exactly 8 characters', () => {
        expect(rule('length').test('abcdefgh')).toBe(true)
    })

    it('length rule fails below 8 characters', () => {
        expect(rule('length').test('abc')).toBe(false)
    })

    it('uppercase rule passes with uppercase letter', () => {
        expect(rule('uppercase').test('Password')).toBe(true)
    })

    it('uppercase rule fails without uppercase letter', () => {
        expect(rule('uppercase').test('password')).toBe(false)
    })

    it('lowercase rule passes with lowercase letter', () => {
        expect(rule('lowercase').test('Password')).toBe(true)
    })

    it('lowercase rule fails without lowercase letter', () => {
        expect(rule('lowercase').test('PASSWORD')).toBe(false)
    })

    it('number rule passes with digit', () => {
        expect(rule('number').test('password1')).toBe(true)
    })

    it('number rule fails without digit', () => {
        expect(rule('number').test('password')).toBe(false)
    })

    it('special rule passes with special character', () => {
        expect(rule('special').test('password!')).toBe(true)
    })

    it('special rule fails without special character', () => {
        expect(rule('special').test('Password1')).toBe(false)
    })

    it('all 5 rules pass for valid password', () => {
        const pw = 'Password1!'
        const allPass = PASSWORD_RULES.every(r => r.test(pw))
        expect(allPass).toBe(true)
    })

    it('0 rules pass for empty string', () => {
        const passed = PASSWORD_RULES.filter(r => r.test('')).length
        expect(passed).toBe(0)
    })
})

// ─── getStrengthMeta tests ────────────────────────────────────────────────────

describe('getStrengthMeta', () => {
    it('score 0 → Very weak, 20%', () => {
        expect(getStrengthMeta(0)).toEqual({ label: 'Very weak', percent: 20 })
    })

    it('score 1 → Very weak, 20%', () => {
        expect(getStrengthMeta(1)).toEqual({ label: 'Very weak', percent: 20 })
    })

    it('score 2 → Weak, 40%', () => {
        expect(getStrengthMeta(2)).toEqual({ label: 'Weak', percent: 40 })
    })

    it('score 3 → Fair, 60%', () => {
        expect(getStrengthMeta(3)).toEqual({ label: 'Fair', percent: 60 })
    })

    it('score 4 → Strong, 80%', () => {
        expect(getStrengthMeta(4)).toEqual({ label: 'Strong', percent: 80 })
    })

    it('score 5 → Very strong, 100%', () => {
        expect(getStrengthMeta(5)).toEqual({ label: 'Very strong', percent: 100 })
    })
})

// ─── Timer advanceMode tests ──────────────────────────────────────────────────

describe('advanceMode', () => {
    it('pomodoro → short break after 1st pomodoro', () => {
        const result = advanceMode('pomodoro', 0)
        expect(result.nextMode).toBe('short')
        expect(result.nextCount).toBe(1)
    })

    it('pomodoro → short break after 2nd pomodoro', () => {
        const result = advanceMode('pomodoro', 1)
        expect(result.nextMode).toBe('short')
        expect(result.nextCount).toBe(2)
    })

    it('pomodoro → long break after 4th pomodoro', () => {
        const result = advanceMode('pomodoro', 3)
        expect(result.nextMode).toBe('long')
        expect(result.nextCount).toBe(4)
    })

    it('pomodoro → long break after 8th pomodoro', () => {
        const result = advanceMode('pomodoro', 7)
        expect(result.nextMode).toBe('long')
        expect(result.nextCount).toBe(8)
    })

    it('short break → pomodoro', () => {
        const result = advanceMode('short', 2)
        expect(result.nextMode).toBe('pomodoro')
        expect(result.nextDuration).toBe(DEFAULT_DURATIONS.pomodoro)
    })

    it('long break → pomodoro', () => {
        const result = advanceMode('long', 4)
        expect(result.nextMode).toBe('pomodoro')
        expect(result.nextDuration).toBe(DEFAULT_DURATIONS.pomodoro)
    })

    it('short break does not increment pomodoro count', () => {
        const result = advanceMode('short', 2)
        expect(result.nextCount).toBe(2)
    })

    it('long break sets correct duration', () => {
        const result = advanceMode('pomodoro', 3)
        expect(result.nextDuration).toBe(DEFAULT_DURATIONS.long)
    })

    it('short break sets correct duration', () => {
        const result = advanceMode('pomodoro', 0)
        expect(result.nextDuration).toBe(DEFAULT_DURATIONS.short)
    })
})

// ─── Timer clampModeDuration tests ───────────────────────────────────────────

describe('clampModeDuration (saveModeSettings clamping)', () => {
    it('clamps below min to 1', () => {
        expect(clampModeDuration(0)).toBe(1)
        expect(clampModeDuration(-5)).toBe(1)
    })

    it('clamps above max to 120 for pomodoro/long', () => {
        expect(clampModeDuration(200)).toBe(120)
    })

    it('clamps above max to 60 for short break', () => {
        expect(clampModeDuration(200, 1, 60)).toBe(60)
    })

    it('does not clamp valid value', () => {
        expect(clampModeDuration(25)).toBe(25)
        expect(clampModeDuration(5)).toBe(5)
    })

    it('accepts exactly min value', () => {
        expect(clampModeDuration(1)).toBe(1)
    })

    it('accepts exactly max value', () => {
        expect(clampModeDuration(120)).toBe(120)
    })
})

// ─── calcProgress tests ───────────────────────────────────────────────────────

describe('calcProgress (timer ring)', () => {
    it('returns 1.0 at full time', () => {
        expect(calcProgress(1500, 1500)).toBe(1)
    })

    it('returns 0.5 at half time', () => {
        expect(calcProgress(750, 1500)).toBe(0.5)
    })

    it('returns 0 at zero time', () => {
        expect(calcProgress(0, 1500)).toBe(0)
    })

    it('returns correct value mid-session', () => {
        expect(calcProgress(300, 1500)).toBeCloseTo(0.2)
    })
})
