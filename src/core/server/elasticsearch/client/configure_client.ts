/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { Client, Transport, HttpConnection } from '@elastic/elasticsearch';
import type { KibanaClient } from '@elastic/elasticsearch/lib/api/kibana';
import type {
  TransportRequestParams,
  TransportRequestOptions,
  TransportResult,
} from '@elastic/elasticsearch';

import { Logger } from '../../logging';
import { parseClientOptions, ElasticsearchClientConfig } from './client_config';
import { instrumentEsQueryAndDeprecationLogger } from './log_query_and_deprecation';

const noop = () => undefined;

export const configureClient = (
  config: ElasticsearchClientConfig,
  {
    logger,
    type,
    scoped = false,
    getExecutionContext = noop,
  }: {
    logger: Logger;
    type: string;
    scoped?: boolean;
    getExecutionContext?: () => string | undefined;
  }
): KibanaClient => {
  const clientOptions = parseClientOptions(config, scoped);
  class KibanaTransport extends Transport {
    request(params: TransportRequestParams, options?: TransportRequestOptions) {
      const opts: TransportRequestOptions = options || {};
      const opaqueId = getExecutionContext();
      if (opaqueId && !opts.opaqueId) {
        // rewrites headers['x-opaque-id'] if it presents
        opts.opaqueId = opaqueId;
      }
      // Enforce the client to return TransportResult.
      // It's required for bwc with responses in 7.x version.
      if (opts.meta === undefined) {
        opts.meta = true;
      }
      return super.request(params, opts) as Promise<TransportResult<any, any>>;
    }
  }

  const client = new Client({
    ...clientOptions,
    Transport: KibanaTransport,
    Connection: HttpConnection,
  });

  instrumentEsQueryAndDeprecationLogger({ logger, client, type });

  return client as KibanaClient;
};
