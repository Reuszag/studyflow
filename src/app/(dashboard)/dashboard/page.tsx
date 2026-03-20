import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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
    Activity: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    ),
    Clock: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 15"/></svg>
    ),
    Flame: () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>
    )
}

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    const displayName = profile?.full_name || user.email?.split('@')[0] || 'User'

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
                <div>
                    <h1 className="text-3xl font-light text-white tracking-tight mb-2">
                        Good to see you, <span className="font-semibold text-violet-400">{displayName}</span>.
                    </h1>
                    <p className="text-gray-500 font-medium tracking-wide text-sm">
                        OVERVIEW & QUICK ACTIONS
                    </p>
                </div>
            </div>

            {/* Main Application Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {/* Focus Timer Card */}
                <Link
                    href="/dashboard/focus"
                    className="group relative flex flex-col justify-between h-48 bg-gradient-to-br from-[#1a1c28] to-[#13151f] border border-white/5 rounded-3xl p-7 overflow-hidden hover:border-violet-500/50 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)] transition-all duration-300"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-violet-500/20 transition-all duration-500"></div>
                    
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-violet-400 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                        <Icons.Timer />
                    </div>
                    
                    <div className="mt-auto">
                        <h3 className="font-semibold text-white text-lg tracking-tight mb-1">Focus Timer</h3>
                        <div className="flex items-center justify-between text-gray-500 text-sm">
                            <span className="font-medium group-hover:text-violet-300 transition-colors">Launch workspace</span>
                            <span className="opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-violet-400">→</span>
                        </div>
                    </div>
                </Link>

                {/* Tasks Card */}
                <Link
                    href="/dashboard/tasks"
                    className="group relative flex flex-col justify-between h-48 bg-gradient-to-br from-[#1a1c28] to-[#13151f] border border-white/5 rounded-3xl p-7 overflow-hidden hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-blue-500/20 transition-all duration-500"></div>
                    
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 shadow-inner group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                        <Icons.Tasks />
                    </div>
                    
                    <div className="mt-auto">
                        <h3 className="font-semibold text-white text-lg tracking-tight mb-1">Tasks</h3>
                        <div className="flex items-center justify-between text-gray-500 text-sm">
                            <span className="font-medium group-hover:text-blue-300 transition-colors">Manage to-dos</span>
                            <span className="opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-blue-400">→</span>
                        </div>
                    </div>
                </Link>

                {/* Storage Card */}
                <Link
                    href="/dashboard/storage"
                    className="group relative flex flex-col justify-between h-48 bg-gradient-to-br from-[#1a1c28] to-[#13151f] border border-white/5 rounded-3xl p-7 overflow-hidden hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all duration-300"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-emerald-500/20 transition-all duration-500"></div>
                    
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                        <Icons.Storage />
                    </div>
                    
                    <div className="mt-auto">
                        <h3 className="font-semibold text-white text-lg tracking-tight mb-1">Storage</h3>
                        <div className="flex items-center justify-between text-gray-500 text-sm">
                            <span className="font-medium group-hover:text-emerald-300 transition-colors">Access documents</span>
                            <span className="opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-emerald-400">→</span>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Performance Metrics Header */}
            <h3 className="text-sm font-semibold tracking-widest text-gray-600 uppercase mb-4">Performance Metrics</h3>
            
            {/* Stats Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Sessions Completed', value: '—', icon: Icons.Activity, color: 'text-violet-400' },
                    { label: 'Total Focus Time', value: '—', icon: Icons.Clock, color: 'text-blue-400' },
                    { label: 'Current Streak', value: '—', icon: Icons.Flame, color: 'text-emerald-400' },
                ].map((stat, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-5 bg-gradient-to-br from-[#161822] to-[#10121a] border border-white/5 rounded-2xl px-6 py-5 hover:bg-white/[0.03] transition-colors"
                    >
                        <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 shadow-inner ${stat.color}`}>
                            <stat.icon />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-500 tracking-wide mb-0.5">{stat.label}</div>
                            <div className="text-2xl font-semibold text-gray-200 tracking-tight">{stat.value}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
