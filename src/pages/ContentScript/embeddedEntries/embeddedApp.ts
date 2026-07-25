import { createRoot } from 'react-dom/client';
import React from 'react';
import { EmbeddedApp } from '../EmbeddedApp';
import { registerLazyComponent } from '../utils/lazyComponentRegistry';

registerLazyComponent('EmbeddedApp', {
    React,
    createRoot,
    EmbeddedApp,
});

export default EmbeddedApp;
