'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { signOutUser } from './profile/actions'

interface ProfileDropdownProps {
    avatarUrl: string | null
    fullName: string
}

export default function ProfileDropdown({ avatarUrl, fullName }: ProfileDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="block w-8 h-8 rounded-full overflow-hidden border-2 hover:border-violet-400 focus:border-violet-400 focus:outline-none transition-all duration-200"
                style={{ borderColor: 'var(--card-border-hover)' }}
                title="Account Menu"
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                        {fullName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                )}
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl py-1 z-50"
                    style={{
                        background: 'var(--dropdown-bg)',
                        border: '1px solid var(--dropdown-border)',
                    }}
                >
                    <div className="px-4 py-2 mb-1" style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--body-text)' }}>{fullName}</p>
                    </div>
                    
                    <Link
                        href="/dashboard/profile"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm transition-colors"
                        style={{ color: 'var(--subtle-text)' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M3 21a9 9 0 0 1 18 0"/></svg> Profile Settings
                    </Link>
                    
                    <div className="h-px my-1" style={{ background: 'var(--dropdown-border)' }}></div>
                    
                    <button
                        onClick={async () => {
                            setIsOpen(false)
                            await signOutUser()
                        }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Sign Out
                    </button>
                </div>
            )}
        </div>
    )
}
