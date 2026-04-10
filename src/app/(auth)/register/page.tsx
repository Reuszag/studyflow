'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReCAPTCHA from 'react-google-recaptcha'
import ThemeToggle from '@/app/components/ThemeToggle'
import { registerUser } from './actions'

const PASSWORD_RULES = [
    { key: 'length', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { key: 'uppercase', label: 'One uppercase letter (A-Z)', test: (pw: string) => /[A-Z]/.test(pw) },
    { key: 'lowercase', label: 'One lowercase letter (a-z)', test: (pw: string) => /[a-z]/.test(pw) },
    { key: 'number', label: 'One number (0-9)', test: (pw: string) => /[0-9]/.test(pw) },
    { key: 'special', label: 'One special character (!@#$…)', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
]

function getStrengthMeta(score: number) {
    if (score <= 1) return { label: 'Very weak', color: '#ef4444', percent: 20 }
    if (score === 2) return { label: 'Weak', color: '#f97316', percent: 40 }
    if (score === 3) return { label: 'Fair', color: '#eab308', percent: 60 }
    if (score === 4) return { label: 'Strong', color: '#22c55e', percent: 80 }
    return { label: 'Very strong', color: '#16a34a', percent: 100 }
}

export default function RegisterPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [touched, setTouched] = useState(false)
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const recaptchaRef = useRef<ReCAPTCHA>(null)

    const ruleResults = useMemo(
        () => PASSWORD_RULES.map((r) => ({ ...r, pass: r.test(password) })),
        [password],
    )
    const passedCount = ruleResults.filter((r) => r.pass).length
    const allPassed = passedCount === PASSWORD_RULES.length
    const strength = getStrengthMeta(passedCount)
    const passwordsMatch = password === confirmPassword

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault()
        setTouched(true)
        setError('')

        if (!allPassed) {
            setError('Please meet all password requirements.')
            return
        }

        if (!passwordsMatch) {
            setError('Passwords do not match.')
            return
        }

        if (!captchaToken) {
            setError('Please complete the CAPTCHA verification.')
            return
        }

        setLoading(true)

        const result = await registerUser(email, password, captchaToken)

        if (result.error) {
            setError(result.error)
            setLoading(false)
            recaptchaRef.current?.reset()
            setCaptchaToken(null)
            return
        }

        if (result.redirect) {
            router.push(result.redirect)
            router.refresh()
            return
        }

        if (result.confirmEmail) {
            setSuccess(true)
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div
                className="min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-300"
                style={{ background: 'var(--background)' }}
            >
                <div className="absolute top-5 right-6 z-20">
                    <ThemeToggle />
                </div>
                <div
                    className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl p-8 text-center transition-colors duration-300"
                    style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                    }}
                >
                    <div className="text-5xl mb-4">📧</div>
                    <h2
                        className="text-2xl font-bold mb-2"
                        style={{ color: 'var(--foreground)' }}
                    >
                        Check your email!
                    </h2>
                    <p style={{ color: 'var(--muted-text)' }}>
                        We sent a confirmation link to <strong style={{ color: 'var(--foreground)' }}>{email}</strong>. Click it to activate your account.
                    </p>
                    <Link
                        href="/login"
                        className="inline-block mt-6 font-medium hover:underline"
                        style={{ color: 'var(--accent)' }}
                    >
                        Back to Login
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-300"
            style={{ background: 'var(--background)' }}
        >
            {/* Background glow orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ opacity: 'var(--glow-opacity)' }}>
                <div
                    className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
                />
                <div
                    className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10"
                    style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
                />
            </div>

            {/* Theme toggle */}
            <div className="absolute top-5 right-6 z-20">
                <ThemeToggle />
            </div>

            {/* Card */}
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
                    📚 StudyFlow
                </h1>
                <p className="text-center mb-8" style={{ color: 'var(--muted-text)' }}>
                    Create your account
                </p>

                <form onSubmit={handleRegister} className="space-y-4">
                    {/* Email */}
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

                    {/* Password */}
                    <div>
                        <label
                            className="block text-sm font-medium mb-1"
                            style={{ color: 'var(--label-text)' }}
                        >
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setTouched(true) }}
                                required
                                className="w-full rounded-lg px-4 py-2.5 pr-11 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors duration-300"
                                style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--input-text)',
                                }}
                                placeholder="Create a strong password"
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

                        {/* Strength meter */}
                        {password.length > 0 && (
                            <div className="mt-2">
                                <div
                                    className="w-full h-2 rounded-full overflow-hidden"
                                    style={{ background: 'var(--input-border)' }}
                                >
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{ width: `${strength.percent}%`, backgroundColor: strength.color }}
                                    />
                                </div>
                                <p className="text-xs mt-1 font-medium" style={{ color: strength.color }}>
                                    {strength.label}
                                </p>
                            </div>
                        )}

                        {/* Rule checklist */}
                        {(password.length > 0 || touched) && (
                            <ul className="mt-2 space-y-1">
                                {ruleResults.map((r) => (
                                    <li
                                        key={r.key}
                                        className="flex items-center gap-1.5 text-xs"
                                        style={{
                                            color: r.pass ? '#22c55e' : 'var(--muted-text)',
                                        }}
                                    >
                                        <span>{r.pass ? '✓' : '○'}</span>
                                        <span>{r.label}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label
                            className="block text-sm font-medium mb-1"
                            style={{ color: 'var(--label-text)' }}
                        >
                            Confirm Password
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full rounded-lg px-4 py-2.5 pr-11 focus:outline-none focus:ring-2 transition-colors duration-300"
                                style={{
                                    background: 'var(--input-bg)',
                                    border: `1px solid ${confirmPassword.length > 0 && !passwordsMatch ? '#f87171' : 'var(--input-border)'}`,
                                    color: 'var(--input-text)',
                                }}
                                placeholder="Re-enter your password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(v => !v)}
                                className="absolute inset-y-0 right-3 flex items-center transition-opacity opacity-50 hover:opacity-100"
                                style={{ color: 'var(--label-text)' }}
                                tabIndex={-1}
                            >
                                {showConfirmPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                )}
                            </button>
                        </div>
                        {confirmPassword.length > 0 && !passwordsMatch && (
                            <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                        )}
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
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="text-center text-sm mt-6" style={{ color: 'var(--muted-text)' }}>
                    Already have an account?{' '}
                    <Link
                        href="/login"
                        className="font-medium hover:underline"
                        style={{ color: 'var(--accent)' }}
                    >
                        Sign In
                    </Link>
                </p>
            </div>
        </div>
    )
}

