import type { CompanyConfig } from '../../types/index.js';
import consumer from './consumer.json' with { type: 'json' };
import deepTech from './deep-tech.json' with { type: 'json' };
import enterpriseSoftware from './enterprise-software.json' with { type: 'json' };
import fintech from './fintech.json' with { type: 'json' };
import health from './health.json' with { type: 'json' };

export const companies: CompanyConfig[] = [
  ...(consumer as CompanyConfig[]),
  ...(deepTech as CompanyConfig[]),
  ...(enterpriseSoftware as CompanyConfig[]),
  ...(fintech as CompanyConfig[]),
  ...(health as CompanyConfig[]),
];
