'use client'

import { useState, useRef, useEffect } from 'react'
import { addTask, toggleTask, deleteTask, updateTaskStatus } from './actions'

type Task = {
    id: string
    title: string
    priority: string
    status: string
    planned_date?: string | null
}

interface TaskBoardProps {
    initialTasks: Task[]
}

export default function TaskBoard({ initialTasks }: TaskBoardProps) {
    const [tasks, setTasks] = useState(initialTasks)
    const [isAdding, setIsAdding] = useState(false)
    const [formPriority, setFormPriority] = useState('medium')
    const [isPriorityOpen, setIsPriorityOpen] = useState(false)
    const [plannedDate, setPlannedDate] = useState('')
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null)
    const formRef = useRef<HTMLFormElement>(null)

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3500)
    }

    // Sync local state when server component passes down new tasks after a server action
    useEffect(() => {
        setTasks(initialTasks)
    }, [initialTasks])

    const handleAddTask = async (formData: FormData) => {
        const title = (formData.get('title') as string)?.trim()
        if (title && tasks.some(t => t.title.toLowerCase() === title.toLowerCase())) {
            showToast('A task with this name already exists!', 'error')
            return
        }
        setIsAdding(true)
        const result = await addTask(formData)
        if (result.error) {
            showToast(result.error, 'error')
        } else {
            showToast('Task created successfully!', 'success')
        }
        setIsAdding(false)
        setFormPriority('medium')
        setPlannedDate('')
        formRef.current?.reset()
    }

    const handleToggle = async (id: string, currentStatus: string) => {
        // Optimistic update
        const newStatus = currentStatus === 'completed' ? 'ongoing' : 'completed'
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))

        const result = await toggleTask(id, currentStatus)
        if (result.error) {
            setTasks(initialTasks)
            showToast(result.error, 'error')
        } else {
            showToast(`Task moved to ${newStatus === 'ongoing' ? 'On Going' : 'Completed'}`, 'success')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this task?')) return

        setTasks(prev => prev.filter(t => t.id !== id))

        const result = await deleteTask(id)
        if (result.error) {
            setTasks(initialTasks)
            showToast(result.error, 'error')
        } else {
            showToast('Task deleted successfully!', 'success')
        }
    }

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData('taskId', id)
        // Set a slight delay to allow the drag image to capture before hiding the original
        setTimeout(() => {
            if (e.target instanceof HTMLElement) e.target.style.opacity = '0.4'
        }, 0)
    }

    const handleDragEnd = (e: React.DragEvent) => {
        if (e.target instanceof HTMLElement) e.target.style.opacity = '1'
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault() // Necessary to allow dropping
    }

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault()
        const taskId = e.dataTransfer.getData('taskId')
        if (!taskId) return

        const task = tasks.find(t => t.id === taskId)
        if (!task || task.status === newStatus) return

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

        const result = await updateTaskStatus(taskId, newStatus)
        if (result.error) {
            setTasks(initialTasks)
            showToast(result.error, 'error')
        } else {
            showToast(`Task moved to ${newStatus === 'ongoing' ? 'On Going' : 'Completed'}`, 'success')
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20'
            case 'medium': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
            case 'low': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
        }
    }

    // Calendar logic
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    // Safelist for Tailwind dynamically generated classes
    // bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(var(--color-blue-500),0.5)]
    // bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(var(--color-emerald-500),0.5)]
    const columns = [
        { id: 'ongoing', title: 'On Going', color: 'blue' },
        { id: 'completed', title: 'Completed', color: 'emerald' }
    ]

    return (
        <div className="flex-1 flex flex-col min-h-0 transition-colors duration-300" style={{ background: 'var(--background)' }}>

            {/* Top Bar Form */}
            <div className="rounded-2xl p-6 mb-6 shrink-0" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <form
                    ref={formRef}
                    action={handleAddTask}
                    className="flex flex-col sm:flex-row gap-3 p-2 rounded-2xl transition-all focus-within:border-violet-500/30"
                    style={{ background: 'var(--overlay-soft)', border: '1px solid var(--pill-border)' }}
                >
                    <input
                        type="text"
                        name="title"
                        placeholder="What needs to be done?"
                        required
                        className="flex-1 bg-transparent border-none outline-none px-4 py-2 font-medium"
                        style={{ color: 'var(--foreground)' }}
                    />
                    <div className="flex items-center gap-3 px-2 pb-3 sm:pb-0 shrink-0 pt-3 sm:pt-0 mt-2 sm:mt-0 relative z-10 w-full sm:w-auto">

                        {/* Custom React Calendar Date Picker */}
                        <div className="relative flex-1 sm:min-w-[140px]">
                            <input type="hidden" name="planned_date" value={plannedDate} />
                            <button
                                type="button"
                                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all shadow-sm group ${plannedDate ? 'text-blue-400' : ''}`}
                                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border-hover)', color: plannedDate ? undefined : 'var(--body-text)' }}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    <span className="opacity-80 text-[12px]">📅</span>
                                    {plannedDate ? new Date(plannedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set Date...'}
                                </span>
                            </button>

                            {isCalendarOpen && (
                                <>
                                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsCalendarOpen(false)}></div>
                                    <div className="absolute top-[calc(100%+8px)] left-0 w-64 backdrop-blur-xl rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2" style={{ background: 'var(--card-bg-alt)', border: '1px solid var(--dropdown-border)' }}>

                                        {/* Calendar Header */}
                                        <div className="flex items-center justify-between mb-4">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                ◀
                                            </button>
                                            <div className="text-sm font-semibold" style={{ color: 'var(--body-text)' }}>
                                                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                                                style={{ color: 'var(--text-tertiary)' }}
                                            >
                                                ▶
                                            </button>
                                        </div>

                                        {/* Calendar Grid Header */}
                                        <div className="grid grid-cols-7 gap-1 mb-1">
                                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                                <div key={day} className="text-[10px] font-bold text-center py-1" style={{ color: 'var(--text-quaternary)' }}>
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Calendar Days */}
                                        <div className="grid grid-cols-7 gap-1">
                                            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                                                <div key={`empty-${i}`} />
                                            ))}
                                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                                const date = i + 1
                                                const fullDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), date)
                                                fullDate.setHours(0, 0, 0, 0)

                                                const isPast = fullDate < today
                                                const isSelected = plannedDate && new Date(plannedDate).getTime() === fullDate.getTime()
                                                const isTodayLocal = fullDate.getTime() === today.getTime()

                                                return (
                                                    <button
                                                        key={date}
                                                        type="button"
                                                        disabled={isPast}
                                                        onClick={() => {
                                                            const year = fullDate.getFullYear();
                                                            const month = String(fullDate.getMonth() + 1).padStart(2, '0');
                                                            const day = String(fullDate.getDate()).padStart(2, '0');
                                                            setPlannedDate(`${year}-${month}-${day}`)
                                                            setIsCalendarOpen(false)
                                                        }}
                                                        className={`w-7 h-7 flex items-center justify-center text-xs rounded-full transition-all mx-auto ${isPast ? 'cursor-not-allowed opacity-40' :
                                                            isSelected ? 'bg-blue-500 text-white font-bold shadow-md shadow-blue-500/30' :
                                                                isTodayLocal ? 'text-blue-400 font-bold border border-blue-500/30' :
                                                                    ''
                                                            }`}
                                                        style={!isPast && !isSelected && !isTodayLocal ? { color: 'var(--text-secondary)' } : isPast ? { color: 'var(--text-quaternary)' } : undefined}
                                                    >
                                                        {date}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                    </div>
                                </>
                            )}
                        </div>

                        {/* Custom React Priority Dropdown */}
                        <div className="relative flex-1 sm:min-w-[125px]">
                            <input type="hidden" name="priority" value={formPriority} />
                            <button
                                type="button"
                                onClick={() => setIsPriorityOpen(!isPriorityOpen)}
                                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all shadow-sm group ${formPriority === 'high' ? 'text-red-400' :
                                    formPriority === 'medium' ? 'text-orange-400' : 'text-emerald-400'
                                    }`}
                                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border-hover)' }}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    <span className="opacity-80 text-[12px]">{formPriority === 'high' ? '🔥' : formPriority === 'medium' ? '⚡' : '🌱'}</span>
                                    {formPriority === 'high' ? 'High' : formPriority === 'medium' ? 'Medium' : 'Low'}
                                </span>
                                <span className="text-[10px] text-gray-500 transition-transform duration-200 shrink-0" style={{ transform: isPriorityOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                            </button>

                            {isPriorityOpen && (
                                <>
                                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsPriorityOpen(false)}></div>
                                    <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[130px] backdrop-blur-xl rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2" style={{ background: 'var(--card-bg-alt)', border: '1px solid var(--dropdown-border)' }}>
                                        {[
                                            { id: 'low', label: 'Low', icon: '🌱', color: 'text-emerald-400' },
                                            { id: 'medium', label: 'Medium', icon: '⚡', color: 'text-orange-400' },
                                            { id: 'high', label: 'High', icon: '🔥', color: 'text-red-400' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => { setFormPriority(opt.id); setIsPriorityOpen(false) }}
                                                className={`w-full flex items-center justify-start gap-2.5 px-4 py-2 text-xs font-semibold cursor-pointer transition-colors ${opt.color}`}
                                                style={{ background: formPriority === opt.id ? 'var(--overlay-medium)' : undefined }}
                                            >
                                                <span className="opacity-80 text-[12px]">{opt.icon}</span>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isAdding}
                            className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-5 py-2 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-violet-900/20"
                        >
                            {isAdding ? 'Adding...' : 'Add Task'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 flex gap-6 overflow-hidden pb-4">
                {columns.map(col => {
                    const columnTasks = tasks.filter(t => t.status === col.id)

                    return (
                        <div
                            key={col.id}
                            className="flex-1 flex flex-col rounded-2xl overflow-hidden"
                            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            {/* Column Header */}
                            <div className="p-5 shrink-0 flex items-center justify-between" style={{ background: 'var(--card-bg-alt)', borderBottom: '1px solid var(--card-border)' }}>
                                <h3 className="font-semibold tracking-tight flex items-center gap-2" style={{ color: 'var(--heading-text)' }}>
                                    <div className={`w-2 h-2 rounded-full bg-${col.color}-500 shadow-[0_0_8px_rgba(var(--color-${col.color}-500),0.5)]`}></div>
                                    {col.title}
                                </h3>
                                <div className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: 'var(--text-quaternary)', background: 'var(--overlay-soft)' }}>
                                    {columnTasks.length}
                                </div>
                            </div>

                            {/* Task List (Drop Zone) */}
                            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${columnTasks.length === 0 ? 'flex items-center justify-center' : ''}`}>
                                {columnTasks.length === 0 ? (
                                    <div className="text-center py-10 opacity-60">
                                        <div className="text-sm font-medium rounded-xl px-6 py-4 border border-dashed" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--dashed-border)' }}>
                                            Drop tasks here
                                        </div>
                                    </div>
                                ) : (
                                    columnTasks.map(task => (
                                        <div
                                            key={task.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            onDragEnd={handleDragEnd}
                                            className={`group relative flex flex-col gap-3 p-4 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing hover:-translate-y-0.5 shadow-md ${task.status === 'completed'
                                                ? 'opacity-70 hover:opacity-100'
                                                : 'hover:border-violet-500/40'
                                                }`}
                                            style={{
                                                background: task.status === 'completed' ? 'var(--overlay-soft)' : 'var(--card-bg-alt)',
                                                borderColor: task.status === 'completed' ? 'var(--pill-border)' : 'var(--card-border-hover)',
                                            }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={() => handleToggle(task.id, task.status)}
                                                    className={`w-5 h-5 mt-0.5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${task.status === 'completed'
                                                        ? `bg-${col.color}-500 border-${col.color}-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]`
                                                        : 'hover:border-violet-400 hover:bg-violet-500/10'
                                                        }`}
                                                    style={task.status !== 'completed' ? { borderColor: 'var(--text-quaternary)' } : undefined}
                                                >
                                                    {task.status === 'completed' && <span className="text-[10px] font-bold">✓</span>}
                                                </button>

                                                <div className="flex-1 min-w-0 pr-6">
                                                    <h4 className={`text-sm font-medium leading-snug ${task.status === 'completed' ? 'line-through' : ''}`}
                                                        style={{ color: task.status === 'completed' ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
                                                        {task.title}
                                                    </h4>
                                                </div>

                                                {/* Delete Button (Hidden until hover) */}
                                                <button
                                                    onClick={() => handleDelete(task.id)}
                                                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                    style={{ color: 'var(--text-quaternary)' }}
                                                    title="Delete task"
                                                >
                                                    ✕
                                                </button>
                                            </div>

                                            <div className="flex justify-between items-center pl-8 pt-1">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${getPriorityColor(task.priority)}`}>
                                                    {task.priority}
                                                </span>

                                                <div className="flex items-center gap-1.5">
                                                    {task.planned_date && (
                                                        <div className="text-[10px] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-md shadow-sm" style={{ color: 'var(--text-secondary)', background: 'var(--overlay-soft)', border: '1px solid var(--pill-border)' }} title="Planned Date">
                                                            <span className="opacity-60">📅</span> {new Date(task.planned_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border ${toast.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-900/20'
                        : 'bg-red-500/10 border-red-500/20 text-red-400 shadow-red-900/20'
                        }`}>
                        <span className="text-xl">{toast.type === 'success' ? '🚀' : '⚠️'}</span>
                        <span className="font-semibold text-sm">{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
