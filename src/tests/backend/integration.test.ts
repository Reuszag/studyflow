// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

type MockResult = { data?: unknown; error?: { message: string; code?: string } | null }

function makeSupabase(overrides: Record<string, unknown> = {}) {
    const chainable = (result: MockResult = { data: null, error: null }) => {
        const obj: Record<string, unknown> = {}
        const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq',
            'ilike', 'limit', 'single', 'order', 'filter']
        for (const m of methods) {
            obj[m] = vi.fn(() => Promise.resolve(result))
        }
        for (const m of methods) {
            ;(obj[m] as ReturnType<typeof vi.fn>).mockReturnValue(obj)
        }
        ;(obj.single as ReturnType<typeof vi.fn>).mockResolvedValue(result)
        ;(obj.limit as ReturnType<typeof vi.fn>).mockResolvedValue(result)
        ;(obj.order as ReturnType<typeof vi.fn>).mockResolvedValue(result)
        return obj
    }

    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123', email: 'test@test.com' } } }),
            signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
            updateUser: vi.fn().mockResolvedValue({ error: null }),
            signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user', identities: [{}] }, session: null }, error: null }),
            signOut: vi.fn().mockResolvedValue({}),
        },
        from: vi.fn(() => chainable({ data: null, error: null })),
        storage: {
            from: vi.fn(() => ({
                list: vi.fn().mockResolvedValue({ data: [], error: null }),
                remove: vi.fn().mockResolvedValue({ error: null }),
                upload: vi.fn().mockResolvedValue({ error: null }),
            })),
        },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        ...overrides,
    }
}

let mockSupabase = makeSupabase()

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => Promise.resolve(mockSupabase),
}))

// ─── Import actions AFTER mock is set up ─────────────────────────────────────
const {
    createNote, updateNote, deleteNote, checkDuplicateTitle,
    shareNote, updateSharePermission, removeShare, getNoteShares,
    leaveSharedNote, getNote,
} = await import('@/app/(dashboard)/dashboard/notes/actions')

const {
    addTask, toggleTask, archiveTask, unarchiveTask, deleteTask,
} = await import('@/app/(dashboard)/dashboard/tasks/actions')

const {
    saveCalculation, deleteCalculation, getSavedCalculations, updateCalculation,
} = await import('@/app/(dashboard)/dashboard/gpa/actions')

const {
    getProfile, updateProfile, changePassword,
} = await import('@/app/(dashboard)/dashboard/profile/actions')

beforeEach(() => {
    mockSupabase = makeSupabase()
    vi.clearAllMocks()
})

describe('createNote', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await createNote()
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('inserts with title Untitled when no existing notes', async () => {
        const insertSingle = vi.fn().mockResolvedValue({ data: { id: 'note-1' }, error: null })
        const insertChain = { select: vi.fn(() => ({ single: insertSingle })) }
        const selectChain = { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })) }

        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
                insert: vi.fn(() => insertChain),
            }
            return {}
        })

        const result = await createNote()
        expect(result).toHaveProperty('id', 'note-1')
    })

    it('inserts with title Untitled1 when Untitled already exists', async () => {
        let insertedTitle = ''

        // createNote calls .from('notes') twice:
        //   1st: .select('title').eq(...)         → existing titles
        //   2nd: .insert({...}).select('id').single() → create note
        let callCount = 0
        mockSupabase.from = vi.fn(() => {
            callCount++
            if (callCount === 1) {
                // First call: fetch existing titles
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn().mockResolvedValue({ data: [{ title: 'Untitled' }], error: null }),
                    })),
                }
            }
            // Second call: insert new note
            return {
                insert: vi.fn((payload: { title: string }) => {
                    insertedTitle = payload.title
                    return {
                        select: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({ data: { id: 'note-2' }, error: null }),
                        })),
                    }
                }),
            }
        })

        await createNote()
        expect(insertedTitle).toBe('Untitled1')
    })

    it('inserts Untitled2 when Untitled and Untitled1 both exist', async () => {
        let insertedTitle = ''

        let callCount = 0
        mockSupabase.from = vi.fn(() => {
            callCount++
            if (callCount === 1) {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn().mockResolvedValue({
                            data: [{ title: 'Untitled' }, { title: 'Untitled1' }],
                            error: null,
                        }),
                    })),
                }
            }
            return {
                insert: vi.fn((payload: { title: string }) => {
                    insertedTitle = payload.title
                    return {
                        select: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({ data: { id: 'note-3' }, error: null }),
                        })),
                    }
                }),
            }
        })

        await createNote()
        expect(insertedTitle).toBe('Untitled2')
    })

    it('returns error when Supabase insert fails', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
            insert: vi.fn(() => ({
                select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
                })),
            })),
        }))

        const result = await createNote()
        expect(result).toHaveProperty('error')
    })
})

