import {cameraAt} from './camera.js';
export const FILM_DURATION=46;
export function filmCameraAt(time){
 if(time<36)return cameraAt(time);
 return {position:[25,49,30],target:[0,10.5,-3],fov:42,shot:'建筑分层展开与复原'};
}
