'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ICONS: Record<string, React.ReactNode> = {
    home: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
    ),
    focus: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
    ),
    tasks: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
    ),
    notes: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
    ),
    storage: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>
        </svg>
    ),
    gpa: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
    ),
}

const NAV_LINKS = [
    { href: '/dashboard', label: 'Home', iconKey: 'home', exact: true },
    { href: '/dashboard/focus', label: 'Focus', iconKey: 'focus', exact: false },
    { href: '/dashboard/tasks', label: 'Tasks', iconKey: 'tasks', exact: false },
    { href: '/dashboard/notes', label: 'Notes', iconKey: 'notes', exact: false },
    { href: '/dashboard/storage', label: 'Storage', iconKey: 'storage', exact: false },
    { href: '/dashboard/gpa', label: 'GPA', iconKey: 'gpa', exact: false },
]

export default function Sidebar() {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = React.useState(false)
    const [mobileOpen, setMobileOpen] = React.useState(false)


    React.useEffect(() => {
        const saved = localStorage.getItem('sidebar-collapsed')
        if (saved !== null) {
            setCollapsed(saved === 'true')
        }
    }, [])

    React.useEffect(() => {
        setMobileOpen(false)
    }, [pathname])

    const toggleCollapse = () => {
        const newState = !collapsed
        setCollapsed(newState)
        localStorage.setItem('sidebar-collapsed', String(newState))
    }

    function isActive(href: string, exact: boolean) {
        if (exact) return pathname === href
        return pathname.startsWith(href)
    }

    return (
        <>
            {/* Mobile hamburger - only on small screens, hidden when drawer open */}
            <button
                onClick={() => setMobileOpen(true)}
                className={`${mobileOpen ? 'hidden' : ''} md:hidden fixed top-3 left-3 z-[100020] p-2 rounded-lg shadow-md`}
                style={{ background: 'var(--sidebar-bg)', border: '1px solid var(--card-border)', color: 'var(--heading-text)' }}
                aria-label="Open menu"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
            </button>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    className="md:hidden fixed inset-0 bg-black/50 z-[100015]"
                />
            )}

            <aside
                className={`
                    ${collapsed ? 'md:w-20' : 'md:w-60'}
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:translate-x-0
                    fixed md:sticky top-0 left-0
                    w-60 shrink-0 flex flex-col h-screen
                    transition-all duration-300 z-[100018]
                `}
                style={{
                    background: 'var(--sidebar-bg)',
                    borderRight: '1px solid var(--card-border)',
                }}
            >
            {/* Logo */}
            <div
                className={`h-14 flex items-center overflow-hidden whitespace-nowrap transition-all ${collapsed ? 'md:px-0 md:justify-center pl-5 pr-3 justify-between' : 'pl-5 pr-3 justify-between'}`}
                style={{ borderBottom: '1px solid var(--card-border)' }}
            >
                {collapsed ? (
                    <>
                        <button
                            onClick={toggleCollapse}
                            className="hidden md:flex items-center justify-center w-10 h-10 rounded-xl hover:bg-[var(--sidebar-toggle-bg)] text-violet-500 transition-all duration-200"
                            title="Expand sidebar"
                        >
                            <span className="text-lg font-bold tracking-tighter">SF</span>
                        </button>
                        <span className="md:hidden text-lg font-bold tracking-tight" style={{ color: 'var(--heading-text)' }}>StudyFlow</span>
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="md:hidden p-1.5 rounded-lg hover:bg-[var(--sidebar-toggle-bg)] text-[var(--muted-text)]"
                            aria-label="Close menu"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </>
                ) : (
                    <>
                        <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--heading-text)' }}>StudyFlow</span>
                        <button
                            onClick={toggleCollapse}
                            className="hidden md:block p-1.5 rounded-lg hover:bg-[var(--sidebar-toggle-bg)] text-[var(--muted-text)] hover:text-[var(--heading-text)] transition-all duration-200"
                            title="Collapse sidebar"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                                <line x1="9" y1="3" x2="9" y2="21"/>
                            </svg>
                        </button>
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="md:hidden p-1.5 rounded-lg hover:bg-[var(--sidebar-toggle-bg)] text-[var(--muted-text)]"
                            aria-label="Close menu"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {/* Nav links */}
            <nav className="flex-1 py-4 px-3 flex flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-none">
                {NAV_LINKS.map(({ href, label, iconKey, exact }) => {
                    const active = isActive(href, exact)
                    const showCollapsed = collapsed
                    return (
                        <Link
                            key={href}
                            href={href}
                            onClick={() => setMobileOpen(false)}
                            title={showCollapsed ? label : undefined}
                            className={`flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap
                                ${showCollapsed ? 'md:justify-center md:p-2.5 md:mx-auto md:w-11 md:h-11 px-3 py-2.5' : 'px-3 py-2.5'}
                                ${active
                                    ? 'border shadow-sm'
                                    : 'border border-transparent'
                                }`}
                            style={active
                                ? { background: 'var(--active-nav-bg)', color: 'var(--active-nav-text)', borderColor: 'var(--active-nav-border)' }
                                : { color: 'var(--muted-text)' }
                            }
                        >
                            <span className="shrink-0 flex items-center justify-center">{NAV_ICONS[iconKey]}</span>
                            <span className={showCollapsed ? 'md:hidden' : ''}>{label}</span>
                        </Link>
                    )
                })}
            </nav>
            </aside>
        </>
    )
}