describe('checkDuplicateTitle', () => {
    it('returns duplicate:true when another note has same title', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    ilike: vi.fn(() => ({
                        neq: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({ data: [{ id: 'other-note' }], error: null }),
                        })),
                    })),
                })),
            })),
        }))

        const result = await checkDuplicateTitle('my-note', 'My Title')
        expect(result).toEqual({ duplicate: true })
    })

    it('returns duplicate:false when no other note has that title', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    ilike: vi.fn(() => ({
                        neq: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                        })),
                    })),
                })),
            })),
        }))

        const result = await checkDuplicateTitle('my-note', 'Unique Title')
        expect(result).toEqual({ duplicate: false })
    })

    it('returns duplicate:false when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await checkDuplicateTitle('note-1', 'Title')
        expect(result).toEqual({ duplicate: false })
    })
})

describe('updateNote', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await updateNote('note-1', 'Title', {})
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('calls update on notes table', async () => {
        const updateFn = vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
        }))
        mockSupabase.from = vi.fn(() => ({ update: updateFn }))

        await updateNote('note-1', 'My Note', { content: [] })
        expect(updateFn).toHaveBeenCalled()
    })

    it('normalizes proxy URLs to public URLs before persisting', async () => {
        let persistedContent: unknown = null
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn((payload: { content: unknown }) => {
                persistedContent = payload.content
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
        }))

        const proxyContent = {
            content: [{
                type: 'image',
                attrs: { src: '/api/note-image?path=user%2Ffile.png&noteId=note-1' },
            }],
        }

        await updateNote('note-1', 'Title', proxyContent)

        const saved = persistedContent as { content: Array<{ attrs: { src: string } }> }
        expect(saved.content[0].attrs.src).toContain('/storage/v1/object/public/note-images/')
        expect(saved.content[0].attrs.src).not.toContain('/api/note-image')
    })

    it('returns success on valid update', async () => {
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }))
        const result = await updateNote('note-1', 'Title', {})
        expect(result).toEqual({ success: true })
    })
})

describe('deleteNote', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await deleteNote('note-1')
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('calls storage.remove when note has images', async () => {
        const removeFn = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.storage = { from: vi.fn(() => ({ remove: removeFn })) }

        // The action uses process.env.NEXT_PUBLIC_SUPABASE_URL to build the public prefix.
        // In test env it is empty string, so the prefix becomes just
        // "/storage/v1/object/public/note-images/" — use that directly.
        const imgSrc = '/storage/v1/object/public/note-images/user-123/img.png'

        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                        data: { content: { content: [{ type: 'image', attrs: { src: imgSrc } }] } },
                        error: null,
                    }),
                })),
            })),
            delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }))

        await deleteNote('note-1')
        expect(removeFn).toHaveBeenCalled()
    })

    it('does NOT call storage.remove when note has no images', async () => {
        const removeFn = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.storage.from = vi.fn(() => ({ remove: removeFn }))

        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                        data: { content: { content: [{ type: 'paragraph' }] } },
                        error: null,
                    }),
                })),
            })),
            delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }))

        await deleteNote('note-1')
        expect(removeFn).not.toHaveBeenCalled()
    })

    it('returns success on valid delete', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { content: {} }, error: null }),
                })),
            })),
            delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }))

        const result = await deleteNote('note-1')
        expect(result).toEqual({ success: true })
    })
})

