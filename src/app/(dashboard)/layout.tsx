import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from './dashboard/Sidebar'
import ProfileDropdown from './dashboard/ProfileDropdown'
import LiveClock from './dashboard/LiveClock'
import Link from 'next/link'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
        return null
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('timezone, avatar_url, full_name')
        .eq('id', user.id)
        .single()

    const userTimezone = profile?.timezone || 'UTC'
    const avatarUrl = profile?.avatar_url || null
    const fullName = profile?.full_name || user.email?.split('@')[0] || 'Student'

    return (
        <div className="flex min-h-screen bg-[#0f1117]">
            <Sidebar />

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <header className="h-14 border-b border-white/5 bg-[#0f1117]/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-200 text-sm">📚 StudyFlow</span>
                        <LiveClock timezone={userTimezone} />
                    </div>
                    <div className="flex items-center gap-4">
                        <ProfileDropdown avatarUrl={avatarUrl} fullName={fullName} />
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
