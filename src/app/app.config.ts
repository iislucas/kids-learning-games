import {
  ApplicationConfig,
  InjectionToken,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { addUrlParams, pathPattern, pv } from './routing/routing.utils';
import { RoutingConfig } from './routing/routing.service';

/** Every page in the app. Used as the key into the router's signal map. */
export enum Views {
  Home = 'home',
  Play = 'play',
  Prizes = 'prizes',
  MediaStudio = 'mediaStudio',
  Settings = 'settings',
}

export const initPathPatterns = {
  [Views.Home]: pathPattern``,
  // `level` lets a session be deep-linked or refreshed without losing difficulty.
  [Views.Play]: addUrlParams(pathPattern`play/${pv('packId')}`, [
    { name: 'level' as const, default: '1' },
  ]),
  [Views.Prizes]: pathPattern`prizes`,
  [Views.MediaStudio]: addUrlParams(pathPattern`media`, [
    { name: 'tab' as const, default: 'sprites' },
  ]),
  [Views.Settings]: pathPattern`settings`,
};

export type AppPathPatterns = typeof initPathPatterns;

export const ROUTING_CONFIG = new InjectionToken<RoutingConfig<AppPathPatterns>>(
  'ROUTING_CONFIG',
);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: ROUTING_CONFIG,
      useValue: { validPathPatterns: initPathPatterns },
    },
  ],
};