describe('shareNote', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await shareNote('note-1', 'other@test.com', 'view')
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when user is not the note owner', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                        data: { owner_id: 'different-user' },
                        error: null,
                    }),
                })),
            })),
        }))

        const result = await shareNote('note-1', 'other@test.com', 'view')
        expect(result).toEqual({ error: 'Only the note owner can share it' })
    })

    it('returns error when sharing with self', async () => {
        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123' }, error: null }),
                    })),
                })),
            }
            if (table === 'profiles') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null }),
                    })),
                })),
            }
            return {}
        })

        const result = await shareNote('note-1', 'test@test.com', 'view')
        expect(result).toEqual({ error: 'You cannot share a note with yourself' })
    })

    it('returns error when email not found in profiles or RPC', async () => {
        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123' }, error: null }),
                    })),
                })),
            }
            if (table === 'profiles') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
                    })),
                })),
            }
            return {}
        })
        mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null })

        const result = await shareNote('note-1', 'unknown@test.com', 'view')
        expect(result).toEqual({ error: 'No user found with that email address' })
    })

    it('falls back to RPC when profile lookup fails', async () => {
        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123' }, error: null }),
                    })),
                })),
            }
            if (table === 'profiles') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
                    })),
                })),
                update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
            }
            if (table === 'note_shares') return {
                insert: vi.fn().mockResolvedValue({ error: null }),
            }
            return {}
        })
        mockSupabase.rpc = vi.fn().mockResolvedValue({ data: 'other-user-456', error: null })

        await shareNote('note-1', 'other@test.com', 'view')
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_id_by_email', { lookup_email: 'other@test.com' })
    })

    it('returns already shared error on duplicate (code 23505)', async () => {
        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123' }, error: null }),
                    })),
                })),
            }
            if (table === 'profiles') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: { id: 'other-user' }, error: null }),
                    })),
                })),
            }
            if (table === 'note_shares') return {
                insert: vi.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } }),
            }
            return {}
        })

        const result = await shareNote('note-1', 'other@test.com', 'view')
        expect(result).toEqual({ error: 'This note is already shared with that user' })
    })
})

describe('updateSharePermission', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await updateSharePermission('share-1', 'edit', 'note-1')
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when user is not note owner', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { owner_id: 'other' }, error: null }),
                })),
            })),
        }))

        const result = await updateSharePermission('share-1', 'edit', 'note-1')
        expect(result).toEqual({ error: 'Only the note owner can change permissions' })
    })

    it('calls update_share_permission RPC with correct args', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123' }, error: null }),
                })),
            })),
        }))
        mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null })

        await updateSharePermission('share-1', 'edit', 'note-1')

        expect(mockSupabase.rpc).toHaveBeenCalledWith('update_share_permission', {
            p_share_id: 'share-1',
            p_note_id: 'note-1',
            p_permission: 'edit',
            p_owner_id: 'user-123',
        })
    })

    it('returns success on valid update', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: { owner_id: 'user-123' }, error: null }),
                })),
            })),
        }))
        mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null })

        const result = await updateSharePermission('share-1', 'view', 'note-1')
        expect(result).toEqual({ success: true })
    })
})

describe('removeShare', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await removeShare('share-1', 'note-1')
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('calls remove_share RPC with correct args', async () => {
        mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null })

        await removeShare('share-1', 'note-1')

        expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_share', {
            p_share_id: 'share-1',
            p_note_id: 'note-1',
            p_owner_id: 'user-123',
        })
    })

    it('returns success when RPC succeeds', async () => {
        mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null })
        const result = await removeShare('share-1', 'note-1')
        expect(result).toEqual({ success: true })
    })
})

describe('getNoteShares', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await getNoteShares('note-1')
        expect(result).toEqual({ error: 'Not authenticated', shares: [] })
    })

    it('returns empty shares array when no shares exist', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            })),
        }))

        const result = await getNoteShares('note-1')
        expect(result).toEqual({ shares: [] })
    })

    it('calls get_user_email_by_id RPC for each share', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                    data: [
                        { id: 'share-1', permission: 'view', shared_with: 'user-a' },
                        { id: 'share-2', permission: 'edit', shared_with: 'user-b' },
                    ],
                    error: null,
                }),
            })),
        }))
        mockSupabase.rpc = vi.fn().mockResolvedValue({ data: 'someone@test.com', error: null })

        await getNoteShares('note-1')

        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_email_by_id', { lookup_id: 'user-a' })
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_email_by_id', { lookup_id: 'user-b' })
    })

    it('enriches shares with email from RPC', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                    data: [{ id: 'share-1', permission: 'view', shared_with: 'user-a' }],
                    error: null,
                }),
            })),
        }))
        mockSupabase.rpc = vi.fn().mockResolvedValue({ data: 'found@test.com', error: null })

        const result = await getNoteShares('note-1')
        expect(result.shares[0]).toMatchObject({
            profiles: { email: 'found@test.com' },
        })
    })
})

