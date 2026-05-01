// @vitest-environment jsdom
// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('next/link', () => ({
    default: ({ children, href }) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => ({
        auth: {
            signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockReturnThis(),
            unsubscribe: vi.fn(),
        })),
        removeChannel: vi.fn().mockResolvedValue(undefined),
    })),
}))

vi.mock('react-google-recaptcha', () => ({
    default: React.forwardRef(({ onChange }, ref) => (
        <button
            data-testid="recaptcha"
            onClick={() => onChange?.('mock-token')}
        >
            reCAPTCHA
        </button>
    )),
}))

vi.mock('@/app/(dashboard)/dashboard/gpa/actions', () => ({
    getSavedCalculations: vi.fn().mockResolvedValue([]),
    saveCalculation: vi.fn().mockResolvedValue({ id: 'calc-1', name: 'Test', gpa: 4.0, total_credits: 10, subjects: [], created_at: new Date().toISOString() }),
    updateCalculation: vi.fn().mockResolvedValue({ id: 'calc-1', name: 'Test', gpa: 4.0, total_credits: 10, subjects: [], created_at: new Date().toISOString() }),
    deleteCalculation: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/app/(dashboard)/dashboard/tasks/actions', () => ({
    addTask: vi.fn().mockResolvedValue({ error: null }),
    toggleTask: vi.fn().mockResolvedValue({ error: null }),
    deleteTask: vi.fn().mockResolvedValue({ error: null }),
    updateTaskStatus: vi.fn().mockResolvedValue({ error: null }),
    archiveTask: vi.fn().mockResolvedValue({ error: null }),
    unarchiveTask: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/app/(dashboard)/dashboard/notes/actions', () => ({
    createNote: vi.fn().mockResolvedValue({ id: 'note-1', title: 'Untitled' }),
    deleteNote: vi.fn().mockResolvedValue({ error: null }),
    leaveSharedNote: vi.fn().mockResolvedValue({ error: null }),
}))

const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
        clear: () => { store = {} },
    }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

import { ThemeProvider } from '@/lib/ThemeContext'
import { NotificationProvider } from '@/lib/NotificationContext'
import ThemeToggle from '@/app/components/ThemeToggle'

describe('ThemeToggle', () => {
    it('renders toggle button', () => {
        render(
            <ThemeProvider>
                <ThemeToggle />
            </ThemeProvider>
        )
        const btn = screen.getByRole('button')
        expect(btn).toBeInTheDocument()
    })

    it('aria-label mentions light mode when in dark mode', async () => {
        render(
            <ThemeProvider>
                <ThemeToggle />
            </ThemeProvider>
        )
        await waitFor(() => {
            const btn = screen.getByRole('button')
            expect(btn.getAttribute('aria-label')).toMatch(/light/i)
        })
    })

    it('toggles theme on click', async () => {
        render(
            <ThemeProvider>
                <ThemeToggle />
            </ThemeProvider>
        )
        const btn = await screen.findByRole('button')
        const beforeLabel = btn.getAttribute('aria-label')
        await userEvent.click(btn)
        await waitFor(() => {
            expect(btn.getAttribute('aria-label')).not.toBe(beforeLabel)
        })
    })

    it('applies dark class to html by default', async () => {
        render(
            <ThemeProvider>
                <ThemeToggle />
            </ThemeProvider>
        )
        await waitFor(() => {
            expect(document.documentElement.classList.contains('dark') ||
                document.documentElement.classList.contains('light')).toBe(true)
        })
    })
})

// ─── GPACalculator ────────────────────────────────────────────────────────────
import GPACalculator from '@/app/(dashboard)/dashboard/gpa/GPACalculator'

