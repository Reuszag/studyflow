'use client'

import { useEffect, useState } from 'react'
import ViewLastActivityButton from './ViewLastActivityButton'

interface ActivityItem {
    title: string
    timestamp: number
    time: string
    icon: string
    color: string
}

const Icons = {
    Tasks: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    ),
    Storage: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    ),
    Notes: () => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    ),
}

const getIcon = (iconName: string) => {
    return Icons[iconName as keyof typeof Icons] || Icons.Notes
}

export default function RecentActivityClient() {
    const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchActivityFeed = async () => {
        try {
            const response = await fetch('/api/activity-feed')
            if (response.ok) {
                const data = await response.json()
                setActivityFeed(data)
            }
        } catch (error) {
            console.error('Failed to fetch activity feed:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchActivityFeed()


        const interval = setInterval(fetchActivityFeed, 30000)

        return () => clearInterval(interval)
    }, [])

    return (
        <section id="recent-activity" className="p-6 rounded-2xl border" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
            <h3 className="font-bold text-sm uppercase tracking-widest mb-6" style={{ color: 'var(--muted-text)' }}>Recent Activity</h3>
            <div className="space-y-6">
                {!isLoading && activityFeed.length > 0 ? 
                    activityFeed.map((item, i) => {
                        const IconComponent = getIcon(item.icon)
                        return (
                            <div key={i} className="flex gap-4 group cursor-pointer min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${item.color}`} style={{ background: 'var(--hover-overlay)', borderColor: 'var(--active-nav-border)' }}>
                                    <IconComponent />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold group-hover:text-violet-400 transition-colors truncate" style={{ color: 'var(--heading-text)' }}>{item.title}</p>
                                    <p className="text-[11px]" style={{ color: 'var(--muted-text)' }}>{item.time}</p>
                                </div>
                            </div>
                        )
                    }) : 
                    <p className="text-xs" style={{ color: 'var(--muted-text)' }}>
                        {isLoading ? 'Loading activity...' : 'No recent activity found.'}
                    </p>
                }
            </div>
            <ViewLastActivityButton />
        </section>
    )
}
