'use client'

export default function ViewLastActivityButton() {
    return (
        <button
            type="button"
            onClick={() => {
                const section = document.getElementById('recent-activity')
                section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="w-full mt-8 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-violet-500/10 flex items-center justify-center gap-2"
            style={{ color: 'var(--muted-text)', borderWidth: '1px', borderStyle: 'dashed', borderColor: 'var(--heading-text)', opacity: 0.6 }}
        >
            View last activity
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
            </svg>
        </button>
    )
}