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
        <div className="flex-1 flex flex-col min-h-0 bg-[#0f1117]">

            {/* Top Bar Form */}
            <div className="bg-[#161822] border border-white/5 rounded-2xl p-6 shadow-xl mb-6 shrink-0">
                <form
                    ref={formRef}
                    action={handleAddTask}
                    className="flex flex-col sm:flex-row gap-3 bg-black/20 p-2 rounded-2xl border border-white/5 focus-within:border-violet-500/30 focus-within:bg-black/40 transition-all"
                >
                    <input
                        type="text"
                        name="title"
                        placeholder="What needs to be done?"
                        required
                        className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-gray-200 placeholder:text-gray-500 font-medium"
                    />
                    <div className="flex items-center gap-3 px-2 pb-3 sm:pb-0 shrink-0 border-t border-white/5 sm:border-none pt-3 sm:pt-0 mt-2 sm:mt-0 relative z-10 w-full sm:w-auto">

                        {/* Custom React Calendar Date Picker */}
                        <div className="relative flex-1 sm:min-w-[140px]">
                            <input type="hidden" name="planned_date" value={plannedDate} />
                            <button
                                type="button"
                                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                className={`w-full flex items-center justify-between bg-[#161822] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold hover:bg-white/5 hover:border-white/20 transition-all shadow-sm group ${plannedDate ? 'text-blue-400' : 'text-gray-300'}`}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    <span className="opacity-80 text-[12px]">📅</span>
                                    {plannedDate ? new Date(plannedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set Date...'}
                                </span>
                            </button>

                            {isCalendarOpen && (
                                <>
                                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsCalendarOpen(false)}></div>
                                    <div className="absolute top-[calc(100%+8px)] left-0 w-64 bg-[#1a1c28]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">

                                        {/* Calendar Header */}
                                        <div className="flex items-center justify-between mb-4">
                                            <button
                                                type="button"
                                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
                                            >
                                                ◀
                                            </button>
                                            <div className="text-sm font-semibold text-gray-200">
                                                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
                                            >
                                                ▶
                                            </button>
                                        </div>

                                        {/* Calendar Grid Header */}
                                        <div className="grid grid-cols-7 gap-1 mb-1">
                                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                                <div key={day} className="text-[10px] font-bold text-gray-500 text-center py-1">
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
                                                        className={`w-7 h-7 flex items-center justify-center text-xs rounded-full transition-all mx-auto ${isPast ? 'text-gray-600 cursor-not-allowed opacity-40' :
                                                            isSelected ? 'bg-blue-500 text-white font-bold shadow-md shadow-blue-500/30' :
                                                                isTodayLocal ? 'text-blue-400 font-bold border border-blue-500/30 hover:bg-white/5' :
                                                                    'text-gray-300 hover:bg-white/10 hover:text-white'
                                                            }`}
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
                                className={`w-full flex items-center justify-between bg-[#161822] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold hover:bg-white/5 hover:border-white/20 transition-all shadow-sm group ${formPriority === 'high' ? 'text-red-400' :
                                    formPriority === 'medium' ? 'text-orange-400' : 'text-emerald-400'
                                    }`}
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
                                    <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[130px] bg-[#1a1c28]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                                        {[
                                            { id: 'low', label: 'Low', icon: '🌱', color: 'text-emerald-400' },
                                            { id: 'medium', label: 'Medium', icon: '⚡', color: 'text-orange-400' },
                                            { id: 'high', label: 'High', icon: '🔥', color: 'text-red-400' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => { setFormPriority(opt.id); setIsPriorityOpen(false) }}
                                                className={`w-full flex items-center justify-start gap-2.5 px-4 py-2 text-xs font-semibold cursor-pointer transition-colors active:bg-white/10 ${opt.color} ${formPriority === opt.id ? 'bg-white/10' : 'hover:bg-white/[0.03]'}`}
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
                            className="flex-1 flex flex-col bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            {/* Column Header */}
                            <div className="p-5 border-b border-white/5 bg-[#1a1c28] shrink-0 flex items-center justify-between">
                                <h3 className="font-semibold text-white tracking-tight flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full bg-${col.color}-500 shadow-[0_0_8px_rgba(var(--color-${col.color}-500),0.5)]`}></div>
                                    {col.title}
                                </h3>
                                <div className="text-xs font-bold text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
                                    {columnTasks.length}
                                </div>
                            </div>

                            {/* Task List (Drop Zone) */}
                            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${columnTasks.length === 0 ? 'flex items-center justify-center' : ''}`}>
                                {columnTasks.length === 0 ? (
                                    <div className="text-center py-10 opacity-40">
                                        <div className="text-sm font-medium text-gray-400 border border-dashed border-gray-600 rounded-xl px-6 py-4">
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
                                                ? 'bg-white/[0.02] border-white/5 opacity-70 hover:opacity-100'
                                                : 'bg-[#1a1c28] border-white/10 hover:border-violet-500/40 hover:shadow-violet-900/20'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={() => handleToggle(task.id, task.status)}
                                                    className={`w-5 h-5 mt-0.5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all ${task.status === 'completed'
                                                        ? `bg-${col.color}-500 border-${col.color}-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]`
                                                        : 'border-gray-500 hover:border-violet-400 hover:bg-violet-500/10'
                                                        }`}
                                                >
                                                    {task.status === 'completed' && <span className="text-[10px] font-bold">✓</span>}
                                                </button>

                                                <div className="flex-1 min-w-0 pr-6">
                                                    <h4 className={`text-sm font-medium leading-snug ${task.status === 'completed' ? 'text-gray-400 line-through decoration-gray-600' : 'text-gray-200'
                                                        }`}>
                                                        {task.title}
                                                    </h4>
                                                </div>

                                                {/* Delete Button (Hidden until hover) */}
                                                <button
                                                    onClick={() => handleDelete(task.id)}
                                                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
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
                                                        <div className="text-[10px] font-medium text-gray-300 flex items-center gap-1.5 bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.05] shadow-sm" title="Planned Date">
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
