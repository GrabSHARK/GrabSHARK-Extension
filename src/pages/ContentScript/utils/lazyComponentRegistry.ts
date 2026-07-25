export interface EmbeddedAppModule {
    React: any;
    createRoot: any;
    EmbeddedApp: any;
}

export interface CaptureDockModule {
    React: any;
    createRoot: any;
    flushSync: any;
    CaptureDock: any;
}

export interface SaveNotificationToastModule {
    React: any;
    createRoot: any;
    SaveNotificationToast: any;
}

export interface LazyModuleMap {
    EmbeddedApp: EmbeddedAppModule;
    CaptureDock: CaptureDockModule;
    SaveNotificationToast: SaveNotificationToastModule;
}

export type LazyComponentName = keyof LazyModuleMap;

const REGISTRY_KEY = '__grabsharkLazyComponents';

type GlobalLazyRegistry = typeof globalThis & {
    [REGISTRY_KEY]?: Partial<LazyModuleMap>;
};

function getRegistry(): Partial<LazyModuleMap> {
    const root = globalThis as GlobalLazyRegistry;
    if (!root[REGISTRY_KEY]) {
        root[REGISTRY_KEY] = {};
    }
    return root[REGISTRY_KEY]!;
}

export function registerLazyComponent<K extends LazyComponentName>(name: K, componentModule: LazyModuleMap[K]): void {
    getRegistry()[name] = componentModule;
}

export function getRegisteredLazyComponent<K extends LazyComponentName>(name: K): LazyModuleMap[K] | undefined {
    return getRegistry()[name] as LazyModuleMap[K] | undefined;
}
