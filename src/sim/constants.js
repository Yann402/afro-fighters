// Constantes globales de la simulation (unités : mètres, frames à 60 Hz)
export const FPS = 60;
export const DT = 1 / FPS;
export const STAGE_HALF = 6.6;        // demi-largeur de l'arène jouable
export const MAX_SEPARATION = 7.2;    // distance max entre combattants (cadrage caméra)
export const GRAVITY = 0.0115;
export const FRICTION = 0.82;
export const ROUND_TIME = 60;         // secondes
export const ROUNDS_TO_WIN = 2;
export const METER_MAX = 100;
export const INPUT_BUFFER = 8;        // frames de tampon pour les entrées
export const HURT_HALF_WIDTH = 0.34;
export const LAND_FRAMES = 4;
export const DOWN_FRAMES = 38;
export const GETUP_FRAMES = 22;
export const JUMPSQUAT = 3;
