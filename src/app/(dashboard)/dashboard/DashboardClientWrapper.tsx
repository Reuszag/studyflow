'use client'

import { TimerProvider } from '@/lib/TimerContext'
import MiniTimer from './MiniTimer'
import type { ReactNode } from 'react'

export default function DashboardClientWrapper({ children }: { children: ReactNode }) {
    return (
        <TimerProvider>
            {children}
            <MiniTimer />
        </TimerProvider>
    )
}
