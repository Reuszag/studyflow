'use server'

import { createClient } from '@/lib/supabase/server'

export interface SubjectRow {
    name: string
    credits: number
    grade: number
}

export interface SavedCalcRow {
    id: string
    name: string
    subjects: SubjectRow[]
    gpa: number
    total_credits: number
    created_at: string
}

export async function getSavedCalculations(): Promise<SavedCalcRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('gpa_calculations')
        .select('id, name, subjects, gpa, total_credits, created_at')
        .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data as SavedCalcRow[]
}

export async function saveCalculation(
    name: string,
    subjects: SubjectRow[],
    gpa: number,
    totalCredits: number,
): Promise<SavedCalcRow> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('gpa_calculations')
        .insert({ user_id: user.id, name, subjects, gpa, total_credits: totalCredits })
        .select('id, name, subjects, gpa, total_credits, created_at')
        .single()
    if (error) throw new Error(error.message)
    return data as SavedCalcRow
}

export async function deleteCalculation(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
        .from('gpa_calculations')
        .delete()
        .eq('id', id)
    if (error) throw new Error(error.message)
}

export async function updateCalculation(
    id: string,
    name: string,
    subjects: SubjectRow[],
    gpa: number,
    totalCredits: number,
): Promise<SavedCalcRow> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
        .from('gpa_calculations')
        .update({ name, subjects, gpa, total_credits: totalCredits })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id, name, subjects, gpa, total_credits, created_at')
        .single()
    if (error) throw new Error(error.message)
    return data as SavedCalcRow
}