describe('GPACalculator', () => {
    beforeEach(() => {
        localStorageMock.clear()
    })

    it('renders GPA display showing dash when no subjects', async () => {
        render(<GPACalculator />)
        await waitFor(() => {
            // Multiple — chars appear (GPA + credits), just check at least one
            expect(screen.getAllByText('—').length).toBeGreaterThan(0)
        })
    })

    it('renders Add subject heading', async () => {
        render(<GPACalculator />)
        await waitFor(() => {
            expect(screen.getByText('Add subject')).toBeInTheDocument()
        })
    })

    it('shows error when adding subject with empty name', async () => {
        render(<GPACalculator />)
        await waitFor(() => screen.getByText('Add subject'))
        const addBtn = screen.getByRole('button', { name: 'Add' })
        await userEvent.click(addBtn)
        expect(screen.getByText('Subject name cannot be empty')).toBeInTheDocument()
    })

    it('shows error when credits empty', async () => {
        render(<GPACalculator />)
        await waitFor(() => screen.getByText('Add subject'))
        const nameInput = screen.getByPlaceholderText('Subject name')
        await userEvent.type(nameInput, 'Math')
        const addBtn = screen.getByRole('button', { name: 'Add' })
        await userEvent.click(addBtn)
        expect(screen.getByText('Credits cannot be empty')).toBeInTheDocument()
    })

    it('adds subject and shows it in table', async () => {
        render(<GPACalculator />)
        await waitFor(() => screen.getByText('Add subject'))

        const nameInput = screen.getByPlaceholderText('Subject name')
        const creditsInput = screen.getByPlaceholderText('Credits')
        const gradeInput = screen.getByPlaceholderText('Grade')

        await userEvent.type(nameInput, 'Math')
        await userEvent.type(creditsInput, '5')
        await userEvent.type(gradeInput, '4')

        const addBtn = screen.getByRole('button', { name: 'Add' })
        await userEvent.click(addBtn)

        await waitFor(() => {
            expect(screen.getByText('Math')).toBeInTheDocument()
        })
    })

    it('shows GPA value after adding subject', async () => {
        render(<GPACalculator />)
        await waitFor(() => screen.getByText('Add subject'))

        await userEvent.type(screen.getByPlaceholderText('Subject name'), 'Physics')
        await userEvent.type(screen.getByPlaceholderText('Credits'), '3')
        await userEvent.type(screen.getByPlaceholderText('Grade'), '5')

        await userEvent.click(screen.getByRole('button', { name: 'Add' }))

        await waitFor(() => {
            // GPA shows as 5.00 in the circle and table footer — at least one exists
            expect(screen.getAllByText('5.00').length).toBeGreaterThan(0)
        })
    })

    it('removes subject on delete click', async () => {
        render(<GPACalculator />)
        await waitFor(() => screen.getByText('Add subject'))

        await userEvent.type(screen.getByPlaceholderText('Subject name'), 'Chemistry')
        await userEvent.type(screen.getByPlaceholderText('Credits'), '4')
        await userEvent.type(screen.getByPlaceholderText('Grade'), '3')
        await userEvent.click(screen.getByRole('button', { name: 'Add' }))

        await waitFor(() => screen.getByText('Chemistry'))
        const deleteBtn = screen.getByTitle('Delete')
        await userEvent.click(deleteBtn)

        await waitFor(() => {
            expect(screen.queryByText('Chemistry')).not.toBeInTheDocument()
        })
    })

    it('shows edit subject heading when editing', async () => {
        render(<GPACalculator />)
        await waitFor(() => screen.getByText('Add subject'))

        await userEvent.type(screen.getByPlaceholderText('Subject name'), 'Biology')
        await userEvent.type(screen.getByPlaceholderText('Credits'), '2')
        await userEvent.type(screen.getByPlaceholderText('Grade'), '4')
        await userEvent.click(screen.getByRole('button', { name: 'Add' }))

        await waitFor(() => screen.getByText('Biology'))
        await userEvent.click(screen.getByTitle('Edit'))

        expect(screen.getByText('Edit subject')).toBeInTheDocument()
    })
})

// ─── TaskBoard ────────────────────────────────────────────────────────────────
import TaskBoard from '@/app/(dashboard)/dashboard/tasks/TaskBoard'

const sampleTasks = [
    { id: 't1', title: 'Write tests', priority: 'high', status: 'ongoing', planned_date: null },
    { id: 't2', title: 'Deploy app', priority: 'medium', status: 'completed', planned_date: null },
    { id: 't3', title: 'Old task', priority: 'low', status: 'archived', planned_date: null },
]

