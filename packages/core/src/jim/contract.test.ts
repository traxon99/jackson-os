import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAdapterContract } from '../testing/contract.js';
import { jimAdapter } from './index.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

const testToken = 'jim-contract-test-token';

runAdapterContract(jimAdapter, {
  config: {
    baseUrl: 'https://jim.example.com',
    token: testToken,
  },
  secrets: [testToken],
  fetch: async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/v1/status')) {
      return Response.json(loadFixture('status.json'));
    }
    if (url.includes('/v1/weeks')) {
      return Response.json(loadFixture('weeks.json'));
    }
    if (url.includes('/v1/streak')) {
      return Response.json(loadFixture('streak.json'));
    }
    if (url.includes('/v1/workouts')) {
      return Response.json(loadFixture('workouts.json'));
    }
    if (url.includes('/v1/prs')) {
      return Response.json(loadFixture('prs.json'));
    }
    if (url.includes('/v1/lifts')) {
      return Response.json(loadFixture('lifts.json'));
    }
    if (url.includes('/v1/body-measurements')) {
      return Response.json(loadFixture('body.json'));
    }
    if (url.includes('/v1/plan')) {
      return Response.json(loadFixture('plan.json'));
    }
    if (url.includes('/v1/dpr')) {
      return Response.json(loadFixture('dpr.json'));
    }
    return Response.json({}, { status: 404 });
  },
});
