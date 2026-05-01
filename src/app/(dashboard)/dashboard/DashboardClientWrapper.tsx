'use client'

import { TimerProvider } from '@/lib/TimerContext'
import { NotificationProvider } from '@/lib/NotificationContext'
import MiniTimer from './MiniTimer'
import NoteNotifications from './NoteNotifications'
import type { ReactNode } from 'react'

export default function DashboardClientWrapper({ children }: { children: ReactNode }) {
    return (
        <NotificationProvider>
            <TimerProvider>
                {children}
                <MiniTimer />
                <NoteNotifications />
            </TimerProvider>
        </NotificationProvider>
    )
}
