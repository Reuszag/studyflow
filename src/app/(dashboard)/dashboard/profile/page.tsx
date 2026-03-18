import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch profile data
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    // If no profile exists yet (edge case), create a default one
    const profileData = profile || {
        id: user.id,
        full_name: null,
        avatar_url: null,
        timezone: 'UTC',
        preferences: {},
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
                <Link href="/dashboard" className="text-xl font-bold text-gray-800 hover:text-blue-600 transition">
                    📚 StudyFlow
                </Link>
                <Link
                    href="/dashboard"
                    className="text-gray-500 hover:text-gray-800 text-sm font-medium transition"
                >
                    ← Back to Dashboard
                </Link>
            </nav>

            <main className="max-w-lg mx-auto mt-12 px-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                    Your Profile
                </h2>
                <p className="text-gray-500 mb-8">
                    Update your personal information below.
                </p>

                <div className="bg-white rounded-2xl shadow p-8">
                    <ProfileForm profile={profileData} email={user.email || ''} />
                </div>
            </main>
        </div>
    )
}
