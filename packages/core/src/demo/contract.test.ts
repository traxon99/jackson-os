import { runAdapterContract } from '../testing/contract.js';
import { demoAdapter } from './index.js';

runAdapterContract(demoAdapter, {
  config: {},
  secrets: ['super-secret-token', 'another-secret'],
});
