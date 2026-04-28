import { describe, it, expect } from 'vitest'

// ─── Inline the pure functions under test ────────────────────────────────────
// These are private helpers in notes/actions.ts. We duplicate them here so
// unit tests have no dependency on Next.js server runtime or Supabase.

function decodeStoragePath(rawPath: string): string {
    let normalized = rawPath
    for (let i = 0; i < 3; i++) {
        try {
            const decoded = decodeURIComponent(normalized)
            if (decoded === normalized) break
            normalized = decoded
        } catch {
            break
        }
    }
    return normalized.replace(/^\/+/, '').replace(/\\/g, '/')
}

const SUPABASE_URL = 'https://example.supabase.co'
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/note-images/`
const SIGNED_PREFIX = `${SUPABASE_URL}/storage/v1/object/sign/note-images/`
const PROXY_PREFIX = '/api/note-image?'

type ContentNode = {
    type?: string
    attrs?: Record<string, unknown>
    content?: ContentNode[]
}

function normalizeImageUrls(content: object, supabaseUrl = SUPABASE_URL): object {
    const signedPrefix = `${supabaseUrl}/storage/v1/object/sign/note-images/`
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'

    function walk(nodes: ContentNode[] | undefined) {
        if (!nodes) return
        for (const node of nodes) {
            if (node.type === 'image' && typeof node.attrs?.src === 'string') {
                const src = node.attrs.src as string
                if (src.startsWith(signedPrefix)) {
                    const withoutPrefix = src.slice(signedPrefix.length)
                    const storagePath = decodeStoragePath(withoutPrefix.split('?')[0])
                    node.attrs.src = publicPrefix + storagePath
                } else if (src.startsWith(proxyPrefix)) {
                    try {
                        const params = new URLSearchParams(src.slice(proxyPrefix.length))
                        const storagePath = params.get('path')
                        if (storagePath) {
                            node.attrs.src = publicPrefix + decodeStoragePath(storagePath)
                        }
                    } catch {
                        // keep original
                    }
                }
            }
            if (node.content) walk(node.content)
        }
    }

    const copy = JSON.parse(JSON.stringify(content)) as { content?: ContentNode[] }
    walk(copy.content)
    return copy
}

function resolveImageUrls(content: Record<string, unknown>, noteId: string, supabaseUrl = SUPABASE_URL): Record<string, unknown> {
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'

    function walk(nodes: ContentNode[] | undefined) {
        if (!nodes) return
        for (const node of nodes) {
            if (node.type === 'image' && typeof node.attrs?.src === 'string') {
                const src = node.attrs.src as string
                if (src.startsWith(publicPrefix)) {
                    const storagePath = decodeStoragePath(src.slice(publicPrefix.length))
                    node.attrs.src = `/api/note-image?path=${encodeURIComponent(storagePath)}&noteId=${noteId}`
                } else if (src.startsWith(proxyPrefix)) {
                    try {
                        const params = new URLSearchParams(src.slice(proxyPrefix.length))
                        const storagePath = params.get('path')
                        if (storagePath) {
                            node.attrs.src = `/api/note-image?path=${encodeURIComponent(decodeStoragePath(storagePath))}&noteId=${noteId}`
                        }
                    } catch {
                        // keep original
                    }
                }
            }
            if (node.content) walk(node.content)
        }
    }

    const copy = JSON.parse(JSON.stringify(content)) as { content?: ContentNode[] }
    walk(copy.content)
    return copy as Record<string, unknown>
}

function extractImageUrls(content: Record<string, unknown>): string[] {
    const urls: string[] = []
    function walk(nodes: ContentNode[] | undefined) {
        if (!nodes) return
        for (const node of nodes) {
            if (node.type === 'image' && typeof node.attrs?.src === 'string') {
                urls.push(node.attrs.src as string)
            }
            if (node.content) walk(node.content)
        }
    }
    walk((content as { content?: ContentNode[] }).content)
    return urls
}

function imageUrlsToPaths(urls: string[], supabaseUrl = SUPABASE_URL): string[] {
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/note-images/`
    const proxyPrefix = '/api/note-image?'
    const paths: string[] = []

    for (const url of urls) {
        if (url.startsWith(publicPrefix)) {
            paths.push(decodeStoragePath(url.slice(publicPrefix.length).split('?')[0]))
        } else if (url.startsWith(proxyPrefix)) {
            try {
                const params = new URLSearchParams(url.slice(proxyPrefix.length))
                const path = params.get('path')
                if (path) paths.push(decodeStoragePath(path))
            } catch { /* skip */ }
        }
    }

    return paths
}

function getUniqueNoteTitle(existingTitles: string[]): string {
    const set = new Set(existingTitles.map(t => t.toLowerCase()))
    if (!set.has('untitled')) return 'Untitled'
    let counter = 1
    while (set.has(`untitled${counter}`)) counter++
    return `Untitled${counter}`
}

