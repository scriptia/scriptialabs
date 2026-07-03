import type { ProductRecord } from './index';

// Message namespaces are camelCase ("voiceAgents") while product ids/slugs
// are kebab-case ("voice-agents") to match the URL. This is the one place
// that bridges the two, so both routing and translation lookups stay in
// sync without hardcoding the mapping at each call site.
export const productMessageKeyById: Record<ProductRecord['id'], 'scriptia' | 'padelco' | 'voiceAgents'> = {
  scriptia: 'scriptia',
  padelco: 'padelco',
  'voice-agents': 'voiceAgents'
};
