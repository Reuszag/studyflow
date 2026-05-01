'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deleteFile, getSignedUrl } from './actions'
import { useNotification } from '@/lib/NotificationContext'
import FilePreview from './FilePreview'

type Document = {
    id: string
    file_name: string
    file_path: string
    file_type: string
    file_size: number
    created_at: string
}

interface StorageClientProps {
    initialDocuments: Document[]
}

function isSummarizable(doc: Document) {
    const name = doc.file_name.toLowerCase()
    return (
        doc.file_type.includes('pdf') ||
        doc.file_type.includes('wordprocessingml') ||
        doc.file_type.includes('msword') ||
        name.endsWith('.pdf') ||
        name.endsWith('.docx') ||
        name.endsWith('.doc')
    )
}


export default function StorageClient({ initialDocuments }: StorageClientProps) {
    const { showNotification, confirm } = useNotification()
    const [documents, setDocuments] = useState(initialDocuments)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [summarizingId, setSummarizingId] = useState<string | null>(null)
    const [previewDoc, setPreviewDoc] = useState<{ name: string, type: string, url: string, path: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    useEffect(() => {
        setDocuments(initialDocuments)
    }, [initialDocuments])

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 20 * 1024 * 1024) {
             setError('File is too large. Max 20MB.')
             return
        }

        setUploading(true)
        setError('')

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setError('You must be logged in to upload files.')
                setUploading(false)
                return
            }

            const timestamp = Date.now()
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const filePath = `${user.id}/${timestamp}_${safeName}`

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) {
                console.error("Supabase Storage Error:", uploadError)
                setError('Failed to upload file to storage.')
                setUploading(false)
                return
            }

            const { data: newDoc, error: dbError } = await supabase.from('documents').insert({
                user_id: user.id,
                file_name: file.name,
                file_path: filePath,
                file_type: file.type || 'application/octet-stream',
                file_size: file.size,
            }).select().single();

            if (dbError) {
                console.error("Supabase DB Error:", dbError)
                setError('Failed to securely save metadata.')
            } else {
                if (newDoc) {
                    setDocuments(prev => [newDoc as Document, ...prev])
                }
                router.refresh()
            }
        } catch (err) {
            console.error("Upload exception:", err)
            setError('An unexpected error occurred during upload.')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleDelete = async (id: string, filePath: string) => {
        const confirmed = await confirm('Are you sure you want to delete this file?')
        if (!confirmed) return
        setDocuments(prev => prev.filter(d => d.id !== id))
        const result = await deleteFile(id, filePath)
        if (result.error) showNotification(result.error, 'error')
        router.refresh()
    }

    const handleDownload = async (filePath: string, fileName: string) => {
        const result = await getSignedUrl(filePath, true)
        if (result.error || !result.signedUrl) {
            showNotification(result.error || 'Could not download file', 'error')
            return
        }
        const a = document.createElement('a')
        a.href = result.signedUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    const handlePreview = async (doc: Document) => {
        const result = await getSignedUrl(doc.file_path, false)
        if (result.error || !result.signedUrl) {
            showNotification(result.error || 'Could not generate preview link', 'error')
            return
        }
        setPreviewDoc({
            name: doc.file_name,
            type: doc.file_type,
            url: result.signedUrl,
            path: doc.file_path
        })
    }

    const handleSummarize = async (doc: Document) => {
        setSummarizingId(doc.id)
        try {
            const res = await fetch('/api/summarize-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePath: doc.file_path,
                    fileType: doc.file_type,
                    fileName: doc.file_name,
                }),
            })
            const data = await res.json()
            if (!res.ok || data.error) {
                showNotification(data.error || 'Summarization failed', 'error')
            } else if (data.newDoc) {
                setDocuments(prev => [data.newDoc as Document, ...prev])
                router.refresh()
            }
        } catch {
            showNotification('Network error during summarization', 'error')
        } finally {
            setSummarizingId(null)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const getFileIcon = (type: string) => {
        if (type.includes('image')) return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        )
        if (type.includes('pdf')) return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        )
        if (type.includes('video')) return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        )
        if (type.includes('audio')) return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        )
        if (type.includes('text')) return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        )
        return (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        )
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl overflow-hidden shadow-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                {/* Header / Upload */}
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0" style={{ background: 'var(--card-bg-alt)', borderBottom: '1px solid var(--card-border)' }}>
                    <div className="text-sm font-medium" style={{ color: 'var(--muted-text)' }}>
                        {documents.length} files stored
                    </div>
                    <div className="flex items-center gap-3">
                        {error && <span className="text-xs text-red-400">{error}</span>}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleUpload}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {uploading ? (
                            <>
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                Uploading...
                            </>
                        ) : (
                            <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
                                Upload File
                            </>
                        )}
                        </button>
                    </div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-auto p-6">
                    {documents.length === 0 ? (
                        <div className="text-center py-20 rounded-2xl border-dashed" style={{ background: 'var(--overlay-soft)', border: '1px dashed var(--dashed-border)' }}>
                            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--overlay-medium)', color: 'var(--muted-text)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                            </div>
                            <h3 className="text-lg font-medium" style={{ color: 'var(--body-text)' }}>No files yet</h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--muted-text)' }}>Upload your first document to get started</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {documents.map(doc => (
                                <div
                                    key={doc.id}
                                    className="group rounded-xl p-4 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-900/10 transition-all duration-200"
                                    style={{ background: 'var(--card-bg-alt)', border: '1px solid var(--card-border)' }}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--overlay-soft)', color: 'var(--text-secondary)' }}>
                                            {getFileIcon(doc.file_type)}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handlePreview(doc)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-violet-500 hover:text-white transition-colors"
                                                style={{ background: 'var(--overlay-soft)', color: 'var(--text-secondary)' }}
                                                title="Preview"
                                            >
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                                </svg>
                                            </button>
                                            {isSummarizable(doc) && (
                                                <button
                                                    onClick={() => handleSummarize(doc)}
                                                    disabled={summarizingId === doc.id}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-violet-500 hover:text-white disabled:opacity-50"
                                                    style={{ background: 'var(--overlay-soft)', color: 'var(--text-secondary)' }}
                                                    title="AI Summary"
                                                >
                                                    {summarizingId === doc.id ? (
                                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                                        </svg>
                                                    ) : (
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
                                                            <path d="M19 15l.75 2.25L22 18l-2.25.75L19 21l-.75-2.25L16 18l2.25-.75z"/>
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDownload(doc.file_path, doc.file_name)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-violet-500 hover:text-white transition-colors"
                                                style={{ background: 'var(--overlay-soft)', color: 'var(--text-secondary)' }}
                                                title="Download"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(doc.id, doc.file_path)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                                                style={{ background: 'var(--overlay-soft)', color: 'var(--text-secondary)' }}
                                                title="Delete"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <h4 className="font-medium truncate mb-1" style={{ color: 'var(--body-text)' }} title={doc.file_name}>
                                        {doc.file_name}
                                    </h4>
                                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-quaternary)' }}>
                                        <span>{formatSize(doc.file_size)}</span>
                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--text-quaternary)' }}></span>
                                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {previewDoc && (
                    <FilePreview 
                        isOpen={!!previewDoc}
                        onClose={() => setPreviewDoc(null)}
                        fileName={previewDoc.name}
                        fileType={previewDoc.type}
                        proxyUrl={`/api/proxy-storage?path=${encodeURIComponent(previewDoc.path)}`}
                        directUrl={previewDoc.url}
                    />
                )}
        </div>
    )
}