describe('leaveSharedNote', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await leaveSharedNote('note-1')
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('deletes share row matching current user', async () => {
        const eqFn = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.from = vi.fn(() => ({
            delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: eqFn })) })),
        }))

        await leaveSharedNote('note-1')
        expect(eqFn).toHaveBeenCalled()
    })

    it('returns success on valid leave', async () => {
        mockSupabase.from = vi.fn(() => ({
            delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })) })),
        }))

        const result = await leaveSharedNote('note-1')
        expect(result).toEqual({ success: true })
    })
})

describe('getNote', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await getNote('note-1')
        expect(result).toEqual({ error: 'Not authenticated', note: null })
    })

    it('returns error when note not found', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
                })),
            })),
        }))

        const result = await getNote('note-1')
        expect(result).toEqual({ error: 'Note not found or access denied', note: null })
    })

    it('sets canEdit true for note owner', async () => {
        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({
                            data: { id: 'note-1', owner_id: 'user-123', content: {}, updated_by: null },
                            error: null,
                        }),
                    })),
                })),
            }
            return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) }
        })

        const result = await getNote('note-1')
        expect(result.canEdit).toBe(true)
    })

    it('sets canEdit true for shared user with edit permission', async () => {
        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({
                            data: { id: 'note-1', owner_id: 'other-owner', content: {}, updated_by: null },
                            error: null,
                        }),
                    })),
                })),
            }
            if (table === 'note_shares') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({ data: { permission: 'edit' }, error: null }),
                        })),
                    })),
                })),
            }
            return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) }
        })

        const result = await getNote('note-1')
        expect(result.canEdit).toBe(true)
    })

    it('sets canEdit false for shared user with view permission', async () => {
        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({
                            data: { id: 'note-1', owner_id: 'other-owner', content: {}, updated_by: null },
                            error: null,
                        }),
                    })),
                })),
            }
            if (table === 'note_shares') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn().mockResolvedValue({ data: { permission: 'view' }, error: null }),
                        })),
                    })),
                })),
            }
            return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) }
        })

        const result = await getNote('note-1')
        expect(result.canEdit).toBe(false)
    })

    it('rewrites public image URLs to proxy URLs in note content', async () => {
        // In test env NEXT_PUBLIC_SUPABASE_URL is empty, so prefix is just the path portion
        const publicSrc = '/storage/v1/object/public/note-images/user/img.png'

        mockSupabase.from = vi.fn((table: string) => {
            if (table === 'notes') return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({
                            data: {
                                id: 'note-1',
                                owner_id: 'user-123',
                                updated_by: null,
                                content: {
                                    content: [{ type: 'image', attrs: { src: publicSrc } }],
                                },
                            },
                            error: null,
                        }),
                    })),
                })),
            }
            return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) }
        })

        const result = await getNote('note-1')
        const content = result.note?.content as { content: Array<{ attrs: { src: string } }> }
        expect(content.content[0].attrs.src).toContain('/api/note-image')
        expect(content.content[0].attrs.src).not.toContain('/storage/v1/object/public')
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// TASKS ACTIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('addTask', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const fd = new FormData()
        fd.append('title', 'My Task')
        const result = await addTask(fd)
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when title is empty', async () => {
        const fd = new FormData()
        fd.append('title', '   ')
        const result = await addTask(fd)
        expect(result).toEqual({ error: 'Title is required' })
    })

    it('returns error when title is missing', async () => {
        const fd = new FormData()
        const result = await addTask(fd)
        expect(result).toEqual({ error: 'Title is required' })
    })

    it('inserts task with status ongoing', async () => {
        let insertedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            insert: vi.fn((payload: unknown) => {
                insertedData = payload
                return Promise.resolve({ error: null })
            }),
        }))

        const fd = new FormData()
        fd.append('title', 'Study math')
        await addTask(fd)

        expect(insertedData).toMatchObject({ status: 'ongoing' })
    })

    it('trims whitespace from title', async () => {
        let insertedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            insert: vi.fn((payload: unknown) => {
                insertedData = payload
                return Promise.resolve({ error: null })
            }),
        }))

        const fd = new FormData()
        fd.append('title', '  Study math  ')
        await addTask(fd)

        expect(insertedData).toMatchObject({ title: 'Study math' })
    })

    it('returns success on valid insert', async () => {
        mockSupabase.from = vi.fn(() => ({
            insert: vi.fn().mockResolvedValue({ error: null }),
        }))

        const fd = new FormData()
        fd.append('title', 'My Task')
        const result = await addTask(fd)
        expect(result).toEqual({ success: true })
    })
})

