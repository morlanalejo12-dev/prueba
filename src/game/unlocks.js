// El menú se va habilitando de a una sección, para no abrumar al jugador nuevo.
// rounds: rondas jugadas necesarias. Los dueños (código) ven todo.
export const FEATURES = [
  { id: 'collection', name: 'Colección', rounds: 1 },
  { id: 'missions', name: 'Misiones', rounds: 2 },
  { id: 'shop', name: 'Tienda', rounds: 3 },
  { id: 'season', name: 'Pase de temporada', rounds: 4 },
  { id: 'online', name: 'Online con amigos', rounds: 5 },
  { id: 'music', name: 'Música', rounds: 6 },
  { id: 'names', name: 'Tu nombre', rounds: 7 },
  { id: 'friends', name: 'Amigos', rounds: 8 },
  { id: 'challenge', name: 'Desafío del día', rounds: 3 },
  { id: 'premium', name: 'Tienda Premium', rounds: 10 },
];

export const isUnlocked = (save, id) => {
  const f = FEATURES.find(x => x.id === id);
  return !f || save.ownerAll || save.rounds >= f.rounds;
};

// Lo que se habilitó al pasar de `before` a `after` rondas
export const newlyUnlocked = (before, after) => FEATURES.filter(f => before < f.rounds && after >= f.rounds);

// La próxima sección por habilitar (se muestra como adelanto)
export const nextFeature = save => FEATURES.filter(f => !isUnlocked(save, f.id)).sort((a, b) => a.rounds - b.rounds)[0] || null;
