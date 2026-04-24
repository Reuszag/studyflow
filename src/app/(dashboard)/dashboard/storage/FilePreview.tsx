'use client'

import { useState, useEffect } from 'react'

interface FilePreviewProps {
    isOpen: boolean
    onClose: () => void
    fileName: string
    fileType: string
    proxyUrl: string // Our secure internal proxy
    directUrl: string // The Supabase signed URL (needed for Office viewer)
}

export default function FilePreview({ isOpen, onClose, fileName, fileType, proxyUrl, directUrl }: FilePreviewProps) {
    const [textContent, setTextContent] = useState<string | null>(null)
    const [localUrl, setLocalUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!isOpen) return

        const isText = fileType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.md')
        const isPdf = fileType.includes('pdf') || fileName.endsWith('.pdf')
        const isImage = fileType.includes('image')
        const isOffice = fileName.endsWith('.docx') || fileName.endsWith('.pptx') || fileName.endsWith('.xlsx')

        // Office files are handled by an external iframe viewer and don't need fetching
        if (isOffice) {
            setLoading(false)
            return
        }

        if (isText || isPdf || isImage) {
            setLoading(true)
            setError(null)
            
            // Use the proxy URL to avoid CORS issues
            fetch(proxyUrl)
                .then(async (res) => {
                    if (!res.ok) throw new Error('Failed to fetch file via proxy')
                    
                    if (isText) {
                        const text = await res.text()
                        setTextContent(text)
                    } else {
                        const blob = await res.blob()
                        const url = URL.createObjectURL(blob)
                        setLocalUrl(url)
                    }
                    setLoading(false)
                })
                .catch((err) => {
                    console.error('Preview error:', err)
                    setError('This file could not be loaded for preview. It may be too large or blocked by security settings.')
                    setLoading(false)
                })
        }

        return () => {
            setTextContent(null)
            setError(null)
            setLoading(false)
        }
    }, [isOpen, proxyUrl, fileType, fileName])

    // Specific cleanup for Blob URLs to prevent memory leaks
    useEffect(() => {
        if (!isOpen && localUrl) {
            URL.revokeObjectURL(localUrl)
            setLocalUrl(null)
        }
    }, [isOpen, localUrl])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (localUrl) URL.revokeObjectURL(localUrl)
        }
    }, [])

    if (!isOpen) return null

    const isOffice = fileName.endsWith('.docx') || fileName.endsWith('.pptx') || fileName.endsWith('.xlsx')
    const displayUrl = localUrl || proxyUrl

    return (
        <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 md:p-10 bg-black/80 backdrop-blur-sm transition-all duration-300">
            <div 
                className="relative w-full h-full max-w-6xl rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
            >
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b shrink-0" style={{ borderColor: 'var(--card-border)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--hover-overlay)', color: 'var(--accent)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                            </svg>
                        </div>
                        <h3 className="font-bold truncate max-w-md" style={{ color: 'var(--heading-text)' }}>{fileName}</h3>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-white/10 active:scale-90"
                        style={{ color: 'var(--muted-text)' }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-black/20 flex items-center justify-center relative">
                    {loading && (
                        <div className="flex flex-col items-center gap-3">
                            <svg className="animate-spin w-8 h-8 text-violet-500" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                            <span className="text-sm font-medium" style={{ color: 'var(--muted-text)' }}>Preparing preview...</span>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="text-center p-10">
                            <h4 className="text-lg font-bold text-red-400 mb-2">Error Loading File</h4>
                            <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--muted-text)' }}>{error}</p>
                        </div>
                    )}

                    {!loading && !error && fileType.includes('image') && (
                        <img src={displayUrl} alt={fileName} className="max-w-full max-h-full object-contain p-4" />
                    )}

                    {!loading && !error && fileType.includes('pdf') && (
                        <iframe src={displayUrl} className="w-full h-full border-none" title="PDF Preview" />
                    )}

                    {!loading && !error && textContent !== null && (
                        <pre className="p-8 w-full h-full font-mono text-sm overflow-auto whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--body-text)' }}>
                            {textContent}
                        </pre>
                    )}

                    {!loading && !error && isOffice && (
                        <iframe 
                            src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(directUrl)}`} 
                            className="w-full h-full border-none" 
                            title="Office Preview" 
                        />
                    )}

                    {!loading && !error && !textContent && !localUrl && !isOffice && (
                        <div className="text-center p-10">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center" style={{ background: 'var(--hover-overlay)', color: 'var(--muted-text)' }}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                                </svg>
                            </div>
                            <h4 className="text-xl font-bold mb-2" style={{ color: 'var(--heading-text)' }}>Preview Unavailable</h4>
                            <p className="max-w-xs mx-auto text-sm mb-6" style={{ color: 'var(--muted-text)' }}>
                                This file type ({fileType}) cannot be previewed directly.
                            </p>
                            <a 
                                href={directUrl} 
                                download={fileName}
                                className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all shadow-lg inline-block"
                            >
                                Download to View
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
