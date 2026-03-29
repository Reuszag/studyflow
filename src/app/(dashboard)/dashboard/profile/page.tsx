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
            <h2 className="text-3xl font-bold mb-1" style={{ color: 'var(--heading-text)' }}>Your Profile</h2>
            <p className="mb-8" style={{ color: 'var(--muted-text)' }}>Update your personal information below.</p>

            <div className="rounded-2xl shadow p-8" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                <ProfileForm profile={profileData} email={user.email || ''} />
            </div>
        </div>
    )
}