// ─── decodeStoragePath ────────────────────────────────────────────────────────

describe('decodeStoragePath', () => {
    it('decodes single-encoded forward slash', () => {
        expect(decodeStoragePath('user%2Ffile.png')).toBe('user/file.png')
    })

    it('decodes double-encoded path', () => {
        expect(decodeStoragePath('user%252Ffile.png')).toBe('user/file.png')
    })

    it('strips leading slash', () => {
        expect(decodeStoragePath('/user/file.png')).toBe('user/file.png')
    })

    it('strips multiple leading slashes', () => {
        expect(decodeStoragePath('///user/file.png')).toBe('user/file.png')
    })

    it('does not modify clean path', () => {
        expect(decodeStoragePath('user/file.png')).toBe('user/file.png')
    })

    it('breaks early when already fully decoded', () => {
        // Only one iteration needed — second pass would be identical
        const path = 'user/normal-file_name.png'
        expect(decodeStoragePath(path)).toBe(path)
    })

    it('converts backslashes to forward slashes', () => {
        expect(decodeStoragePath('user\\file.png')).toBe('user/file.png')
    })
})

// ─── normalizeImageUrls ───────────────────────────────────────────────────────

describe('normalizeImageUrls', () => {
    it('converts proxy URL to public URL', () => {
        const content = {
            content: [{
                type: 'image',
                attrs: { src: '/api/note-image?path=user%2Ffile.png&noteId=abc' }
            }]
        }
        const result = normalizeImageUrls(content) as { content: ContentNode[] }
        expect(result.content[0].attrs?.src).toBe(`${PUBLIC_PREFIX}user/file.png`)
    })

    it('converts signed URL to public URL', () => {
        const content = {
            content: [{
                type: 'image',
                attrs: { src: `${SIGNED_PREFIX}user/file.png?token=xyz` }
            }]
        }
        const result = normalizeImageUrls(content) as { content: ContentNode[] }
        expect(result.content[0].attrs?.src).toBe(`${PUBLIC_PREFIX}user/file.png`)
    })

    it('does not modify already-public URLs', () => {
        const src = `${PUBLIC_PREFIX}user/file.png`
        const content = { content: [{ type: 'image', attrs: { src } }] }
        const result = normalizeImageUrls(content) as { content: ContentNode[] }
        expect(result.content[0].attrs?.src).toBe(src)
    })

    it('does not modify non-image nodes', () => {
        const content = {
            content: [{ type: 'paragraph', attrs: { text: 'hello' } }]
        }
        const result = normalizeImageUrls(content) as { content: ContentNode[] }
        expect(result.content[0].attrs?.text).toBe('hello')
    })

    it('walks nested content recursively', () => {
        const content = {
            content: [{
                type: 'table',
                content: [{
                    type: 'tableRow',
                    content: [{
                        type: 'tableCell',
                        content: [{
                            type: 'image',
                            attrs: { src: '/api/note-image?path=nested%2Fimg.png&noteId=abc' }
                        }]
                    }]
                }]
            }]
        }
        const result = normalizeImageUrls(content) as any
        const src = result.content[0].content[0].content[0].content[0].attrs.src
        expect(src).toBe(`${PUBLIC_PREFIX}nested/img.png`)
    })

    it('handles encoded path in proxy URL', () => {
        const content = {
            content: [{
                type: 'image',
                attrs: { src: '/api/note-image?path=user%252Ffile.png&noteId=abc' }
            }]
        }
        const result = normalizeImageUrls(content) as { content: ContentNode[] }
        expect(result.content[0].attrs?.src).toBe(`${PUBLIC_PREFIX}user/file.png`)
    })

    it('does not mutate original content object', () => {
        const original = {
            content: [{ type: 'image', attrs: { src: '/api/note-image?path=x.png&noteId=abc' } }]
        }
        const originalSrc = original.content[0].attrs.src
        normalizeImageUrls(original)
        expect(original.content[0].attrs.src).toBe(originalSrc)
    })
})

// ─── resolveImageUrls ─────────────────────────────────────────────────────────

