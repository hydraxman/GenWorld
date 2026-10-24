import {cameraAt} from './camera.js';
export const FILM_DURATION=46;
export function filmCameraAt(time){
 if(time<36)return cameraAt(time);
 return {position:[8,21,32],target:[0,11.5,-3],fov:46,shot:'建筑分层展开与复原'};
}