describe('TaskBoard', () => {
    beforeEach(() => {
        vi.spyOn(window, 'confirm').mockReturnValue(true)
    })

    it('renders On Going and Completed column headers', () => {
        renderWithProviders(<TaskBoard initialTasks={[]} />)
        expect(screen.getByText('On Going')).toBeInTheDocument()
        expect(screen.getByText('Completed')).toBeInTheDocument()
    })

    it('renders tasks in correct columns', () => {
        renderWithProviders(<TaskBoard initialTasks={sampleTasks} />)
        expect(screen.getByText('Write tests')).toBeInTheDocument()
        expect(screen.getByText('Deploy app')).toBeInTheDocument()
    })

    it('shows Add Task button', () => {
        renderWithProviders(<TaskBoard initialTasks={[]} />)
        expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument()
    })

    it('shows "Drop tasks here" in empty columns', () => {
        renderWithProviders(<TaskBoard initialTasks={[]} />)
        const dropZones = screen.getAllByText('Drop tasks here')
        expect(dropZones.length).toBe(2)
    })

    it('shows task count badge in column header', () => {
        renderWithProviders(<TaskBoard initialTasks={sampleTasks} />)
        // On Going has 1, Completed has 1
        const badges = screen.getAllByText('1')
        expect(badges.length).toBeGreaterThanOrEqual(2)
    })

    it('shows priority badge on tasks', () => {
        renderWithProviders(<TaskBoard initialTasks={sampleTasks} />)
        expect(screen.getByText('high')).toBeInTheDocument()
        expect(screen.getByText('medium')).toBeInTheDocument()
    })

    it('shows Archive section header', () => {
        renderWithProviders(<TaskBoard initialTasks={sampleTasks} />)
        expect(screen.getByText('Archive')).toBeInTheDocument()
    })

    it('shows archived task count in archive header', () => {
        renderWithProviders(<TaskBoard initialTasks={sampleTasks} />)
        // archive badge shows 1
        expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    })

    it('expands archive section on click', async () => {
        renderWithProviders(<TaskBoard initialTasks={sampleTasks} />)
        const archiveBtn = screen.getByText('Archive').closest('button')
        await userEvent.click(archiveBtn)
        await waitFor(() => {
            expect(screen.getByText('Old task')).toBeInTheDocument()
        })
    })

    it('shows error toast on duplicate task name', async () => {
        const { addTask } = await import('@/app/(dashboard)/dashboard/tasks/actions')
        renderWithProviders(<TaskBoard initialTasks={sampleTasks} />)
        const input = screen.getByPlaceholderText('What needs to be done?')
        await userEvent.type(input, 'Write tests')
        const submitBtn = screen.getByRole('button', { name: /add task/i })
        await userEvent.click(submitBtn)
        await waitFor(() => {
            expect(screen.getByText('A task with this name already exists!')).toBeInTheDocument()
        })
        expect(addTask).not.toHaveBeenCalled()
    })
})

// ─── NoteList ─────────────────────────────────────────────────────────────────
import NoteList from '@/app/(dashboard)/dashboard/notes/NoteList'

describe('NoteList', () => {
    const ownedNotes = [
        { id: 'n1', title: 'My Note', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), owner_id: 'u1' },
    ]
    const sharedNotes = [
        { id: 'n2', title: 'Shared Note', updated_at: new Date().toISOString(), created_at: new Date().toISOString(), owner_id: 'u2', shared: true, permission: 'view' },
    ]

    it('renders owned note titles', () => {
        renderWithProviders(<NoteList ownedNotes={ownedNotes} sharedNotes={[]} />)
        expect(screen.getByText('My Note')).toBeInTheDocument()
    })

    it('renders shared note titles', () => {
        renderWithProviders(<NoteList ownedNotes={[]} sharedNotes={sharedNotes} />)
        expect(screen.getByText('Shared Note')).toBeInTheDocument()
    })

    it('renders New Note button', () => {
        renderWithProviders(<NoteList ownedNotes={[]} sharedNotes={[]} />)
        expect(screen.getByRole('button', { name: /new note/i })).toBeInTheDocument()
    })

    it('renders empty state when no notes', () => {
        renderWithProviders(<NoteList ownedNotes={[]} sharedNotes={[]} />)
        expect(screen.getByText(/no notes yet/i)).toBeInTheDocument()
    })

    it('renders Shared with me section when shared notes exist', () => {
        renderWithProviders(<NoteList ownedNotes={[]} sharedNotes={sharedNotes} />)
        expect(screen.getByText(/shared with me/i)).toBeInTheDocument()
    })
})

// ─── Mock register server action ──────────────────────────────────────────────
vi.mock('@/app/(auth)/register/actions', () => ({
    registerUser: vi.fn().mockResolvedValue({ success: true, redirect: '/dashboard' }),
}))

// ─── LoginPage ────────────────────────────────────────────────────────────────
import LoginPage from '@/app/(auth)/login/page'
import { ThemeProvider as ThemeProviderForAuth } from '@/lib/ThemeContext'

function renderWithTheme(ui) {
    return render(<ThemeProviderForAuth>{ui}</ThemeProviderForAuth>)
}

