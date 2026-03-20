'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { deleteFile, getSignedUrl } from './actions'

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

export default function StorageClient({ initialDocuments }: StorageClientProps) {
    const [documents, setDocuments] = useState(initialDocuments)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
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

            // Direct client-side upload avoids all Next.js Server Action streaming bugs
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

            // Save metadata to DB directly from client
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
                // Add to UI immediately without waiting for server response
                if (newDoc) {
                    setDocuments(prev => [newDoc as Document, ...prev])
                }
                // Smooth Next.js hydrate instead of aggressive window reload
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
        if (!confirm('Are you sure you want to delete this file?')) return

        setDocuments(prev => prev.filter(d => d.id !== id))
        
        const result = await deleteFile(id, filePath)
        if (result.error) {
            alert(result.error)
        }
        
        router.refresh()
    }

    const handleDownload = async (filePath: string, fileName: string) => {
        const result = await getSignedUrl(filePath)
        if (result.error || !result.signedUrl) {
            alert(result.error || 'Could not download file')
            return
        }

        // Trigger download
        const a = document.createElement('a')
        a.href = result.signedUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const getFileIcon = (type: string) => {
        if (type.includes('image')) return '🖼️'
        if (type.includes('pdf')) return '📕'
        if (type.includes('video')) return '🎥'
        if (type.includes('audio')) return '🎵'
        if (type.includes('text')) return '📄'
        return '📁'
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            {/* Header / Upload */}
            <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-[#1a1c28]">
                <div className="text-sm font-medium text-gray-400">
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
                        {uploading ? '⏳ Uploading...' : '☁️ Upload File'}
                    </button>
                </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-auto p-6">
                {documents.length === 0 ? (
                    <div className="text-center py-20 bg-white/[0.02] border border-white/[0.02] rounded-2xl border-dashed">
                        <div className="text-4xl mb-4">🗂️</div>
                        <h3 className="text-lg font-medium text-gray-300">No files yet</h3>
                        <p className="text-sm text-gray-500 mt-1">Upload your first document to get started</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {documents.map(doc => (
                            <div 
                                key={doc.id} 
                                className="group bg-[#1a1c28] border border-white/5 rounded-xl p-4 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-900/10 transition-all duration-200"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center text-xl shrink-0">
                                        {getFileIcon(doc.file_type)}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => handleDownload(doc.file_path, doc.file_name)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-300 hover:bg-violet-500 hover:text-white transition-colors"
                                            title="Download"
                                        >
                                            ⬇️
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(doc.id, doc.file_path)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-300 hover:bg-red-500 hover:text-white transition-colors"
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <h4 className="font-medium text-gray-200 truncate mb-1" title={doc.file_name}>
                                    {doc.file_name}
                                </h4>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span>{formatSize(doc.file_size)}</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
