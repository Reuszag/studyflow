'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
    { href: '/dashboard', label: 'Home', icon: '🏠', exact: true },
    { href: '/dashboard/focus', label: 'Focus', icon: '⏱️', exact: false },
    { href: '/dashboard/tasks', label: 'Tasks', icon: '✅', exact: false },
    { href: '/dashboard/notes', label: 'Notes', icon: '📝', exact: false },
    { href: '/dashboard/storage', label: 'Storage', icon: '📁', exact: false },
]

export default function Sidebar() {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)

    function isActive(href: string, exact: boolean) {
        if (exact) return pathname === href
        return pathname.startsWith(href)
    }

    return (
        <aside 
            className={`${collapsed ? 'w-20' : 'w-56'} shrink-0 flex flex-col sticky top-0 h-screen transition-all duration-300 relative z-20`}
            style={{
                background: 'var(--sidebar-bg)',
                borderRight: '1px solid var(--card-border)',
            }}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3.5 top-5 w-7 h-7 rounded-full flex items-center justify-center text-[10px] transition-all shadow-lg z-30"
                style={{
                    background: 'var(--sidebar-toggle-bg)',
                    border: '1px solid var(--card-border-hover)',
                    color: 'var(--muted-text)',
                }}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? '▶' : '◀'}
            </button>

            {/* Logo */}
            <div
                className={`h-14 flex items-center overflow-hidden whitespace-nowrap transition-all ${collapsed ? 'px-0 justify-center' : 'px-5'}`}
                style={{ borderBottom: '1px solid var(--card-border)' }}
            >
                {collapsed ? (
                    <span className="text-lg font-bold text-violet-500 tracking-tighter">SF</span>
                ) : (
                    <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--heading-text)' }}>StudyFlow</span>
                )}
            </div>

            {/* Nav links */}
            <nav className="flex-1 py-4 px-3 flex flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-none">
                {NAV_LINKS.map(({ href, label, icon, exact }) => {
                    const active = isActive(href, exact)
                    return (
                        <Link
                            key={href}
                            href={href}
                            title={collapsed ? label : undefined}
                            className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap
                                ${collapsed ? 'justify-center p-2.5 mx-auto w-11 h-11' : 'px-3 py-2.5'}
                                ${active
                                    ? 'border shadow-sm'
                                    : 'border border-transparent'
                                }`}
                            style={active
                                ? { background: 'var(--active-nav-bg)', color: 'var(--active-nav-text)', borderColor: 'var(--active-nav-border)' }
                                : { color: 'var(--muted-text)' }
                            }
                        >
                            <span className="text-lg shrink-0 flex items-center justify-center">{icon}</span>
                            {!collapsed && <span>{label}</span>}
                        </Link>
                    )
                })}
            </nav>
        </aside>
    )
}
