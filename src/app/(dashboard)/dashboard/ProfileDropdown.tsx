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
                className="block w-8 h-8 rounded-full overflow-hidden border-2 border-white/10 hover:border-violet-400 focus:border-violet-400 focus:outline-none transition-all duration-200"
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
                <div className="absolute right-0 mt-2 w-48 bg-[#1e2030] border border-white/10 rounded-xl shadow-xl py-1 z-50">
                    <div className="px-4 py-2 border-b border-white/5 mb-1">
                        <p className="text-sm font-medium text-gray-200 truncate">{fullName}</p>
                    </div>
                    
                    <Link
                        href="/dashboard/profile"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                        <span>👤</span> Profile Settings
                    </Link>
                    
                    <div className="h-px bg-white/10 my-1"></div>
                    
                    <button
                        onClick={async () => {
                            setIsOpen(false)
                            await signOutUser()
                        }}
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <span>🚪</span> Sign Out
                    </button>
                </div>
            )}
        </div>
    )
}
