/**
 * @jest-environment node
 *
 * `package-lock.json` is gitignored, so every fresh install re-resolves the
 * caret ranges in `package.json`. On 2026-11-02 react-native-unistyles 3.8.0
 * started requiring react-native >=0.85 while the project pins 0.83, and a
 * fresh `npm install` failed on ERESOLVE (v0.5.248). Bun and
 * `--legacy-peer-deps` install such a tree without complaint, so this checks
 * the installed tree directly: every direct dependency's required peer that is
 * itself a direct dependency must be satisfied by the installed version.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const semver = require('semver');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const pkg = require(path.join(root, 'package.json'));
const direct: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

type Manifest = {
  version: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};
const manifest = (name: string): Manifest =>
  require(path.join(root, 'node_modules', name, 'package.json'));

function unsatisfiedPeers(): string[] {
  const problems: string[] = [];
  for (const name of Object.keys(direct)) {
    const { peerDependencies = {}, peerDependenciesMeta = {} } = manifest(name);
    for (const [peer, range] of Object.entries(peerDependencies)) {
      if (!(peer in direct) || peerDependenciesMeta[peer]?.optional) continue;
      const installed = manifest(peer).version;
      if (!semver.satisfies(installed, range, { includePrerelease: true })) {
        problems.push(`${name} wants ${peer}@${range}, installed ${installed}`);
      }
    }
  }
  return problems;
}

describe('installed dependency tree', () => {
  it("satisfies every direct dependency's required peers", () => {
    expect(unsatisfiedPeers()).toEqual([]);
  });

  // The installed tree can be fine while the range is not (an old npm cache, a
  // bun.lock), so pin the range too. Lift the cap together with react-native.
  it('keeps react-native-unistyles below 3.8.0 while react-native is below 0.85', () => {
    if (semver.gte(manifest('react-native').version, '0.85.0')) return;
    expect(semver.intersects(direct['react-native-unistyles'], '>=3.8.0')).toBe(false);
  });
});
