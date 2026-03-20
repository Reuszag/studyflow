import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProfileForm from './ProfileForm'

export default async function ProfilePage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const profileData = profile || {
        id: user.id,
        full_name: null,
        avatar_url: null,
        timezone: 'UTC',
        preferences: {},
    }

    return (
        <div className="p-8 max-w-lg mx-auto">
            <h2 className="text-3xl font-bold text-white mb-1">Your Profile</h2>
            <p className="text-gray-500 mb-8">Update your personal information below.</p>

            <div className="bg-[#161822] border border-white/5 rounded-2xl shadow p-8">
                <ProfileForm profile={profileData} email={user.email || ''} />
            </div>
        </div>
    )
}
