/**
 * Semantic Anchor for heading-based triangulation
 * Stores the nearest stable landmark (H1-H3 or element with ID)
 */
export interface SemanticAnchor {
  /** Text content of nearest heading (H1-H3) */
  nearestHeadingText: string;

  /** Tag name of the heading (h1, h2, h3) */
  headingTag: 'h1' | 'h2' | 'h3';

  /** CSS selector to the heading (for direct lookup) */
  headingSelector: string;

  /** How many elements after the heading is our target? */
  relativeIndex: number;

  /** Alternative: nearest element with ID attribute */
  nearestIdElement?: {
    id: string;
    tagName: string;
    relativeIndex: number;
  };
}

/**
 * Weighted Voting Anchor Data
 * Used by parallel agents to locate highlights
 * All fields are required (no backward compatibility)
 */
export interface HighlightAnchor {
  /** Source of the anchor - 'readable' for ReadableView, 'live' for live site/monolith */
  source?: 'readable' | 'live' | 'monolith';

  /** The containing HTML tag of the highlighted text */
  containingTag?: string;

  /** CSS selector to the container element (avoiding unstable classes) */
  containerSelector: string;

  /** XPath as structural backup */
  xpath: string;

  /** Context for disambiguation (adaptive length) */
  context: {
    prefix: string;
    suffix: string;
  };

  /** Relative position in document (0.0 to 1.0) for scroll anchoring */
  positionRatio: number;

  /** Semantic anchor: nearest H1-H3 heading or [id] element */
  semanticAnchor: SemanticAnchor;

  /** Playwright-style robust selector with text content */
  robustSelector: string;
}

export interface Highlight {
  id: number;
  color: 'yellow' | 'red' | 'blue' | 'green';
  comment?: string | null;
  linkId: number;
  userId: number;
  startOffset: number;
  endOffset: number;
  text: string;
  createdAt: string;
  updatedAt: string;
  ranges?: { startOffset: number; endOffset: number }[] | null;

  /** Waterfall anchor data for robust highlight restoration */
  anchor?: HighlightAnchor | null;
}

export interface HighlightCreateData {
  color: string;
  comment?: string | null;
  startOffset: number;
  endOffset: number;
  text: string;
  linkId: number;
  ranges?: { startOffset: number; endOffset: number }[] | null;

  /** Waterfall anchor data captured on creation */
  anchor?: HighlightAnchor | null;
}

export interface LinkWithHighlights {
  id: number;
  name: string;
  url: string;
  description: string;
  collectionId: number;
  collection?: {
    id: number;
    name: string;
    ownerId: number;
    icon?: string;
    color?: string;
  };
  createdAt?: string;
  highlight?: Highlight[];
  isArchived?: boolean;
  tags?: { name: string;[key: string]: any }[];
  preview?: string;
  image?: string;
}

export type HighlightColor = 'yellow' | 'red' | 'blue' | 'green';

export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'red', 'blue', 'green'];

export const HIGHLIGHT_COLOR_CLASSES: Record<HighlightColor, { bg: string; border: string }> = {
  yellow: { bg: 'lw-highlight-yellow', border: 'lw-border-yellow' },
  red: { bg: 'lw-highlight-red', border: 'lw-border-red' },
  blue: { bg: 'lw-highlight-blue', border: 'lw-border-blue' },
  green: { bg: 'lw-highlight-green', border: 'lw-border-green' },
};
