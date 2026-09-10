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
  Map = 'map',
  Prizes = 'prizes',
  MediaStudio = 'mediaStudio',
  Settings = 'settings',
}

export const initPathPatterns = {
  // The map is the front door: it shows what there is to learn and how far in
  // she is, which is a better answer to "what shall we play?" than a list. The
  // list is still there, one tap away.
  [Views.Home]: pathPattern`games`,
  // `level` lets a session be deep-linked or refreshed without losing
  // difficulty; `setup=1` opens the customise panel straight from a link;
  // `challenge` swaps the round for one complete set of questions, which is
  // how a place on the map is played.
  [Views.Play]: addUrlParams(pathPattern`play/${pv('packId')}`, [
    { name: 'level' as const, default: '1' },
    { name: 'setup' as const, default: '' },
    { name: 'challenge' as const, default: '' },
  ]),
  // `at` is the spot she is standing on, so a reload — or a trip into a game
  // and back — puts her where she left off rather than at the crossroads.
  [Views.Map]: addUrlParams(pathPattern``, [
    { name: 'at' as const, default: '' },
    { name: 'open' as const, default: '' },
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
