/**
 * House ESLint rules for the OneBook ELD web panel (web/tz.md §2.2 "Qat'iy qoidalar").
 * These are real rules, not review conventions.
 */
import path from 'node:path';

const FEATURES = `${path.sep}src${path.sep}features${path.sep}`;

/** Which `features/<name>` does this absolute file path belong to? */
function featureOf(filename) {
  const i = filename.indexOf(FEATURES);
  if (i === -1) return null;
  const rest = filename.slice(i + FEATURES.length);
  const name = rest.split(path.sep)[0];
  return name || null;
}

/** rule 1 — `features/*` never imports another `features/*` */
const noCrossFeatureImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'features/* must not import another features/*; shared code moves to shared/',
    },
    schema: [],
    messages: {
      cross:
        'features/{{from}} must not import features/{{to}} — move the shared code to src/shared/ (web/tz.md §2.2 rule 1).',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const own = featureOf(filename);
    if (!own) return {};
    const check = (node, value) => {
      if (typeof value !== 'string') return;
      let target = null;
      if (value.startsWith('@/features/')) {
        target = value.slice('@/features/'.length).split('/')[0];
      } else if (value.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filename), value);
        target = featureOf(resolved + path.sep);
      }
      if (target && target !== own) {
        context.report({ node, messageId: 'cross', data: { from: own, to: target } });
      }
    };
    return {
      ImportDeclaration: (n) => check(n, n.source.value),
      ExportNamedDeclaration: (n) => n.source && check(n, n.source.value),
      ExportAllDeclaration: (n) => n.source && check(n, n.source.value),
      ImportExpression: (n) => n.source.type === 'Literal' && check(n, n.source.value),
    };
  },
};

/** rule 2 — API URL strings live only in shared/api/endpoints.ts */
const ABSOLUTE_URL_RE = /^(?:https?|wss?):\/\//;
const API_PATH_RE = /^\/api(?:\/|$)/;
const REQUEST_CALLEES = new Set([
  'fetch',
  'request',
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'del',
]);
const noUrlLiteral = {
  meta: {
    type: 'problem',
    docs: { description: 'API URLs belong in shared/api/endpoints.ts' },
    schema: [],
    messages: {
      url: 'API URL literal "{{value}}" — every path belongs in shared/api/endpoints.ts (web/tz.md §2.2 rule 2).',
    },
  },
  create(context) {
    const report = (node, value) => {
      if (typeof value === 'string' && (ABSOLUTE_URL_RE.test(value) || API_PATH_RE.test(value))) {
        context.report({ node, messageId: 'url', data: { value } });
      }
    };
    /** Any string handed to fetch()/client.get()/axios.post() is a URL, whatever it looks like. */
    const isRequestCall = (node) => {
      const callee = node.callee;
      if (callee.type === 'Identifier') return REQUEST_CALLEES.has(callee.name);
      if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        const object = callee.object;
        const objectName = object.type === 'Identifier' ? object.name : '';
        return (
          REQUEST_CALLEES.has(callee.property.name) &&
          /^(client|api|axios|http|fetcher)$/i.test(objectName)
        );
      }
      return false;
    };
    return {
      Literal: (n) => report(n, n.value),
      TemplateElement: (n) => report(n, n.value.cooked),
      CallExpression(node) {
        if (!isRequestCall(node)) return;
        const [first] = node.arguments;
        if (!first) return;
        if (first.type === 'Literal' || first.type === 'TemplateLiteral') {
          context.report({
            node: first,
            messageId: 'url',
            data: { value: context.sourceCode.getText(first) },
          });
        }
      },
    };
  },
};

/** rule 3 — query keys come from the `qk` factory in shared/api/queryKeys.ts */
const noRawQueryKey = {
  meta: {
    type: 'problem',
    docs: { description: 'queryKey must come from the qk factory' },
    schema: [],
    messages: {
      raw: 'Hand-written query key — use the `qk` factory in shared/api/queryKeys.ts (web/tz.md §2.2 rule 3).',
    },
  },
  create(context) {
    return {
      'Property[computed=false] > ArrayExpression'(node) {
        const key = node.parent.key;
        const name = key.type === 'Identifier' ? key.name : key.value;
        if (name === 'queryKey' || name === 'mutationKey' || name === 'predicate') {
          context.report({ node, messageId: 'raw' });
        }
      },
    };
  },
};

/** rule 4 — no literal colour or raw pixel outside the token layer */
/**
 * A hex colour is the whole literal (`'#2563EB'`) or sits in a CSS position (`color: #2563EB`).
 * It is NOT any `#` followed by digits: the design labels units `#101` and shippers `#4821`
 * (web/bugs.md WB-002).
 */
const HEX_EXACT_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const HEX_IN_CSS_RE = /[:(,]\s*#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const isHexColour = (value) => HEX_EXACT_RE.test(value.trim()) || HEX_IN_CSS_RE.test(value);
const PX_RE = /(?:^|[^a-zA-Z0-9_-])\d+(?:\.\d+)?px\b/;
const RGB_RE = /\b(?:rgba?|hsla?)\s*\(/;
const noDesignLiteral = {
  meta: {
    type: 'problem',
    docs: { description: 'colours and sizes come from design tokens, never literals' },
    schema: [],
    messages: {
      hex: 'Literal colour "{{value}}" — use a design token from shared/ui/tokens.css (web/tz.md §2.2 rule 4).',
      px: 'Raw pixel value "{{value}}" — use a spacing/size token (web/tz.md §2.2 rule 4).',
    },
  },
  create(context) {
    const report = (node, value) => {
      if (typeof value !== 'string') return;
      if (isHexColour(value) || RGB_RE.test(value)) {
        context.report({ node, messageId: 'hex', data: { value } });
      } else if (PX_RE.test(value)) {
        context.report({ node, messageId: 'px', data: { value } });
      }
    };
    return {
      Literal: (n) => report(n, n.value),
      TemplateElement: (n) => report(n, n.value.cooked),
    };
  },
};

export default {
  rules: {
    'no-cross-feature-import': noCrossFeatureImport,
    'no-url-literal': noUrlLiteral,
    'no-raw-query-key': noRawQueryKey,
    'no-design-literal': noDesignLiteral,
  },
};