describe('toggleTask', () => {
    it('sets status to completed when currently ongoing', async () => {
        let updatedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn((payload: unknown) => {
                updatedData = payload
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
        }))

        await toggleTask('task-1', 'ongoing')
        expect(updatedData).toMatchObject({ status: 'completed' })
    })

    it('sets status to ongoing when currently completed', async () => {
        let updatedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn((payload: unknown) => {
                updatedData = payload
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
        }))

        await toggleTask('task-1', 'completed')
        expect(updatedData).toMatchObject({ status: 'ongoing' })
    })

    it('sets completed_at when completing task', async () => {
        let updatedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn((payload: unknown) => {
                updatedData = payload
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
        }))

        await toggleTask('task-1', 'ongoing')
        expect((updatedData as { completed_at: string }).completed_at).toBeTruthy()
    })

    it('clears completed_at when un-completing task', async () => {
        let updatedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn((payload: unknown) => {
                updatedData = payload
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
        }))

        await toggleTask('task-1', 'completed')
        expect((updatedData as { completed_at: null }).completed_at).toBeNull()
    })
})

describe('archiveTask', () => {
    it('sets status to archived', async () => {
        let updatedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn((payload: unknown) => {
                updatedData = payload
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
        }))

        await archiveTask('task-1')
        expect(updatedData).toMatchObject({ status: 'archived' })
    })

    it('returns success on valid archive', async () => {
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }))
        const result = await archiveTask('task-1')
        expect(result).toEqual({ success: true })
    })
})

describe('unarchiveTask', () => {
    it('sets status back to ongoing', async () => {
        let updatedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn((payload: unknown) => {
                updatedData = payload
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
        }))

        await unarchiveTask('task-1')
        expect(updatedData).toMatchObject({ status: 'ongoing' })
    })

    it('returns success on valid unarchive', async () => {
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }))
        const result = await unarchiveTask('task-1')
        expect(result).toEqual({ success: true })
    })
})

describe('deleteTask', () => {
    it('calls delete with correct task id', async () => {
        const eqFn = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.from = vi.fn(() => ({
            delete: vi.fn(() => ({ eq: eqFn })),
        }))

        await deleteTask('task-99')
        expect(eqFn).toHaveBeenCalledWith('id', 'task-99')
    })

    it('returns success on valid delete', async () => {
        mockSupabase.from = vi.fn(() => ({
            delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }))
        const result = await deleteTask('task-1')
        expect(result).toEqual({ success: true })
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// GPA ACTIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('saveCalculation', () => {
    it('throws when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        await expect(saveCalculation('Test', [], 4.0, 10)).rejects.toThrow('Not authenticated')
    })

    it('inserts with correct user_id, gpa, total_credits', async () => {
        let insertedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            insert: vi.fn((payload: unknown) => {
                insertedData = payload
                return {
                    select: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({
                            data: { id: 'calc-1', name: 'Test', subjects: [], gpa: 4.0, total_credits: 10, created_at: '' },
                            error: null,
                        }),
                    })),
                }
            }),
        }))

        await saveCalculation('Test', [], 4.0, 10)
        expect(insertedData).toMatchObject({ user_id: 'user-123', gpa: 4.0, total_credits: 10 })
    })

    it('returns saved calculation data', async () => {
        const mockData = { id: 'calc-1', name: 'Semester 1', subjects: [], gpa: 3.8, total_credits: 30, created_at: '' }
        mockSupabase.from = vi.fn(() => ({
            insert: vi.fn(() => ({
                select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
                })),
            })),
        }))

        const result = await saveCalculation('Semester 1', [], 3.8, 30)
        expect(result).toEqual(mockData)
    })
})

