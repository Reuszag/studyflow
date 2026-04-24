import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { filePath, fileType, fileName } = await req.json()
    if (!filePath || !fileType) return NextResponse.json({ error: 'Missing filePath or fileType' }, { status: 400 })

    const { data: doc } = await supabase
        .from('documents')
        .select('id')
        .eq('file_path', filePath)
        .eq('user_id', user.id)
        .single()

    if (!doc) return NextResponse.json({ error: 'File not found or access denied' }, { status: 403 })

    const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(filePath)

    if (downloadError || !fileData) {
        return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 })
    }

    let extractedText = ''

    try {
        const arrayBuffer = await fileData.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        if (fileType.includes('pdf') || fileName?.toLowerCase().endsWith('.pdf')) {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) })
            const pdf = await loadingTask.promise
            const pages: string[] = []
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i)
                const content = await page.getTextContent()
                const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
                pages.push(pageText)
            }
            extractedText = pages.join('\n')
        } else if (
            fileType.includes('wordprocessingml') ||
            fileType.includes('msword') ||
            fileName?.toLowerCase().endsWith('.docx') ||
            fileName?.toLowerCase().endsWith('.doc')
        ) {
            const mammoth = await import('mammoth')
            const result = await mammoth.extractRawText({ buffer })
            extractedText = result.value
        } else {
            return NextResponse.json({ error: 'Unsupported file type. Only PDF and Word documents can be summarized.' }, { status: 400 })
        }
    } catch (err) {
        console.error('Text extraction error:', err)
        return NextResponse.json({ error: 'Failed to extract text from document' }, { status: 500 })
    }

    if (!extractedText.trim()) {
        return NextResponse.json({ error: 'No readable text found in document (may be image-based PDF)' }, { status: 422 })
    }

    let summary = ''

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

        const prompt = `Analyze the provided document comprehensively. Your task is to produce a precise, high-fidelity summary that is tailored specifically to the document's nature and core subject matter.

### STEP 1: CATEGORIZATION
First, determine exactly what this document is (e.g., Source Code, Research Paper, Lecture Slides, Legal Contract, Literary Text, Technical Manual, etc.).

### STEP 2: TAILORED SUMMARY
Generate a deep analysis organized by the most relevant themes or logical sections found in the text. 
- If it is technical or code, focus on architecture, logic flow, and implementation details.
- If it is academic, focus on the thesis, methodology, evidence, and conclusions.
- If it is instructional, focus on processes, requirements, and outcomes.
- If it is narrative, focus on themes, characters, and plot significance.

DO NOT use a generic template. Adapt your headers and structure to reflect the specific content of this document.

### STYLE & FORMATTING:
- Use "##" for major section headers to ensure proper PDF formatting.
- Use bullet points for lists and details.
- Provide a deep dive into nuanced details; do not just provide surface-level information.
- Use clear, professional language.
- CRITICAL: DO NOT use Markdown bolding (e.g., **text**) or italics. Use plain text for all emphasis.
- CHARACTER ENCODING: You are writing for a PDF system that natively supports standard Western European accents (e.g., ö, ä, ü, é, à, ñ, ç). If the source document uses rarer characters like "ő" or "ű", please use the visually and phonetically similar "ö" or "ü" equivalents in your summary. This ensures names and terms remain perfectly recognizable and professional without technical glitches or "misunderstandings" in the final PDF.
- Ensure the summary is a standalone document that fully explains the original text.

Document Name: ${fileName}
Document Content:
${extractedText}`

        const result = await model.generateContent(prompt)
        summary = result.response.text()
    } catch (err) {
        console.error('Gemini API error:', err)
        return NextResponse.json({ error: 'AI summarization failed. Check your API key.' }, { status: 500 })
    }

    // Build summary filename
    const baseName = fileName.replace(/\.[^/.]+$/, '')
    const summaryFileName = `${baseName}_summarized.pdf`
    const timestamp = Date.now()
    const safeName = summaryFileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const summaryFilePath = `${user.id}/${timestamp}_${safeName}`

    // Generate PDF using jsPDF
    let pdfBuffer: Buffer
    try {
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF()
        const margin = 20
        const pageWidth = doc.internal.pageSize.width
        const contentWidth = pageWidth - (margin * 2)
        const pageHeight = doc.internal.pageSize.height
        
        let cursorY = 25
        
        const checkPage = (heightNeeded: number) => {
            if (cursorY + heightNeeded > pageHeight - 20) {
                doc.addPage()
                cursorY = 20
            }
        }

        // Helper to sanitize text for standard PDF fonts (Latin-1 / WinAnsi)
        const sanitize = (text: string) => {
            if (!text) return ''
            
            // Map specific characters to their best visual matches in the PDF set
            const specialMap: Record<string, string> = {
                'ő': 'ö', 'Ő': 'Ö',
                'ű': 'ü', 'Ű': 'Ü',
                '—': '-', '–': '-'
            }
            
            let t = text.replace(/\*\*/g, '')
            for (const [key, val] of Object.entries(specialMap)) {
                t = t.replace(new RegExp(key, 'g'), val)
            }

            // High-fidelity fallback: keep Latin-1, normalize others
            return t.split('').map(char => {
                const code = char.charCodeAt(0)
                if (code <= 255) return char
                return char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            }).join('').replace(/[^\x00-\xFF]/g, '?')
        }

        // Title Header
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(22)
        doc.setTextColor(124, 58, 237) // Violet 600
        doc.text('Master Study Guide', margin, cursorY)
        cursorY += 12
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 116, 139) // Slate 500
        doc.text(`Source: ${sanitize(fileName)}`, margin, cursorY)
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth - margin - 45, cursorY)
        cursorY += 8
        
        doc.setDrawColor(226, 232, 240) // Slate 200
        doc.line(margin, cursorY, pageWidth - margin, cursorY)
        cursorY += 15

        // Parse summary for simple markdown-like formatting
        const lines = summary.split('\n')
        doc.setTextColor(30, 41, 59) // Slate 800

        for (let line of lines) {
            line = line.trim()
            if (!line) {
                cursorY += 5
                continue
            }

            if (line.startsWith('##')) {
                // Main Section Header
                checkPage(15)
                cursorY += 5
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(14)
                doc.setTextColor(124, 58, 237)
                const cleanHeader = sanitize(line.replace(/^##\s*/, '')).toUpperCase()
                doc.text(cleanHeader, margin, cursorY)
                cursorY += 8
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(11)
                doc.setTextColor(30, 41, 59)
            } else if (line.startsWith('#')) {
                // Secondary Header
                checkPage(12)
                doc.setFont('helvetica', 'bold')
                doc.setFontSize(12)
                doc.text(sanitize(line.replace(/^#\s*/, '')), margin, cursorY)
                cursorY += 7
                doc.setFont('helvetica', 'normal')
                doc.setFontSize(11)
            } else if (line.startsWith('-') || line.startsWith('*')) {
                // Bullet point
                const bulletText = sanitize(line.replace(/^[-*]\s*/, ''))
                const splitBullet = doc.splitTextToSize(`•  ${bulletText}`, contentWidth - 5)
                checkPage(splitBullet.length * 6)
                doc.text(splitBullet, margin + 5, cursorY)
                cursorY += (splitBullet.length * 6)
            } else {
                // Standard paragraph
                const splitParagraph = doc.splitTextToSize(sanitize(line), contentWidth)
                checkPage(splitParagraph.length * 6)
                doc.text(splitParagraph, margin, cursorY)
                cursorY += (splitParagraph.length * 6)
            }
        }
        
        const pdfArrayBuffer = doc.output('arraybuffer')
        pdfBuffer = Buffer.from(pdfArrayBuffer)
    } catch (err) {
        console.error('PDF generation error:', err)
        // Fallback to text if PDF fails
        pdfBuffer = Buffer.from(summary, 'utf-8')
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(summaryFilePath, pdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: false,
        })

    if (uploadError) {
        console.error('Summary upload error:', uploadError)
        return NextResponse.json({ error: 'Failed to upload summary file to storage' }, { status: 500 })
    }

    // Retry insert with fresh client — connection may be reset after long Gemini call
    let newDoc = null
    let dbError = null
    for (let attempt = 0; attempt < 3; attempt++) {
        const supabaseForInsert = await createClient()
        const result = await supabaseForInsert
            .from('documents')
            .insert({
                user_id: user.id,
                file_name: summaryFileName,
                file_path: summaryFilePath,
                file_type: 'application/pdf',
                file_size: pdfBuffer.length,
            })
            .select()
            .single()
        newDoc = result.data
        dbError = result.error
        if (!dbError) break
        if (attempt < 2) await new Promise(r => setTimeout(r, 500))
    }

    if (dbError) {
        console.error('DB insert error:', dbError)
        return NextResponse.json({ error: 'Summary saved to storage but failed to record in database' }, { status: 500 })
    }

    return NextResponse.json({ success: true, newDoc })
}
