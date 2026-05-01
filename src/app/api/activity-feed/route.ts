import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch recent activity data
        const { data: recentTasks } = await supabase
            .from('tasks')
            .select('title, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3)

        const { data: recentDocs } = await supabase
            .from('documents')
            .select('file_name, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3)

        const { data: recentNotes } = await supabase
            .from('notes')
            .select('title, created_at, updated_at')
            .eq('owner_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(3)

        const Icons = {
            Tasks: 'Tasks',
            Storage: 'Storage',
            Notes: 'Notes',
        }

        const activityFeed = [
            ...(recentTasks?.map(t => ({
                title: `Task: ${t.title}`,
                timestamp: new Date(t.created_at).getTime(),
                time: new Date(t.created_at).toLocaleDateString(),
                icon: Icons.Tasks,
                color: 'text-blue-400',
            })) || []),
            ...(recentDocs?.map(d => ({
                title: `Doc: ${d.file_name}`,
                timestamp: new Date(d.created_at).getTime(),
                time: new Date(d.created_at).toLocaleDateString(),
                icon: Icons.Storage,
                color: 'text-emerald-400',
            })) || []),
            ...(recentNotes?.map(n => {
                const createdAt = new Date(n.created_at).getTime()
                const updatedAt = new Date(n.updated_at).getTime()
                const isEdited = updatedAt - createdAt > 2000
                return {
                    title: `${isEdited ? 'Edited note' : 'Created note'}: ${n.title}`,
                    timestamp: updatedAt,
                    time: new Date(updatedAt).toLocaleDateString(),
                    icon: Icons.Notes,
                    color: 'text-violet-400',
                }
            }) || []),
        ]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 3)

        return NextResponse.json(activityFeed)
    } catch (error) {
        console.error('Error fetching activity feed:', error)
        return NextResponse.json({ error: 'Failed to fetch activity feed' }, { status: 500 })
    }
}
