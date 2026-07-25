import { createRoot } from 'react-dom/client';
import React from 'react';
import { SaveNotificationToast } from '../SaveNotificationToast';
import { registerLazyComponent } from '../utils/lazyComponentRegistry';

registerLazyComponent('SaveNotificationToast', {
    React,
    createRoot,
    SaveNotificationToast,
});

export default SaveNotificationToast;
