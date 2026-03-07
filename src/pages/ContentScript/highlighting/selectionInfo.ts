/**
 * Selection Info - Captures selection data for creating new highlights
 */

import { HighlightAnchor } from '../../../@/lib/types/highlight';
import { captureAnchor } from '../anchorUtils';

/**
 * Get the selection info for creating a new highlight
 * Includes anchor data for Weighted Voting System
 */
export function getSelectionInfo(): {
    text: string;
    startOffset: number;
    endOffset: number;
    rect: DOMRect;
    anchor?: HighlightAnchor;
} | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();

    if (!text) return null;

    const rect = range.getBoundingClientRect();

    let startOffset = -1;
    let endOffset = -1;
    let currentOffset = 0;

    const treeWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tagName = parent.tagName.toLowerCase();
                if (tagName === 'script' || tagName === 'style' || tagName === 'noscript' || parent.classList.contains('ext-lw-toolbox')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const nodeLength = node.textContent?.length ?? 0;

        if (startOffset === -1) {
            if (node === range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
                startOffset = currentOffset + range.startOffset;
            } else if (range.intersectsNode(node)) {
                startOffset = currentOffset;
            }
        }

        if (startOffset !== -1 && endOffset === -1) {
            if (node === range.endContainer && range.endContainer.nodeType === Node.TEXT_NODE) {
                endOffset = currentOffset + range.endOffset;
                break;
            }
            if (!range.intersectsNode(node)) {
                endOffset = currentOffset;
                break;
            }
        }

        currentOffset += nodeLength;
    }

    if (startOffset !== -1 && endOffset === -1) endOffset = currentOffset;
    if (startOffset === -1 || endOffset === -1) return null;

    const anchor = captureAnchor(range);

    return { text, startOffset, endOffset, rect, anchor };
}
