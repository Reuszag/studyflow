'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
    { href: '/dashboard', label: 'Home', icon: '🏠', exact: true },
    { href: '/dashboard/focus', label: 'Focus', icon: '⏱️', exact: false },
    { href: '/dashboard/tasks', label: 'Tasks', icon: '✅', exact: false },
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
            className={`${collapsed ? 'w-20' : 'w-56'} shrink-0 flex flex-col border-r border-white/5 bg-[#0a0c12] sticky top-0 h-screen transition-all duration-300 relative z-20`}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3.5 top-5 w-7 h-7 bg-[#1e2030] border border-white/10 rounded-full flex items-center justify-center text-[10px] text-gray-400 hover:text-white hover:border-violet-500/50 hover:bg-[#2a2c3a] transition-all shadow-lg z-30"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                {collapsed ? '▶' : '◀'}
            </button>

            {/* Logo */}
            <div className={`h-14 flex items-center border-b border-white/5 overflow-hidden whitespace-nowrap transition-all ${collapsed ? 'px-0 justify-center' : 'px-5'}`}>
                {collapsed ? (
                    <span className="text-lg font-bold text-violet-500 tracking-tighter">SF</span>
                ) : (
                    <span className="text-lg font-bold text-white tracking-tight">StudyFlow</span>
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
                                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.1)]'
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
                                }`}
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
