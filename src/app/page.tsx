'use client'

import Link from 'next/link'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col transition-colors duration-300" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
            
            {/* Minimalist Navigation */}
            <nav className="flex items-center justify-between px-6 py-6 max-w-6xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                    </div>
                    <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--heading-text)' }}>StudyFlow</span>
                </div>
                <div className="flex items-center gap-6">
                    <ThemeToggle />
                    <Link href="/login" className="text-sm font-medium hover:text-violet-400 transition-colors" style={{ color: 'var(--muted-text)' }}>
                        Sign in
                    </Link>
                    <Link href="/register" className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-900/20">
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Simplistic Hero */}
            <main className="flex-1 flex flex-col items-center px-6 text-center max-w-6xl mx-auto py-20">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]" style={{ color: 'var(--heading-text)' }}>
                        Study smarter.<br />
                        <span className="text-violet-500">Not harder.</span>
                    </h1>
                    
                    <p className="text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed" style={{ color: 'var(--muted-text)' }}>
                        An all-in-one workspace for students. Organize your tasks, take rich notes, 
                        track your GPA, and stay focused with integrated study tools.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/register" className="px-10 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-lg transition-all shadow-xl shadow-violet-900/30 active:scale-95">
                            Start for free
                        </Link>
                        <Link href="/login" className="px-10 py-4 rounded-2xl border font-bold text-lg transition-all hover:bg-white/5 active:scale-95" style={{ borderColor: 'var(--card-border)', color: 'var(--heading-text)' }}>
                            Sign in
                        </Link>
                    </div>
                </div>

                {/* Comprehensive Feature Grid */}
                <div className="mt-32 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16 text-left w-full border-t pt-20" style={{ borderColor: 'var(--card-border)' }}>
                    
                    {/* Focus */}
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 text-violet-500 border border-violet-500/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        </div>
                        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--heading-text)' }}>Focus Timer</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-text)' }}>Integrated Pomodoro timer with persistent sessions that follow you across the platform.</p>
                    </div>

                    {/* Notes */}
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500 border border-blue-500/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--heading-text)' }}>Rich Notes</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-text)' }}>Advanced editor with support for drawings, code, and professional AI-generated study summaries.</p>
                    </div>

                    {/* Tasks */}
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 text-emerald-500 border border-emerald-500/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 11l3 3L22 4"/></svg>
                        </div>
                        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--heading-text)' }}>Task Board</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-text)' }}>Clean Kanban-style boards to manage your assignments, deadlines, and daily academic goals.</p>
                    </div>

                    {/* Storage */}
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4 text-orange-500 border border-orange-500/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--heading-text)' }}>Cloud Storage</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-text)' }}>Secure file hosting with universal previews for PDFs, Office docs, and images directly in your browser.</p>
                    </div>

                    {/* GPA */}
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4 text-rose-500 border border-rose-500/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                        </div>
                        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--heading-text)' }}>GPA Calculator</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-text)' }}>Track your grades and calculate your semester performance with ECTS-weighted accuracy.</p>
                    </div>

                    {/* Collaboration */}
                    <div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-500 border border-indigo-500/20">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--heading-text)' }}>Collaboration</h3>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-text)' }}>Share notes with classmates effortlessly, granting either view-only or full collaborative edit permissions.</p>
                    </div>

                </div>
            </main>

            {/* Simple Footer */}
            <footer className="px-6 py-12 text-center max-w-6xl mx-auto w-full mt-auto opacity-50 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--muted-text)' }}>
                &copy; 2026 StudyFlow &mdash; Academic workspace
            </footer>
        </div>
    )
}
