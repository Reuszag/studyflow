import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StorageClient from './StorageClient'

export default async function StoragePage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: documents } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto h-full flex flex-col w-full">
            <div className="mb-8 flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-3xl font-bold mb-1" style={{ color: 'var(--heading-text)' }}>Storage</h2>
                    <p style={{ color: 'var(--muted-text)' }}>Securely store and access your personal documents</p>
                </div>
            </div>

            <StorageClient initialDocuments={documents || []} />
        </div>
    )
}
