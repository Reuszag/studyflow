'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { getSavedCalculations, saveCalculation, updateCalculation, deleteCalculation } from './actions'
import type { SavedCalcRow, SubjectRow } from './actions'

interface Subject {
    id: string
    name: string
    credits: number
    grade: number
}

const EMPTY_FORM = { name: '', credits: '', grade: '' }
const LS_SUBJECTS = 'gpa_current_subjects'

function blockScientific(e: React.KeyboardEvent) {
    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
}

function calcStats(subjects: Subject[]) {
    if (subjects.length === 0) return null
    const totalCredits = subjects.reduce((s, x) => s + x.credits, 0)
    const weightedSum = subjects.reduce((s, x) => s + x.grade * x.credits, 0)
    return { gpa: weightedSum / totalCredits, totalCredits, weightedSum }
}

function gpaColor(gpa: number | null) {
    if (gpa === null) return 'var(--text-secondary)'
    if (gpa >= 4.5) return '#a78bfa'
    if (gpa >= 3.5) return '#6ee7b7'
    if (gpa >= 2.5) return '#fbbf24'
    return '#f87171'
}

export default function GPACalculator() {
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [saves, setSaves] = useState<SavedCalcRow[]>([])
    const [form, setForm] = useState(EMPTY_FORM)
    const [error, setError] = useState('')
    const [editId, setEditId] = useState<string | null>(null)
    const [saveInput, setSaveInput] = useState('')
    const [saveError, setSaveError] = useState('')
    const [showSaveInput, setShowSaveInput] = useState(false)
    const [expandedSave, setExpandedSave] = useState<string | null>(null)
    const [hydrated, setHydrated] = useState(false)
    const [savingLoading, setSavingLoading] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [editingCalcId, setEditingCalcId] = useState<string | null>(null)

    const fetchSaves = useCallback(async () => {
        try {
            const data = await getSavedCalculations()
            setSaves(data)
        } catch { /* ignore */ }
    }, [])

    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_SUBJECTS)
            if (raw) setSubjects(JSON.parse(raw))
        } catch { /* ignore */ }
        fetchSaves()
        setHydrated(true)
    }, [fetchSaves])

    useEffect(() => {
        if (!hydrated) return
        localStorage.setItem(LS_SUBJECTS, JSON.stringify(subjects))
    }, [subjects, hydrated])

    const stats = useMemo(() => calcStats(subjects), [subjects])
    const color = gpaColor(stats?.gpa ?? null)

    function validate(): string | null {
        if (!form.name.trim()) return 'Subject name cannot be empty'
        if (!form.credits.trim()) return 'Credits cannot be empty'
        if (!form.grade.trim()) return 'Grade cannot be empty'
        const credits = Number(form.credits)
        const grade = Number(form.grade)
        if (isNaN(credits) || credits <= 0) return 'Credits must be a positive number'
        if (isNaN(grade) || grade < 0) return 'Grade must be a non-negative number'
        return null
    }

    function handleAdd() {
        const err = validate()
        if (err) { setError(err); return }
        setError('')
        const credits = Number(form.credits)
        const grade = Number(form.grade)

        if (editId) {
            setSubjects(prev => prev.map(s =>
                s.id === editId ? { ...s, name: form.name.trim(), credits, grade } : s
            ))
            setEditId(null)
        } else {
            setSubjects(prev => [...prev, {
                id: crypto.randomUUID(),
                name: form.name.trim(),
                credits,
                grade,
            }])
        }
        setForm(EMPTY_FORM)
    }

    function handleEdit(s: Subject) {
        setEditId(s.id)
        setForm({ name: s.name, credits: String(s.credits), grade: String(s.grade) })
        setError('')
    }

    function handleDelete(id: string) {
        setSubjects(prev => prev.filter(s => s.id !== id))
        if (editId === id) { setEditId(null); setForm(EMPTY_FORM) }
    }

    function handleCancelEdit() {
        setEditId(null)
        setForm(EMPTY_FORM)
        setError('')
    }

    function handleFormKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleAdd()
    }

    async function handleSave() {
        if (!saveInput.trim()) { setSaveError('Name cannot be empty'); return }
        if (!stats) { setSaveError('No subjects to save'); return }
        const trimmed = saveInput.trim()
        const stripped = subjects.map(({ name, credits, grade }) => ({ name, credits, grade })) as SubjectRow[]

        if (editingCalcId) {
            const conflict = saves.some(s => s.id !== editingCalcId && s.name.toLowerCase() === trimmed.toLowerCase())
            if (conflict) { setSaveError('A calculation with this name already exists'); return }
            setSaveError('')
            setSavingLoading(true)
            try {
                const row = await updateCalculation(editingCalcId, trimmed, stripped, stats.gpa, stats.totalCredits)
                setSaves(prev => prev.map(s => s.id === editingCalcId ? row : s))
                setSaveInput('')
                setShowSaveInput(false)
                setEditingCalcId(null)
            } catch (e: unknown) {
                setSaveError(e instanceof Error ? e.message : 'Failed to save')
            } finally {
                setSavingLoading(false)
            }
        } else {
            if (saves.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
                setSaveError('A calculation with this name already exists'); return
            }
            setSaveError('')
            setSavingLoading(true)
            try {
                const row = await saveCalculation(trimmed, stripped, stats.gpa, stats.totalCredits)
                setSaves(prev => [row, ...prev])
                setSaveInput('')
                setShowSaveInput(false)
            } catch (e: unknown) {
                setSaveError(e instanceof Error ? e.message : 'Failed to save')
            } finally {
                setSavingLoading(false)
            }
        }
    }

    async function handleDeleteSave(id: string) {
        setDeletingId(id)
        try {
            await deleteCalculation(id)
            setSaves(prev => prev.filter(s => s.id !== id))
            if (expandedSave === id) setExpandedSave(null)
        } catch { /* ignore */ } finally {
            setDeletingId(null)
        }
    }

    function handleLoadSave(calc: SavedCalcRow) {
        setSubjects(calc.subjects.map(s => ({ ...s, id: crypto.randomUUID() })))
        setEditId(null)
        setForm(EMPTY_FORM)
        setError('')
        setEditingCalcId(calc.id)
        setSaveInput(calc.name)
        setShowSaveInput(true)
        setSaveError('')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    if (!hydrated) return null

    return (
        <div className="flex-1 min-h-screen p-4 sm:p-8" style={{ background: 'var(--background)' }}>
            <div className="max-w-3xl mx-auto flex flex-col gap-6">

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--heading-text)' }}>
                        GPA Calculator
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--muted-text)' }}>
                        ECTS credit-weighted grade point average
                    </p>
                </div>

                {/* GPA Result Card */}
                <div
                    className="rounded-2xl p-6 flex items-center gap-6"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                    <div className="flex flex-col items-center justify-center w-28 h-28 rounded-full shrink-0"
                        style={{ background: 'var(--overlay-soft)', border: `3px solid ${color}` }}>
                        <span className="text-3xl font-bold" style={{ color }}>
                            {stats ? stats.gpa.toFixed(2) : '—'}
                        </span>
                        <span className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>GPA</span>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-6">
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total credits</p>
                                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {stats ? stats.totalCredits : '—'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Subjects</p>
                                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {subjects.length}
                                </p>
                            </div>
                        </div>
                        {stats && (
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                Σ(grade × credits) / Σ(credits) = {stats.weightedSum.toFixed(1)} / {stats.totalCredits}
                            </p>
                        )}
                    </div>
                </div>

                {/* Add/Edit Form */}
                <div
                    className="rounded-2xl p-5"
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                >
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
                        {editId ? 'Edit subject' : 'Add subject'}
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                            placeholder="Subject name"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            onKeyDown={handleFormKeyDown}
                        />
                        <div className="flex items-center rounded-xl overflow-hidden w-32 shrink-0"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
                            <button type="button" tabIndex={-1}
                                className="px-2.5 py-2 text-base font-medium transition-colors hover:bg-[var(--overlay-medium)] select-none"
                                style={{ color: 'var(--text-tertiary)' }}
                                onClick={() => setForm(f => {
                                    const v = Math.max(0, (parseFloat(f.credits) || 0) - 0.5)
                                    return { ...f, credits: String(v) }
                                })}>−</button>
                            <input
                                className="no-spinner flex-1 min-w-0 py-2 text-sm text-center outline-none bg-transparent"
                                style={{ color: 'var(--input-text)' }}
                                placeholder="Credits"
                                type="number"
                                min="0"
                                step="0.5"
                                value={form.credits}
                                onChange={e => setForm(f => ({ ...f, credits: e.target.value }))}
                                onKeyDown={e => { blockScientific(e); handleFormKeyDown(e) }}
                            />
                            <button type="button" tabIndex={-1}
                                className="px-2.5 py-2 text-base font-medium transition-colors hover:bg-[var(--overlay-medium)] select-none"
                                style={{ color: 'var(--text-tertiary)' }}
                                onClick={() => setForm(f => {
                                    const v = (parseFloat(f.credits) || 0) + 0.5
                                    return { ...f, credits: String(v) }
                                })}>+</button>
                        </div>
                        <div className="flex items-center rounded-xl overflow-hidden w-32 shrink-0"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
                            <button type="button" tabIndex={-1}
                                className="px-2.5 py-2 text-base font-medium transition-colors hover:bg-[var(--overlay-medium)] select-none"
                                style={{ color: 'var(--text-tertiary)' }}
                                onClick={() => setForm(f => {
                                    const v = Math.max(0, (parseFloat(f.grade) || 0) - 0.5)
                                    return { ...f, grade: String(v) }
                                })}>−</button>
                            <input
                                className="no-spinner flex-1 min-w-0 py-2 text-sm text-center outline-none bg-transparent"
                                style={{ color: 'var(--input-text)' }}
                                placeholder="Grade"
                                type="number"
                                min="0"
                                step="0.5"
                                value={form.grade}
                                onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                                onKeyDown={e => { blockScientific(e); handleFormKeyDown(e) }}
                            />
                            <button type="button" tabIndex={-1}
                                className="px-2.5 py-2 text-base font-medium transition-colors hover:bg-[var(--overlay-medium)] select-none"
                                style={{ color: 'var(--text-tertiary)' }}
                                onClick={() => setForm(f => {
                                    const v = (parseFloat(f.grade) || 0) + 0.5
                                    return { ...f, grade: String(v) }
                                })}>+</button>
                        </div>
                        <button
                            onClick={handleAdd}
                            className="rounded-xl px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all shrink-0"
                        >
                            {editId ? 'Save' : 'Add'}
                        </button>
                        {editId && (
                            <button
                                onClick={handleCancelEdit}
                                className="rounded-xl px-4 py-2 text-sm font-medium transition-all shrink-0"
                                style={{ background: 'var(--overlay-soft)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                    {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                </div>

                {/* Subjects Table */}
                {subjects.length > 0 && (
                    <div
                        className="rounded-2xl overflow-hidden"
                        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                    >
                        <div className="flex items-center justify-between px-5 py-3"
                            style={{ borderBottom: '1px solid var(--card-border)' }}>
                            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Subjects</h2>
                            <button
                                onClick={() => { setSubjects([]); setEditId(null); setForm(EMPTY_FORM) }}
                                className="text-xs px-2 py-1 rounded-lg transition-all"
                                style={{ color: 'var(--text-tertiary)', background: 'var(--overlay-soft)' }}
                            >
                                Clear all
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[480px]">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <th className="text-left px-5 py-2.5 font-medium text-xs" style={{ color: 'var(--text-tertiary)' }}>Subject</th>
                                    <th className="text-center px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--text-tertiary)' }}>Credits</th>
                                    <th className="text-center px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--text-tertiary)' }}>Grade</th>
                                    <th className="text-center px-3 py-2.5 font-medium text-xs" style={{ color: 'var(--text-tertiary)' }}>Weighted</th>
                                    <th className="px-3 py-2.5 w-16" />
                                </tr>
                            </thead>
                            <tbody>
                                {subjects.map((s, i) => (
                                    <tr key={s.id} style={{
                                        borderBottom: i < subjects.length - 1 ? '1px solid var(--card-border)' : undefined,
                                        background: editId === s.id ? 'var(--overlay-soft)' : undefined,
                                    }}>
                                        <td className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                                        <td className="px-3 py-3 text-center" style={{ color: 'var(--text-secondary)' }}>{s.credits}</td>
                                        <td className="px-3 py-3 text-center" style={{ color: 'var(--text-secondary)' }}>{s.grade}</td>
                                        <td className="px-3 py-3 text-center" style={{ color: 'var(--text-tertiary)' }}>{(s.grade * s.credits).toFixed(1)}</td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => handleEdit(s)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all text-xs"
                                                    style={{ color: 'var(--text-tertiary)', background: 'var(--overlay-soft)' }}
                                                    title="Edit">✏️</button>
                                                <button onClick={() => handleDelete(s.id)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                                                    title="Delete">
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                        <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {stats && (
                                <tfoot>
                                    <tr style={{ borderTop: '1px solid var(--card-border)', background: 'var(--overlay-soft)' }}>
                                        <td className="px-5 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Total</td>
                                        <td className="px-3 py-3 text-center font-semibold" style={{ color: 'var(--text-primary)' }}>{stats.totalCredits}</td>
                                        <td className="px-3 py-3 text-center font-semibold" style={{ color }}>{stats.gpa.toFixed(2)}</td>
                                        <td className="px-3 py-3 text-center font-semibold" style={{ color: 'var(--text-secondary)' }}>{stats.weightedSum.toFixed(1)}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                        </div>

                        {/* Save calculation */}
                        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--card-border)' }}>
                            {!showSaveInput ? (
                                <button
                                    onClick={() => setShowSaveInput(true)}
                                    className="text-sm px-4 py-2 rounded-xl font-medium transition-all bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
                                >
                                    Save calculation
                                </button>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <input
                                            autoFocus
                                            className="flex-1 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                                            placeholder="e.g. Semester 1"
                                            value={saveInput}
                                            onChange={e => setSaveInput(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleSave()
                                                if (e.key === 'Escape') { setShowSaveInput(false); setSaveInput(''); setSaveError(''); setEditingCalcId(null) }
                                            }}
                                        />
                                        <button
                                            onClick={handleSave}
                                            disabled={savingLoading}
                                            className="rounded-xl px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white transition-all shrink-0 disabled:opacity-50"
                                        >
                                            {savingLoading ? 'Saving…' : editingCalcId ? 'Update' : 'Save'}
                                        </button>
                                        <button
                                            onClick={() => { setShowSaveInput(false); setSaveInput(''); setSaveError(''); setEditingCalcId(null) }}
                                            className="rounded-xl px-4 py-2 text-sm font-medium transition-all shrink-0"
                                            style={{ background: 'var(--overlay-soft)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {subjects.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12" style={{ color: 'var(--text-tertiary)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        <p className="text-sm">Add subjects above to calculate your GPA</p>
                    </div>
                )}

                {/* Saved Calculations */}
                {saves.length > 0 && (
                    <div className="flex flex-col gap-3">
                        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            Saved calculations
                        </h2>
                        {saves.map(calc => {
                            const c = gpaColor(calc.gpa)
                            const expanded = expandedSave === calc.id
                            const deleting = deletingId === calc.id
                            return (
                                <div key={calc.id} className="rounded-2xl overflow-hidden"
                                    style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                                    <div className="flex items-center gap-4 px-5 py-4">
                                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-full shrink-0"
                                            style={{ background: 'var(--overlay-soft)', border: `2px solid ${c}` }}>
                                            <span className="text-base font-bold" style={{ color: c }}>{calc.gpa.toFixed(2)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{calc.name}</p>
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                                {calc.subjects.length} subjects · {calc.total_credits} credits · {new Date(calc.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => setExpandedSave(expanded ? null : calc.id)}
                                                className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
                                                style={{ background: 'var(--overlay-soft)', color: 'var(--text-tertiary)' }}
                                            >
                                                {expanded ? 'Hide' : 'View'}
                                            </button>
                                            <button
                                                onClick={() => handleLoadSave(calc)}
                                                className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
                                                style={{ background: 'var(--overlay-medium)', color: 'var(--text-secondary)' }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSave(calc.id)}
                                                disabled={deleting}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-50"
                                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}
                                                title="Delete">
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    {expanded && (
                                        <div className="overflow-x-auto" style={{ borderTop: '1px solid var(--card-border)' }}>
                                            <table className="w-full text-xs min-w-[400px]">
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                                                        <th className="text-left px-5 py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Subject</th>
                                                        <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Credits</th>
                                                        <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--text-tertiary)' }}>Grade</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {calc.subjects.map((s, i) => (
                                                        <tr key={i} style={{ borderBottom: i < calc.subjects.length - 1 ? '1px solid var(--card-border)' : undefined }}>
                                                            <td className="px-5 py-2" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                                                            <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{s.credits}</td>
                                                            <td className="px-3 py-2 text-center" style={{ color: 'var(--text-secondary)' }}>{s.grade}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
