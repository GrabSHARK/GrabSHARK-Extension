/**
 * Toast Types - Shared type definitions for save notification
 */

export interface ToastLinkData {
    id: number;
    url: string;
    name: string;
    createdAt?: string;
    collection?: {
        name: string;
        color?: string;
        icon?: string;
    };
    preview?: string;
}

export interface PreparedToastLink extends ToastLinkData {
    collectionLabel: string;
    formattedDate: string;
    thumbnailSrc: string;
    fallbackIconColor?: string;
}

export interface ToastLabels {
    edit: string;
    show: string;
    justNow: string;
    unorganized: string;
    more: string;
}

export interface SaveNotificationToastProps {
    links: PreparedToastLink[];
    labels: ToastLabels;
    newLinkIds?: number[];
    onClose: () => void;
    onEdit?: (link: ToastLinkData) => void;
    onShow?: (link: ToastLinkData) => void;
    autoCloseDelay?: number;
}
