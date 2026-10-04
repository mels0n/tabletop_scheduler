/* global module */
/**
 * Dependency rules for this repository.
 *
 * Layer order, top to bottom (imports only point downward):
 *
 *   app         Next.js App Router: routes, pages, layouts, route handlers
 *   components  page-level UI blocks shared by several routes (widgets)
 *   features    user actions with business value, one slice per domain
 *   entities    business nouns and their rules
 *   shared      config, errors, logger, db client, generic helpers
 *
 * Slices inside `features/` are reached through their `index.ts`. Nested
 * slices under `features/integrations/<name>/` count as slices of their own.
 *
 * Run: npm run depcruise
 */

// Direction, cycles and unresolvable imports fail CI. Cross-slice deep imports
// and orphans are reported as warnings until the remaining ones are untangled.
const GATE = 'error';

const LAYERS = ['app', 'components', 'features', 'entities', 'shared'];

/** One rule per layer: it may not import from any layer above it. */
const upwardRules = LAYERS.slice(1).map((layer, i) => {
  const above = LAYERS.slice(0, i + 1);
  return {
    name: 'no-upward-imports',
    comment:
      `'${layer}' may only import from layers below it (${above.join(', ')} are above). ` +
      'Move the shared code down a layer instead of reaching up.',
    severity: GATE,
    from: { path: `^${layer}/` },
    to: { path: `^(${above.join('|')})/` },
  };
});

// A feature slice is `features/<name>/` or `features/integrations/<name>/`.
const FEATURE_SLICE = '(integrations/[^/]+|[^/]+)';

module.exports = {
  forbidden: [
    ...upwardRules,
    {
      name: 'no-cross-slice-deep-imports',
      comment:
        "A feature may use another feature only through that slice's index.ts. " +
        'Export what you need from the index, or move the shared part to entities/ or shared/.',
      severity: 'warn',
      from: { path: `^features/${FEATURE_SLICE}/` },
      to: {
        path: '^features/',
        pathNot: [`^features/$1/`, `^features/${FEATURE_SLICE}/index\\.(ts|tsx)$`],
      },
    },
    {
      name: 'blog-source-is-generator-only',
      comment:
        'Raw blog posts (content/blog) and gray-matter belong to scripts/generate-published-posts.mjs only. ' +
        'Read posts through shared/lib/blog.ts, which serves the generated module of published posts.',
      severity: GATE,
      from: {},
      to: { path: ['^content/', '(^|/)node_modules/gray-matter/'] },
    },
    {
      name: 'generated-posts-via-blog-lib-only',
      comment:
        'The generated module of published posts is read through shared/lib/blog.ts and nowhere else.',
      severity: GATE,
      from: { pathNot: '^shared/lib/blog\\.ts$' },
      to: { path: '^shared/data/published-posts\\.generated\\.ts$' },
    },
    {
      name: 'no-circular',
      comment: 'A cycle means a layer or slice boundary has already been crossed somewhere.',
      severity: GATE,
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'This import does not resolve to a file or an installed package.',
      severity: GATE,
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-orphans',
      comment: 'Nothing imports this module. Delete it or wire it up.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.(test|spec)\\.(ts|tsx)$',
          '(^|/)__mocks__/',
          '\\.d\\.ts$',
          // App Router file conventions are entry points, not imports.
          '^app/(|.*/)(page|layout|template|loading|error|global-error|not-found|default|route|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\\.(ts|tsx|js|jsx)$',
          '(^|/)[^/]+\\.config\\.(js|cjs|mjs|ts|mts)$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.(test|spec)\\.(ts|tsx)$', '(^|/)__mocks__/'] },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
