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

export interface SaveNotificationToastProps {
    links: ToastLinkData[];
    newLinkIds?: number[];
    onClose: () => void;
    onEdit?: (link: ToastLinkData) => void;
    onShow?: (link: ToastLinkData) => void;
    autoCloseDelay?: number;
}
