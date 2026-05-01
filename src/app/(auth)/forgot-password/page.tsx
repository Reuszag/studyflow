'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import ReCAPTCHA from 'react-google-recaptcha'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const recaptchaRef = useRef<ReCAPTCHA>(null)

    async function handleReset(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setMessage('')

        if (!captchaToken) {
            setError('Please complete the CAPTCHA verification.')
            return
        }

        setLoading(true)

        const supabase = createClient()
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/dashboard/profile`,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            recaptchaRef.current?.reset()
            setCaptchaToken(null)
            return
        }

        setMessage('If an account exists for that email, you will receive a password reset link shortly.')
        setLoading(false)
        recaptchaRef.current?.reset()
        setCaptchaToken(null)
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
                <h1
                    className="text-3xl font-bold text-center mb-1"
                    style={{ color: 'var(--foreground)' }}
                >
                    Reset Password
                </h1>
                <p className="text-center mb-8" style={{ color: 'var(--muted-text)' }}>
                    Enter your email to receive a reset link
                </p>

                {message ? (
                    <div className="space-y-6">
                        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
                            {message}
                        </div>
                        <Link
                            href="/login"
                            className="block w-full text-center py-2.5 rounded-lg font-semibold transition-all duration-200"
                            style={{ background: 'var(--overlay-soft)', color: 'var(--foreground)' }}
                        >
                            Back to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="space-y-4">
                        <div>
                            <label
                                className="block text-sm font-medium mb-1"
                                style={{ color: 'var(--label-text)' }}
                            >
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

                        {error && (
                            <p className="text-red-400 text-sm">{error}</p>
                        )}

                        <div className="flex justify-center">
                            <ReCAPTCHA
                                ref={recaptchaRef}
                                sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!}
                                onChange={(token) => setCaptchaToken(token)}
                                onExpired={() => setCaptchaToken(null)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !captchaToken}
                            className="w-full text-white py-2.5 rounded-lg font-semibold disabled:opacity-50 transition-all duration-200 cursor-pointer shadow-lg shadow-violet-900/20"
                            style={{
                                background: 'linear-gradient(135deg, var(--accent), #4f46e5)',
                            }}
                        >
                            {loading ? 'Sending link...' : 'Send Reset Link'}
                        </button>

                        <div className="text-center pt-2">
                            <Link href="/login" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
                                Back to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
