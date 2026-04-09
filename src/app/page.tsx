'use client'

import Link from 'next/link'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function LandingPage() {
    return (
        <div className="min-h-screen overflow-hidden transition-colors duration-300" style={{ background: 'var(--background-deep)', color: 'var(--foreground)' }}>

            {/* Background glow orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ opacity: 'var(--glow-opacity)' }}>
                <div
                    className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
                />
                <div
                    className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
                />
                <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] opacity-10"
                    style={{ background: 'radial-gradient(ellipse, #7c3aed 0%, transparent 70%)' }}
                />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
                <div className="flex items-center gap-2.5">
                    <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--heading-text)' }}>📚 StudyFlow</span>
                </div>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link
                        href="/login"
                        className="text-sm px-4 py-2 rounded-xl transition-colors"
                        style={{ color: 'var(--subtle-text)' }}
                    >
                        Sign in
                    </Link>
                    <Link
                        href="/register"
                        className="text-sm font-semibold bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white px-5 py-2 rounded-xl transition-all duration-200 shadow-lg shadow-violet-900/30"
                    >
                        Get started free
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative z-10 max-w-5xl mx-auto px-8 pt-24 pb-32 text-center">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm mb-8" style={{ color: 'var(--active-nav-text)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    Built for focused students
                </div>

                <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-tight mb-6" style={{ color: 'var(--heading-text)' }}>
                    Study smarter,
                    <br />
                    <span
                        className="bg-clip-text text-transparent"
                        style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa)' }}
                    >
                        not harder.
                    </span>
                </h1>

                <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: 'var(--subtle-text)' }}>
                    StudyFlow combines a Pomodoro timer, task management, and progress tracking in one
                    beautiful dashboard — helping you build better study habits every day.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/register"
                        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold px-8 py-3.5 rounded-2xl text-base transition-all duration-200 shadow-xl shadow-violet-900/30"
                    >
                        Start for free
                    </Link>
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-3.5 rounded-2xl text-base transition-all duration-200"
                        style={{
                            background: 'var(--hover-overlay)',
                            border: '1px solid var(--card-border)',
                            color: 'var(--body-text)',
                        }}
                    >
                        Sign in
                    </Link>
                </div>
            </section>

            {/* Features */}
            <section className="relative z-10 max-w-6xl mx-auto px-8 pb-32">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--heading-text)' }}>Everything you need to focus</h2>
                    <p style={{ color: 'var(--muted-text)' }}>Designed around how you actually study.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        {
                            icon: '⏱️',
                            color: '#a78bfa',
                            glow: '#7c3aed',
                            title: 'Pomodoro Timer',
                            desc: 'Structured 25-minute focus sessions with short and long breaks. Auto-advance between modes so you never lose momentum.',
                        },
                        {
                            icon: '✅',
                            color: '#34d399',
                            glow: '#059669',
                            title: 'Task Manager',
                            desc: 'Capture everything you need to do. Break assignments into steps and check them off as you go.',
                        },
                        {
                            icon: '📊',
                            color: '#60a5fa',
                            glow: '#2563eb',
                            title: 'Progress Tracking',
                            desc: 'See your daily streaks, total focus time, and session history. Know exactly how consistent you are.',
                        },
                    ].map(({ icon, color, glow, title, desc }) => (
                        <div
                            key={title}
                            className="group relative rounded-2xl p-7 transition-all duration-300"
                            style={{
                                background: 'var(--card-bg)',
                                border: '1px solid var(--card-border)',
                            }}
                        >
                            <div
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                style={{ background: `radial-gradient(circle at 30% 20%, ${glow}15 0%, transparent 60%)` }}
                            />
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 border"
                                style={{ background: `${glow}20`, borderColor: `${color}30` }}
                            >
                                {icon}
                            </div>
                            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--heading-text)' }}>{title}</h3>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-text)' }}>{desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section className="relative z-10 max-w-4xl mx-auto px-8 pb-32">
                <div className="text-center mb-14">
                    <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--heading-text)' }}>How it works</h2>
                    <p style={{ color: 'var(--muted-text)' }}>Three steps to your best study session yet.</p>
                </div>

                <div className="flex flex-col gap-4">
                    {[
                        { step: '01', title: 'Create your account', desc: 'Sign up in seconds — no credit card, no setup hassle.' },
                        { step: '02', title: 'Start a Focus session', desc: 'Pick your task, start the Pomodoro timer, and dive in. Notifications fire when it\'s time to break.' },
                        { step: '03', title: 'Track your progress', desc: 'Watch your session count and streak grow. Small consistent wins compound fast.' },
                    ].map(({ step, title, desc }) => (
                        <div
                            key={step}
                            className="flex items-start gap-6 rounded-2xl p-6"
                            style={{
                                background: 'var(--card-bg)',
                                border: '1px solid var(--card-border)',
                            }}
                        >
                            <span
                                className="text-2xl font-black shrink-0 bg-clip-text text-transparent leading-none mt-0.5"
                                style={{ backgroundImage: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                            >
                                {step}
                            </span>
                            <div>
                                <h3 className="font-bold mb-1" style={{ color: 'var(--heading-text)' }}>{title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-text)' }}>{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="relative z-10 max-w-3xl mx-auto px-8 pb-32 text-center">
                <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-3xl p-12">
                    <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--heading-text)' }}>Ready to supercharge your studies?</h2>
                    <p className="mb-8" style={{ color: 'var(--subtle-text)' }}>Join students already using StudyFlow to stay focused and on track.</p>
                    <Link
                        href="/register"
                        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold px-10 py-3.5 rounded-2xl text-base transition-all duration-200 shadow-xl shadow-violet-900/40"
                    >
                        Get started
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 px-8 py-8 text-center" style={{ borderTop: '1px solid var(--card-border)' }}>
                <p className="text-sm" style={{ color: 'var(--footer-text)' }}>© 2026 StudyFlow. Built to help you focus.</p>
            </footer>
        </div>
    )
}
