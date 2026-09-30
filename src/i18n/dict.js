// Diccionario completo: español → [portugués, inglés]
import game from './dict-game.js';
import ui from './dict-ui.js';
import msg from './dict-msg.js';

export const DICT = { ...game, ...ui, ...msg };
