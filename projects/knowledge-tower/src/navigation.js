import { getFloor, getRoom, ROUTES } from './curriculum.js';

export const INITIAL_STATE = Object.freeze({
  floor: 1, roomId: null, topicIndex: 0, mode: 'tower', routeId: null, query: '',
});

export function transition(state, action) {
  switch (action.type) {
    case 'floor':
      getFloor(action.number);
      return { ...state, floor: action.number, roomId: null, topicIndex: 0, mode: 'floor' };
    case 'room': {
      const room = getRoom(action.id);
      const topicIndex = action.topicIndex ?? 0;
      if (!Number.isInteger(topicIndex) || !room.topics[topicIndex]) throw new RangeError('Unknown topic index');
      return { ...state, floor: room.floor, roomId: room.id, topicIndex, mode: 'floor' };
    }
    case 'topic': {
      const room = getRoom(state.roomId);
      if (!Number.isInteger(action.index) || !room.topics[action.index]) throw new RangeError('Unknown topic index');
      return { ...state, topicIndex: action.index };
    }
    case 'mode':
      if (!['tower', 'exploded', 'floor'].includes(action.mode)) throw new RangeError('Unknown viewing mode');
      return { ...state, mode: action.mode };
    case 'route': {
      if (action.id === null) return { ...state, routeId: null };
      const route = ROUTES.find(entry => entry.id === action.id);
      if (!route) throw new RangeError('Unknown learning route');
      return { ...state, routeId: route.id, floor: route.floors[0], roomId: null, topicIndex: 0, mode: 'floor' };
    }
    case 'step': {
      const route = ROUTES.find(entry => entry.id === state.routeId);
      if (!route || ![-1, 1].includes(action.delta)) throw new RangeError('Invalid route step');
      const current = route.floors.indexOf(state.floor);
      const next = current + action.delta;
      if (next < 0 || next >= route.floors.length) throw new RangeError('Route step is out of bounds');
      return transition(state, { type: 'floor', number: route.floors[next] });
    }
    case 'query':
      if (typeof action.query !== 'string') throw new TypeError('Search query must be a string');
      return { ...state, query: action.query };
    default:
      throw new RangeError(`Unknown navigation action: ${action.type}`);
  }
}

export function describeSelection(state) {
  const floor = getFloor(state.floor);
  const room = state.roomId === null ? null : getRoom(state.roomId);
  const route = ROUTES.find(entry => entry.id === state.routeId) ?? null;
  const prerequisites = room ? room.requires.map(id => getRoom(id)) : [];
  return { floor, room, route, prerequisites, routeIndex: route ? route.floors.indexOf(state.floor) : -1 };
}
