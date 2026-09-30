// Nombres de jugador: sin caracteres de control ni marcas HTML, hasta 16 letras
export const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
