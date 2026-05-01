import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import StudyTipCard from './StudyTipCard'
import RecentActivityClient from './RecentActivityClient'

// Premium SVG Icons
const Icons = {
    Timer: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    ),
    Tasks: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    ),
    Storage: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    ),
    Notes: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    ),
    GPA: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
    ),
    Activity: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    ),
    Clock: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 15"/></svg>
    ),
    Brain: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v2H5a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h2v2a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-2h2a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3h-2V5a3 3 0 0 0-3-3z"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/></svg>
    ),
    Flame: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>
    ),
    ArrowRight: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
    )
}

function formatBytes(bytes: number, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // --- Fetch Real Data ---

    // 1. Profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    const displayName = profile?.full_name || user.email?.split('@')[0] || 'User'

    // 2. Tasks
    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, status')
        .eq('user_id', user.id)
    
    const activeTasks = tasks?.filter(t => t.status !== 'archived') || []
    const pendingTasksCount = activeTasks.filter(t => t.status !== 'completed').length || 0
    const completedTasksCount = activeTasks.filter(t => t.status === 'completed').length || 0
    const totalTasks = activeTasks.length || 0
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0

    // 3. Notes
    const { count: notesCount } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id)

    // 4. Storage
    const { data: docs } = await supabase
        .from('documents')
        .select('file_size')
        .eq('user_id', user.id)
    
    const totalStorageBytes = docs?.reduce((acc, d) => acc + (Number(d.file_size) || 0), 0) || 0
    const storageFormatted = formatBytes(totalStorageBytes)

    // 5. GPA Target (20% more than last saved calculation)
    const { data: lastGpaCalc } = await supabase
        .from('gpa_calculations')
        .select('gpa')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    let gpaTarget = '—'
    if (lastGpaCalc?.gpa) {
        const newTarget = (lastGpaCalc.gpa * 1.2).toFixed(2)
        gpaTarget = parseFloat(newTarget) > 5.0 ? '5.0' : newTarget
    }

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
            {/* Top Bar / Greeting */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--heading-text)' }}>
                        Welcome back, <span className="text-violet-400">{displayName}</span>
                    </h1>
                </div>
                
                <div className="flex items-center gap-3">
                    <Link 
                        href="/dashboard/focus"
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center gap-2"
                        style={{ background: 'var(--accent)', color: 'white' }}
                    >
                        <Icons.Timer />
                        Start Focus Session
                    </Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Study Notes', value: notesCount || 0, icon: Icons.Notes, color: 'text-violet-400', bg: 'rgba(139, 92, 246, 0.1)', desc: '' },
                    { label: 'Cloud Storage', value: storageFormatted, icon: Icons.Storage, color: 'text-emerald-400', bg: 'rgba(52, 211, 153, 0.1)', desc: '' },
                    { label: 'Tasks Done', value: `${taskCompletionRate}%`, icon: Icons.Tasks, color: 'text-emerald-400', bg: 'rgba(52, 211, 153, 0.1)', desc: '' },
                    { label: 'GPA Target', value: gpaTarget, icon: Icons.GPA, color: 'text-violet-400', bg: 'rgba(167, 139, 250, 0.1)', desc: '' },
                ].map((stat, i) => (
                    <div
                        key={i}
                        className="p-5 rounded-2xl border transition-all hover:border-violet-500/30 group"
                        style={{
                            background: 'var(--card-bg)',
                            borderColor: 'var(--card-border)',
                        }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div 
                                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stat.color}`}
                                style={{ background: stat.bg, borderColor: 'var(--active-nav-border)' }}
                            >
                                <stat.icon />
                            </div>
                        </div>
                        <div className="text-2xl font-bold tracking-tight mb-1" style={{ color: 'var(--heading-text)' }}>{stat.value}</div>
                        <div className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-text)' }}>{stat.label}</div>
                        {stat.desc && <div className="text-[10px] mt-1" style={{ color: 'var(--muted-text)' }}>{stat.desc}</div>}
                    </div>
                ))}
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Primary Actions (Left/Main column) */}
                <div className="lg:col-span-8 space-y-8">
                    <section>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--heading-text)' }}>Modules</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { 
                                    title: 'Tasks & Planning', 
                                    desc: 'Manage your deadlines and daily to-do lists.', 
                                    href: '/dashboard/tasks', 
                                    icon: Icons.Tasks, 
                                    accent: '#3b82f6',
                                    stats: `${pendingTasksCount} Pending`
                                },
                                { 
                                    title: 'Study Notes', 
                                    desc: 'Organize your knowledge and class materials.', 
                                    href: '/dashboard/notes', 
                                    icon: Icons.Notes, 
                                    accent: '#8b5cf6',
                                    stats: `${notesCount || 0} Notes`
                                },
                                { 
                                    title: 'Cloud Storage', 
                                    desc: 'Upload and categorize your study documents.', 
                                    href: '/dashboard/storage', 
                                    icon: Icons.Storage, 
                                    accent: '#10b981',
                                    stats: storageFormatted
                                },
                                { 
                                    title: 'GPA Calculator', 
                                    desc: 'Track your grades and academic progress.', 
                                    href: '/dashboard/gpa', 
                                    icon: Icons.GPA, 
                                    accent: '#f43f5e',
                                    stats: '-'
                                },
                            ].map((card, i) => (
                                <Link
                                    key={i}
                                    href={card.href}
                                    className="group p-6 rounded-2xl border transition-all hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]"
                                    style={{
                                        background: 'var(--card-bg)',
                                        borderColor: 'var(--card-border)',
                                    }}
                                >
                                    <div className="flex items-start gap-5">
                                        <div 
                                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner group-hover:rotate-6 transition-transform"
                                            style={{ background: 'var(--hover-overlay)', color: card.accent, border: '1px solid var(--active-nav-border)' }}
                                        >
                                            <card.icon />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="mb-1">
                                                <h3 className="font-bold text-base truncate" style={{ color: 'var(--heading-text)' }}>{card.title}</h3>
                                            </div>
                                            <p className="text-sm line-clamp-2" style={{ color: 'var(--muted-text)' }}>{card.desc}</p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Progress Visualization Placeholder */}
                    <section className="p-8 rounded-3xl border relative overflow-hidden group" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-cyan-500/10 transition-all duration-700"></div>
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div>
                                <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--heading-text)' }}>AI-Powered Learning</h3>
                                <p className="text-sm max-w-sm" style={{ color: 'var(--muted-text)' }}>
                                    Leverage our <span className="text-cyan-400 font-bold">AI summarization feature</span> to transform your study notes into concise summaries and study smarter.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-cyan-400">✨</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted-text)' }}>Smart Summary</div>
                                </div>
                                <div className="w-[1px] h-10 bg-white/10 self-center"></div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-cyan-400">⚡</div>
                                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted-text)' }}>Instant Results</div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Sidebar Column (Right) */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Activity Feed */}
                    <RecentActivityClient />

                    {/* Pro Tip Card */}
                    <StudyTipCard />
                </div>

            </div>
        </div>
    )
}
