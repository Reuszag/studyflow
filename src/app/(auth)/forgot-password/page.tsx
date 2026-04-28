'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [sent, setSent] = useState(false)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        const supabase = createClient()
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        })

        if (error) {
            setError('Something went wrong. Please try again.')
            setLoading(false)
            return
        }

        setSent(true)
        setLoading(false)
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-300"
            style={{ background: 'var(--background)' }}
        >
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ opacity: 'var(--glow-opacity)' }}>
                <div
                    className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
                />
                <div
                    className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
                />
            </div>

            <div className="absolute top-5 right-6 z-20">
                <ThemeToggle />
            </div>

            <div
                className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl p-8 transition-colors duration-300"
                style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                }}
            >
                {sent ? (
                    <div className="text-center">
                        <div
                            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                            style={{ background: 'var(--overlay-soft)', border: '1px solid var(--card-border)' }}
                        >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                            Check your email
                        </h2>
                        <p style={{ color: 'var(--muted-text)' }}>
                            We sent a password reset link to{' '}
                            <strong style={{ color: 'var(--foreground)' }}>{email}</strong>.
                        </p>
                        <Link
                            href="/login"
                            className="inline-block mt-6 font-medium hover:underline"
                            style={{ color: 'var(--accent)' }}
                        >
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <>
                        <h1 className="text-3xl font-bold text-center mb-1" style={{ color: 'var(--foreground)' }}>
                            StudyFlow
                        </h1>
                        <p className="text-center mb-8" style={{ color: 'var(--muted-text)' }}>
                            Reset your password
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--label-text)' }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors duration-300"
                                    style={{
                                        background: 'var(--input-bg)',
                                        border: '1px solid var(--input-border)',
                                        color: 'var(--input-text)',
                                    }}
                                    placeholder="you@example.com"
                                />
                            </div>

                            {error && <p className="text-red-400 text-sm">{error}</p>}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-all duration-200 cursor-pointer shadow-lg shadow-violet-900/20"
                                style={{ background: 'linear-gradient(135deg, var(--accent), #4f46e5)' }}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                        </form>

                        <p className="text-center text-sm mt-6" style={{ color: 'var(--muted-text)' }}>
                            Remember your password?{' '}
                            <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                                Sign In
                            </Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
