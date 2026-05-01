import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from './dashboard/Sidebar'
import ProfileDropdown from './dashboard/ProfileDropdown'
import LiveClock from './dashboard/LiveClock'
import ThemeToggle from '@/app/components/ThemeToggle'
import DashboardClientWrapper from './dashboard/DashboardClientWrapper'

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
        .select('avatar_url, full_name, email')
        .eq('id', user.id)
        .single()

    // Backfill email into profiles if missing (handle_new_user trigger doesn't store it)
    if (profile && !profile.email && user.email) {
        await supabase
            .from('profiles')
            .update({ email: user.email })
            .eq('id', user.id)
    }

    const avatarUrl = profile?.avatar_url || null
    const fullName = profile?.full_name || user.email?.split('@')[0] || 'Student'

    return (
        <div className="flex min-h-screen transition-colors duration-300" style={{ background: 'var(--background)' }}>
            <Sidebar />

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top bar */}
                <header
                    className="h-14 flex items-center justify-between px-6 sticky top-0 z-[100000] transition-colors duration-300 relative"
                    style={{
                        background: 'var(--header-bg)',
                        borderBottom: '1px solid var(--header-border)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        {/* Left side empty or reserved */}
                    </div>

                    {/* Centered Clock */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <LiveClock />
                    </div>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <ProfileDropdown avatarUrl={avatarUrl} fullName={fullName} />
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-auto">
                    <DashboardClientWrapper>
                        {children}
                    </DashboardClientWrapper>
                </main>
            </div>
        </div>
    )
}
