import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import LiveClock from './LiveClock'

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch profile to get timezone
    const { data: profile } = await supabase
        .from('profiles')
        .select('timezone, avatar_url')
        .eq('id', user.id)
        .single()

    const userTimezone = profile?.timezone || 'UTC'
    const avatarUrl = profile?.avatar_url || null

    async function signOut() {
        'use server'
        const supabase = await createClient()
        await supabase.auth.signOut()
        redirect('/login')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold text-gray-800">📚 StudyFlow</h1>
                    <LiveClock timezone={userTimezone} />
                </div>
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/profile"
                        className="block w-9 h-9 rounded-full overflow-hidden border-2 border-gray-200 hover:border-blue-500 transition"
                        title="Profile"
                    >
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-sm">
                                👤
                            </div>
                        )}
                    </Link>
                    <form action={signOut}>
                        <button
                            type="submit"
                            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition"
                        >
                            Sign Out
                        </button>
                    </form>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto mt-12 px-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                    Welcome back! 👋
                </h2>
                <p className="text-gray-500 mb-8">
                    Logged in as: <strong>{user.email}</strong>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl shadow p-6">
                        <div className="text-3xl mb-3">⏱️</div>
                        <h3 className="font-semibold text-gray-800 mb-1">Pomodoro Timer</h3>
                        <p className="text-gray-500 text-sm">Coming soon...</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-6">
                        <div className="text-3xl mb-3">✅</div>
                        <h3 className="font-semibold text-gray-800 mb-1">Tasks</h3>
                        <p className="text-gray-500 text-sm">Coming soon...</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-6">
                        <div className="text-3xl mb-3">📊</div>
                        <h3 className="font-semibold text-gray-800 mb-1">Analytics</h3>
                        <p className="text-gray-500 text-sm">Coming soon...</p>
                    </div>
                </div>
            </main>
        </div>
    )
}
