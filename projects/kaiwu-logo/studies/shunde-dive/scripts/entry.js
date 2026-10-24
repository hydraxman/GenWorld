import {startSkyFusion} from '../../sky-fusion/scripts/scene.js';
import {createBackground} from './background.js';
import {badgeAt} from './flight.js';

const source = document.documentElement.dataset.sourceScene === 'true';
const renderPass = source ? (window.__hyperframes?.getVariables().renderPass ?? 'composite') : 'badge';
startSkyFusion({createBackground: source && renderPass !== 'badge' ? createBackground : null,
  badgeLayout: badgeAt, renderPass});
