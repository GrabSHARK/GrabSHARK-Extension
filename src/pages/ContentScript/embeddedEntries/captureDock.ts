import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import React from 'react';
import { CaptureDock } from '../SmartCapture/components/CaptureDock';
import { registerLazyComponent } from '../utils/lazyComponentRegistry';

registerLazyComponent('CaptureDock', {
    React,
    createRoot,
    flushSync,
    CaptureDock,
});

export default CaptureDock;