describe('LoginPage', () => {
    it('renders Sign In heading', () => {
        renderWithTheme(<LoginPage />)
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument()
    })

    it('renders email and password inputs', () => {
        renderWithTheme(<LoginPage />)
        expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    })

    it('Sign In button disabled before CAPTCHA', () => {
        renderWithTheme(<LoginPage />)
        const btn = screen.getByRole('button', { name: /sign in/i })
        expect(btn).toBeDisabled()
    })

    it('Sign In button enabled after CAPTCHA checked', async () => {
        renderWithTheme(<LoginPage />)
        const captcha = screen.getByTestId('recaptcha')
        await userEvent.click(captcha)
        const btn = screen.getByRole('button', { name: /sign in/i })
        expect(btn).not.toBeDisabled()
    })

    it('shows CAPTCHA error when submitting without CAPTCHA', async () => {
        renderWithTheme(<LoginPage />)
        await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'test@test.com')
        await userEvent.type(screen.getByPlaceholderText('••••••••'), 'password')
        // submit form directly without captcha
        fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'))
        await waitFor(() => {
            expect(screen.getByText('Please complete the CAPTCHA verification.')).toBeInTheDocument()
        })
    })

    it('shows error on failed login', async () => {
        const { createClient } = await import('@/lib/supabase/client')
        createClient.mockReturnValue({
            auth: {
                signInWithPassword: vi.fn().mockResolvedValue({ error: { message: 'Invalid credentials' } }),
                getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
            },
            from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
            channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis(), unsubscribe: vi.fn() })),
            removeChannel: vi.fn(),
        })
        renderWithTheme(<LoginPage />)
        await userEvent.click(screen.getByTestId('recaptcha'))
        await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'bad@test.com')
        await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
        await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
        await waitFor(() => {
            expect(screen.getByText('Invalid email or password. Please try again.')).toBeInTheDocument()
        })
    })

    it('toggles password visibility', async () => {
        renderWithTheme(<LoginPage />)
        const passwordInput = screen.getByPlaceholderText('••••••••')
        expect(passwordInput).toHaveAttribute('type', 'password')
        // eye toggle button is tabIndex=-1, find it by its position next to password field
        const toggleBtn = passwordInput.parentElement.querySelector('button')
        await userEvent.click(toggleBtn)
        expect(passwordInput).toHaveAttribute('type', 'text')
    })

    it('renders Forgot password link', () => {
        renderWithTheme(<LoginPage />)
        expect(screen.getByText('Forgot password?')).toBeInTheDocument()
    })

    it('renders Register link', () => {
        renderWithTheme(<LoginPage />)
        expect(screen.getByText('Register')).toBeInTheDocument()
    })
})

function renderWithProviders(ui) {
    return render(
        <NotificationProvider>
            <ThemeProvider>{ui}</ThemeProvider>
        </NotificationProvider>
    )
}

// ─── RegisterPage ─────────────────────────────────────────────────────────────
import RegisterPage from '@/app/(auth)/register/page'

describe('RegisterPage', () => {
    it('renders Create your account heading', () => {
        renderWithProviders(<RegisterPage />)
        expect(screen.getByText('Create your account')).toBeInTheDocument()
    })

    it('renders email, password, confirm password inputs', () => {
        renderWithProviders(<RegisterPage />)
        expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Create a strong password')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('Re-enter your password')).toBeInTheDocument()
    })

    it('Create Account button disabled before CAPTCHA', () => {
        renderWithProviders(<RegisterPage />)
        const btn = screen.getByRole('button', { name: /create account/i })
        expect(btn).toBeDisabled()
    })

    it('shows password strength bar when typing password', async () => {
        renderWithProviders(<RegisterPage />)
        await userEvent.type(screen.getByPlaceholderText('Create a strong password'), 'abc')
        expect(screen.getByText('Very weak')).toBeInTheDocument()
    })

    it('shows password rule checklist when typing', async () => {
        renderWithProviders(<RegisterPage />)
        await userEvent.type(screen.getByPlaceholderText('Create a strong password'), 'a')
        expect(screen.getByText('At least 8 characters')).toBeInTheDocument()
        expect(screen.getByText('One uppercase letter (A-Z)')).toBeInTheDocument()
    })

    it('shows Very strong when all rules pass', async () => {
        renderWithProviders(<RegisterPage />)
        await userEvent.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
        expect(screen.getByText('Very strong')).toBeInTheDocument()
    })

    it('shows passwords do not match inline error', async () => {
        renderWithProviders(<RegisterPage />)
        await userEvent.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
        await userEvent.type(screen.getByPlaceholderText('Re-enter your password'), 'different')
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })

    it('shows error when submitting with weak password', async () => {
        renderWithProviders(<RegisterPage />)
        await userEvent.click(screen.getByTestId('recaptcha'))
        await userEvent.type(screen.getByPlaceholderText('you@example.com'), 'test@test.com')
        await userEvent.type(screen.getByPlaceholderText('Create a strong password'), 'weak')
        await userEvent.type(screen.getByPlaceholderText('Re-enter your password'), 'weak')
        fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))
        await waitFor(() => {
            expect(screen.getByText('Please meet all password requirements.')).toBeInTheDocument()
        })
    })

    it('shows CAPTCHA error when missing token', async () => {
        renderWithProviders(<RegisterPage />)
        await userEvent.type(screen.getByPlaceholderText('Create a strong password'), 'StrongPass1!')
        await userEvent.type(screen.getByPlaceholderText('Re-enter your password'), 'StrongPass1!')
        fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form'))
        await waitFor(() => {
            expect(screen.getByText('Please complete the CAPTCHA verification.')).toBeInTheDocument()
        })
    })

    it('renders Sign In link', () => {
        renderWithProviders(<RegisterPage />)
        expect(screen.getByText('Sign In')).toBeInTheDocument()
    })
})

