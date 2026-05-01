import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TaskBoard from './TaskBoard'

export default async function TasksPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Fetch tasks ordered by created_at descending
    const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto h-full flex flex-col w-full">
            <div className="mb-8 flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-3xl font-bold mb-1" style={{ color: 'var(--heading-text)' }}>Tasks</h2>
                    <p style={{ color: 'var(--muted-text)' }}>Manage your to-dos and assignments</p>
                </div>
            </div>

            <TaskBoard initialTasks={tasks || []} />
        </div>
    )
}
