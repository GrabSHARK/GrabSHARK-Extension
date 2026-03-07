/**
 * Embedded UI Module — Lazy-loaded React ecosystem
 * 
 * Built as an ES module (embeddedUI.js) and loaded via dynamic import()
 * by the content script. This keeps contentScript.js lightweight (~300KB)
 * while deferring the ~6MB React ecosystem until it's actually needed.
 * 
 * Runs in the content script's ISOLATED WORLD — full chrome.* API access.
 */
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { EmbeddedApp } from './EmbeddedApp';
import { CaptureDock } from './SmartCapture/components/CaptureDock';
import { SaveNotificationToast, type ToastLinkData } from './SaveNotificationToast';

// ES module exports — consumed via dynamic import() in reactLoader.ts
export { createRoot, React, EmbeddedApp, CaptureDock, SaveNotificationToast };
export type { Root, ToastLinkData };
