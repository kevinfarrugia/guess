import { fetch } from 'guess-ga';

import { existsSync, readFileSync } from 'fs';
import { auth } from 'google-oauth2-node';
import { shim } from 'promise.prototype.finally';

import { Mode, RouteProvider, PrefetchConfig } from './declarations';
import { defaultRouteProvider } from './default-route-provider';
import { Prefetch } from './prefetch';
import { Graph, RoutingModule, Period, ProjectConfig } from '../common/interfaces';

shim();

export interface RuntimeConfig {
  /** @internal */
  basePath?: string;
  /** @internal */
  prefetchConfig?: PrefetchConfig;
}

export interface GuessPluginConfig {
  GA: string;
  mode?: Mode;
  projectConfig?: ProjectConfig;
  period?: Period;
  /** @internal */
  routeFormatter?: (path: string) => string;
  /** @internal */
  debug?: boolean;
  /** @internal */
  runtime?: RuntimeConfig;
  /** @internal */
  routeProvider?: RouteProvider;
}

const clientId = '329457372673-hda3mp2vghisfobn213jpj8ck1uohi2d.apps.googleusercontent.com';
const clientSecret = '4camaoQPOz9edR-Oz19vg-lN';
const scope = 'https://www.googleapis.com/auth/analytics.readonly';
const year = 365 * 24 * 60 * 60 * 1000;

const id = <T>(r: T) => r;

export class GuessPlugin {
  constructor(private _config: GuessPluginConfig) {}

  apply(compiler: any) {
    compiler.plugin('emit', (compilation: any, cb: any) => this._execute(compilation, cb));
  }

  private _execute(compilation: any, cb: any) {
    auth({
      clientId,
      clientSecret,
      scope
    }).then((token: any) => {
      const { google } = require('googleapis');
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials(token);

      const routes = (this._config.routeProvider ||
        defaultRouteProvider(this._config.mode || Mode.Auto, this._config.projectConfig))();

      fetch({
        viewId: this._config.GA,
        auth: oauth2Client,
        period: this._config.period || { startDate: new Date(), endDate: new Date(Date.now() - year) },
        routes: routes.map(r => r.path),
        formatter: this._config.routeFormatter || id
      })
        .then(
          data => this._executeRuntimePlugin(data, routes, compilation),
          err => {
            throw err;
          }
        )
        .finally(cb);
    });
  }

  private _executeRuntimePlugin(data: Graph, routes: RoutingModule[], compilation: any) {
    const runtimeConfig = this._config.runtime;
    new Prefetch({
      data,
      basePath: this._config.runtime ? this._config.runtime.basePath : '/',
      prefetchConfig: runtimeConfig ? runtimeConfig.prefetchConfig : undefined,
      debug: this._config.debug,
      routes
    }).apply(compilation);
  }
}
