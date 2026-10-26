import catalog from '../reference-catalog.json' with {type: 'json'};
import {APPEARANCE_SITES} from './photo-appearance.js';

export default {...catalog, sites: [...catalog.sites, ...APPEARANCE_SITES]};