describe('resolveImageUrls', () => {
    it('converts public URL to proxy URL', () => {
        const content = {
            content: [{
                type: 'image',
                attrs: { src: `${PUBLIC_PREFIX}user/file.png` }
            }]
        }
        const result = resolveImageUrls(content, 'note-123') as { content: ContentNode[] }
        expect(result.content[0].attrs?.src).toBe(
            '/api/note-image?path=user%2Ffile.png&noteId=note-123'
        )
    })

    it('re-canonicalizes existing proxy URL to remove encoding drift', () => {
        const content = {
            content: [{
                type: 'image',
                attrs: { src: '/api/note-image?path=user%252Ffile.png&noteId=old' }
            }]
        }
        const result = resolveImageUrls(content, 'note-123') as { content: ContentNode[] }
        expect(result.content[0].attrs?.src).toBe(
            '/api/note-image?path=user%2Ffile.png&noteId=note-123'
        )
    })

    it('does not modify non-image nodes', () => {
        const content = {
            content: [{ type: 'paragraph', content: [] }]
        }
        const result = resolveImageUrls(content, 'note-123') as { content: ContentNode[] }
        expect(result.content[0].type).toBe('paragraph')
    })

    it('does not mutate original object', () => {
        const src = `${PUBLIC_PREFIX}user/file.png`
        const original = { content: [{ type: 'image', attrs: { src } }] }
        resolveImageUrls(original, 'note-123')
        expect(original.content[0].attrs.src).toBe(src)
    })
})

// ─── extractImageUrls ─────────────────────────────────────────────────────────

describe('extractImageUrls', () => {
    it('extracts src from flat image node', () => {
        const content = {
            content: [{ type: 'image', attrs: { src: 'https://example.com/img.png' } }]
        }
        expect(extractImageUrls(content)).toEqual(['https://example.com/img.png'])
    })

    it('extracts multiple image srcs', () => {
        const content = {
            content: [
                { type: 'image', attrs: { src: 'https://example.com/a.png' } },
                { type: 'image', attrs: { src: 'https://example.com/b.png' } },
            ]
        }
        expect(extractImageUrls(content)).toHaveLength(2)
    })

    it('extracts from nested content', () => {
        const content = {
            content: [{
                type: 'table',
                content: [{
                    type: 'tableRow',
                    content: [{
                        type: 'image',
                        attrs: { src: 'https://example.com/nested.png' }
                    }]
                }]
            }]
        }
        expect(extractImageUrls(content)).toEqual(['https://example.com/nested.png'])
    })

    it('returns empty array when no images', () => {
        const content = {
            content: [{ type: 'paragraph', content: [] }]
        }
        expect(extractImageUrls(content)).toEqual([])
    })

    it('skips non-image nodes', () => {
        const content = {
            content: [
                { type: 'paragraph', attrs: { text: 'hello' } },
                { type: 'image', attrs: { src: 'https://example.com/img.png' } },
            ]
        }
        expect(extractImageUrls(content)).toHaveLength(1)
    })
})

// ─── imageUrlsToPaths ─────────────────────────────────────────────────────────

describe('imageUrlsToPaths', () => {
    it('converts public URL to storage path', () => {
        const url = `${PUBLIC_PREFIX}user-123/file.png`
        expect(imageUrlsToPaths([url])).toEqual(['user-123/file.png'])
    })

    it('converts proxy URL to storage path', () => {
        const url = '/api/note-image?path=user-123%2Ffile.png&noteId=abc'
        expect(imageUrlsToPaths([url])).toEqual(['user-123/file.png'])
    })

    it('skips unknown URLs', () => {
        const url = 'https://other-domain.com/image.png'
        expect(imageUrlsToPaths([url])).toEqual([])
    })

    it('strips query params from public URL', () => {
        const url = `${PUBLIC_PREFIX}user/file.png?v=123`
        expect(imageUrlsToPaths([url])).toEqual(['user/file.png'])
    })

    it('handles mixed valid and invalid URLs', () => {
        const urls = [
            `${PUBLIC_PREFIX}user/a.png`,
            'https://other.com/b.png',
            '/api/note-image?path=user%2Fc.png&noteId=abc',
        ]
        expect(imageUrlsToPaths(urls)).toEqual(['user/a.png', 'user/c.png'])
    })
})

// ─── getUniqueNoteTitle ───────────────────────────────────────────────────────

describe('getUniqueNoteTitle (note auto-naming)', () => {
    it('returns Untitled when no existing notes', () => {
        expect(getUniqueNoteTitle([])).toBe('Untitled')
    })

    it('returns Untitled1 when Untitled taken', () => {
        expect(getUniqueNoteTitle(['Untitled'])).toBe('Untitled1')
    })

    it('returns Untitled2 when Untitled and Untitled1 taken', () => {
        expect(getUniqueNoteTitle(['Untitled', 'Untitled1'])).toBe('Untitled2')
    })

    it('fills gap in sequence', () => {
        // Untitled1 missing → should return Untitled1
        expect(getUniqueNoteTitle(['Untitled', 'Untitled2'])).toBe('Untitled1')
    })

    it('is case-insensitive', () => {
        expect(getUniqueNoteTitle(['untitled'])).toBe('Untitled1')
    })

    it('handles large sequence', () => {
        const existing = ['Untitled', ...Array.from({ length: 9 }, (_, i) => `Untitled${i + 1}`)]
        expect(getUniqueNoteTitle(existing)).toBe('Untitled10')
    })
})
