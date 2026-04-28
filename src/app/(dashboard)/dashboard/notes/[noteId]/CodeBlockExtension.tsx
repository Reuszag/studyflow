'use client'

import { useState, useEffect } from 'react'
import CodeBlock from '@tiptap/extension-code-block'
import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react'

function CodeBlockView(props: ReactNodeViewProps) {
    const { deleteNode, editor } = props
    const [isEditable, setIsEditable] = useState(editor.isEditable)

    useEffect(() => {
        const sync = () => setIsEditable(editor.isEditable)
        editor.on('transaction', sync)
        return () => { editor.off('transaction', sync) }
    }, [editor])

    return (
        <NodeViewWrapper as="div" className="code-block-wrapper">
            {isEditable && (
                <button
                    className="code-block-delete-btn"
                    onClick={deleteNode}
                    contentEditable={false}
                    title="Delete code block"
                    type="button"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                </button>
            )}
            <pre>
                <NodeViewContent as={"code" as "div"} />
            </pre>
        </NodeViewWrapper>
    )
}

export const CodeBlockWithDelete = CodeBlock.extend({
    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView)
    },
})
