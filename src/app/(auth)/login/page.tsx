'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReCAPTCHA from 'react-google-recaptcha'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/app/components/ThemeToggle'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const recaptchaRef = useRef<ReCAPTCHA>(null)

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setError('')

        if (!captchaToken) {
            setError('Please complete the CAPTCHA verification.')
            return
        }

        setLoading(true)

        const supabase = createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        })

        if (error) {
            setError('Invalid email or password. Please try again.')
            setLoading(false)
            recaptchaRef.current?.reset()
            setCaptchaToken(null)
            return
        }

        router.push('/dashboard')
        router.refresh()
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
                    StudyFlow
                </h1>
                <p className="text-center mb-8" style={{ color: 'var(--muted-text)' }}>
                    Sign in to your account
                </p>

                <form onSubmit={handleLogin} className="space-y-4">
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

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label
                                className="block text-sm font-medium"
                                style={{ color: 'var(--label-text)' }}
                            >
                                Password
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-xs font-medium hover:underline"
                                style={{ color: 'var(--accent)' }}
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full rounded-lg px-4 py-2.5 pr-11 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors duration-300"
                                style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--input-text)',
                                }}
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute inset-y-0 right-3 flex items-center transition-opacity opacity-50 hover:opacity-100"
                                style={{ color: 'var(--label-text)' }}
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                            </button>
                        </div>
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
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-3 text-center">
                    <Link href="/forgot-password" className="text-sm hover:underline" style={{ color: 'var(--accent)' }}>
                        Forgot password?
                    </Link>
                </div>

                <p className="text-center text-sm mt-6" style={{ color: 'var(--muted-text)' }}>
                    Don&apos;t have an account?{' '}
                    <Link
                        href="/register"
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent)' }}
                    >
                        Register
                    </Link>
                </p>
            </div>
        </div>
    )
}

