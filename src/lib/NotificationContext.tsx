'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface Toast {
    id: number
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
}

interface NotificationContextType {
    showNotification: (message: string, type?: Toast['type']) => void
    confirm: (message: string) => Promise<boolean>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

let toastId = 0

export function NotificationProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const [confirmConfig, setConfirmConfig] = useState<{ message: string, resolve: (val: boolean) => void } | null>(null)

    const showNotification = useCallback((message: string, type: Toast['type'] = 'info') => {
        const id = ++toastId
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 5000)
    }, [])

    const confirm = useCallback((message: string) => {
        return new Promise<boolean>((resolve) => {
            setConfirmConfig({ message, resolve })
        })
    }, [])

    const handleConfirm = (value: boolean) => {
        if (confirmConfig) {
            confirmConfig.resolve(value)
            setConfirmConfig(null)
        }
    }

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    return (
        <NotificationContext.Provider value={{ showNotification, confirm }}>
            {children}
            
            {confirmConfig && (
                <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => handleConfirm(false)} />
                    <div 
                        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl scale-in-center"
                        style={{ 
                            background: 'var(--card-bg)',
                            border: '1px solid var(--card-border)',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                        }}
                    >
                        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--heading-text)' }}>Confirm Action</h3>
                        <p className="text-sm mb-6" style={{ color: 'var(--body-text)' }}>{confirmConfig.message}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => handleConfirm(false)}
                                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                                style={{ background: 'var(--overlay-soft)', color: 'var(--body-text)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleConfirm(true)}
                                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors shadow-lg shadow-red-500/20"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-6 right-6 z-[999999] flex flex-col items-end gap-2 pointer-events-none" style={{ width: 'max-content', maxWidth: '360px' }}>
                {/* ... existing toasts logic */}
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className="inline-flex items-center gap-3 px-4 py-3 rounded-xl pointer-events-auto"
                        style={{
                            background: 'var(--card-bg)',
                            border: '1px solid var(--active-nav-border)',
                            boxShadow: '0 8px 24px var(--shadow-color), 0 0 0 1px var(--active-nav-border) inset',
                            animation: 'slideIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                        }}
                    >
                        <span
                            className="flex items-center justify-center shrink-0 w-7 h-7 rounded-lg"
                            style={{
                                background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'var(--active-nav-bg)',
                                color: toast.type === 'error' ? '#ef4444' : 'var(--accent)',
                            }}
                        >
                            {toast.type === 'error' ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                                </svg>
                            )}
                        </span>
                        <p className="text-sm font-medium" style={{ color: 'var(--heading-text)' }}>
                            {toast.message}
                        </p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="ml-2 opacity-40 hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--muted-text)' }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
            <style jsx global>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(24px) scale(0.95); }
                    to { opacity: 1; transform: translateX(0) scale(1); }
                }
            `}</style>
        </NotificationContext.Provider>
    )
}

export function useNotification() {
    const context = useContext(NotificationContext)
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider')
    }
    return context
}
