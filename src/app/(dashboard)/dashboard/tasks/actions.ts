'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addTask(formData: FormData) {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Not authenticated' }
    }

    const title = formData.get('title') as string
    const priority = (formData.get('priority') as string) || 'medium'
    const plannedDate = formData.get('planned_date') as string

    if (!title || title.trim() === '') {
        return { error: 'Title is required' }
    }

    const { error } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: title.trim(),
        priority,
        status: 'ongoing',
        planned_date: plannedDate || null,
    })

    if (error) {
        console.error('Error adding task:', error)
        return { error: `Failed to add task: ${error.message}` }
    }

    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { success: true }
}

export async function toggleTask(id: string, currentStatus: string) {
    const supabase = await createClient()
    
    const newStatus = currentStatus === 'completed' ? 'ongoing' : 'completed'
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null

    const { error } = await supabase
        .from('tasks')
        .update({ 
            status: newStatus,
            completed_at: completedAt,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        console.error('Error toggling task:', error)
        return { error: `Failed to update task: ${error.message}` }
    }

    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { success: true }
}

export async function updateTaskStatus(id: string, status: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('tasks')
        .update({ 
            status, 
            completed_at: status === 'completed' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString() 
        })
        .eq('id', id)

    if (error) {
        console.error('Error updating task status:', error)
        return { error: `Failed to move task: ${error.message}` }
    }

    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { success: true }
}

export async function archiveTask(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('tasks')
        .update({
            status: 'archived',
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        console.error('Error archiving task:', error)
        return { error: `Failed to archive task: ${error.message}` }
    }

    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { success: true }
}

export async function unarchiveTask(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('tasks')
        .update({
            status: 'ongoing',
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        console.error('Error unarchiving task:', error)
        return { error: `Failed to unarchive task: ${error.message}` }
    }

    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { success: true }
}

export async function deleteTask(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting task:', error)
        return { error: `Failed to delete task: ${error.message}` }
    }

    revalidatePath('/dashboard/tasks')
    revalidatePath('/dashboard')
    return { success: true }
}