describe('deleteCalculation', () => {
    it('calls delete with correct id', async () => {
        const eqFn = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.from = vi.fn(() => ({
            delete: vi.fn(() => ({ eq: eqFn })),
        }))

        await deleteCalculation('calc-99')
        expect(eqFn).toHaveBeenCalledWith('id', 'calc-99')
    })

    it('throws when Supabase returns error', async () => {
        mockSupabase.from = vi.fn(() => ({
            delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }) })),
        }))
        await expect(deleteCalculation('calc-1')).rejects.toThrow('DB error')
    })
})

describe('getSavedCalculations', () => {
    it('returns calculations ordered by created_at', async () => {
        const mockData = [
            { id: '1', name: 'A', subjects: [], gpa: 4.0, total_credits: 10, created_at: '2024-01-02' },
            { id: '2', name: 'B', subjects: [], gpa: 3.5, total_credits: 8, created_at: '2024-01-01' },
        ]
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            })),
        }))

        const result = await getSavedCalculations()
        expect(result).toHaveLength(2)
        expect(result[0].name).toBe('A')
    })

    it('throws when Supabase returns error', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            })),
        }))
        await expect(getSavedCalculations()).rejects.toThrow('DB error')
    })
})

describe('updateCalculation', () => {
    it('filters by user_id to prevent updating other users data', async () => {
        const eqCalls: string[] = []
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn(() => ({
                eq: vi.fn((col: string) => {
                    eqCalls.push(col)
                    return {
                        eq: vi.fn((col2: string) => {
                            eqCalls.push(col2)
                            return {
                                select: vi.fn(() => ({
                                    single: vi.fn().mockResolvedValue({
                                        data: { id: 'c1', name: 'X', subjects: [], gpa: 4.0, total_credits: 5, created_at: '' },
                                        error: null,
                                    }),
                                })),
                            }
                        }),
                    }
                }),
            })),
        }))

        await updateCalculation('calc-1', 'New Name', [], 4.0, 5)
        expect(eqCalls).toContain('user_id')
    })
})

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE ACTIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('getProfile', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await getProfile()
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns profile and email on success', async () => {
        mockSupabase.from = vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({
                        data: { id: 'user-123', full_name: 'Test User' },
                        error: null,
                    }),
                })),
            })),
        }))

        const result = await getProfile()
        expect(result).toMatchObject({ email: 'test@test.com' })
        expect(result).toHaveProperty('profile')
    })
})

describe('updateProfile', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const fd = new FormData()
        fd.append('full_name', 'Test')
        const result = await updateProfile(fd)
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('updates full_name and timezone', async () => {
        let updatedData: unknown = null
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn((payload: unknown) => {
                updatedData = payload
                return { eq: vi.fn().mockResolvedValue({ error: null }) }
            }),
        }))

        const fd = new FormData()
        fd.append('full_name', 'John Doe')
        fd.append('timezone', 'Europe/Budapest')
        await updateProfile(fd)

        expect(updatedData).toMatchObject({ full_name: 'John Doe', timezone: 'Europe/Budapest' })
    })

    it('returns success on valid update', async () => {
        mockSupabase.from = vi.fn(() => ({
            update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
        }))

        const fd = new FormData()
        fd.append('full_name', 'Test')
        const result = await updateProfile(fd)
        expect(result).toEqual({ success: true })
    })
})

describe('changePassword', () => {
    it('returns error when unauthenticated', async () => {
        mockSupabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null } })
        const result = await changePassword('old', 'New1!')
        expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when current password is wrong', async () => {
        mockSupabase.auth.signInWithPassword = vi.fn().mockResolvedValue({
            error: { message: 'Invalid login credentials' },
        })

        const result = await changePassword('wrongpassword', 'New1!')
        expect(result).toEqual({ error: 'Current password is incorrect.' })
    })

    it('calls updateUser with new password when current password correct', async () => {
        mockSupabase.auth.signInWithPassword = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.auth.updateUser = vi.fn().mockResolvedValue({ error: null })

        await changePassword('correctpass', 'NewPass1!')
        expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPass1!' })
    })

    it('returns success on valid password change', async () => {
        mockSupabase.auth.signInWithPassword = vi.fn().mockResolvedValue({ error: null })
        mockSupabase.auth.updateUser = vi.fn().mockResolvedValue({ error: null })

        const result = await changePassword('correctpass', 'NewPass1!')
        expect(result).toEqual({ success: true })
    })
})
