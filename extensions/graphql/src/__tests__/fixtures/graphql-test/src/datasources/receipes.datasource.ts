// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/graphql
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'receipes',
  connector: 'memory',
  localStorage: '',
  file: '',
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class ReceipesDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static dataSourceName = 'receipes';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.receipes', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
