import { createRoot } from 'react-dom/client';
import React from 'react';
import { CaptureDock } from '../SmartCapture/components/CaptureDock';
import { registerLazyComponent } from '../utils/lazyComponentRegistry';

registerLazyComponent('CaptureDock', {
    React,
    createRoot,
    CaptureDock,
});

export default CaptureDock;
