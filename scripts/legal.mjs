// Genera las páginas legales (static/*.html) a partir de un solo modelo.
// IMPORTANTE: son modelos para revisar con un abogado. Completá los datos marcados con [COMPLETAR].
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'static');
const TITULAR = '[COMPLETAR: nombre o razón social]';
const CONTACTO = '[COMPLETAR: email de contacto]';
const FECHA = '1 de octubre de 2026';

const page = (title, body) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Contracorriente</title><meta name="robots" content="noindex">
<link rel="icon" href="icon.svg">
<style>
:root{--bg:#0d0a20;--card:#17123a;--text:#f3efff;--muted:#a69ecb;--gold:#ffb547}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px 64px}a{color:var(--gold)}h1{font-size:28px;margin:8px 0 4px}h2{font-size:19px;margin-top:28px}
.meta{color:var(--muted);font-size:14px}.box{background:var(--card);border:1px solid #2c2560;border-radius:14px;padding:16px 18px;margin:18px 0}
nav{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}li{margin:6px 0}
</style></head><body><main>
<nav><a href="/">← Volver al juego</a><a href="terminos">Términos</a><a href="privacidad">Privacidad</a><a href="reembolsos">Reembolsos</a><a href="arrepentimiento">Arrepentimiento</a></nav>
<h1>${title}</h1><p class="meta">Última actualización: ${FECHA}</p>
${body}
</main></body></html>`;

const pages = {
  terminos: ['Términos y condiciones', `
<p>Estos términos regulan el uso de <b>Contracorriente</b> (el "Juego"), ofrecido por ${TITULAR} (el "Titular"). Al jugar aceptás estos términos.</p>
<h2>1. El servicio</h2><p>Contracorriente es un juego gratuito que se juega en el navegador. Algunas funciones (modo online, cuentas, ranking) necesitan conexión a internet. El Titular puede modificar, suspender o discontinuar funciones con aviso razonable.</p>
<h2>2. Edad</h2><p>El Juego está pensado para personas de 13 años o más. Si tenés menos de 18 años, necesitás el permiso de tus padres o tutores para crear una cuenta y, en especial, para hacer compras.</p>
<h2>3. Cuentas</h2><p>Podés jugar sin cuenta, pero en ese caso tu progreso se guarda solo en tu dispositivo y se puede perder. Si creás una cuenta, sos responsable de mantener tu contraseña y tu código de recuperación en reserva. Podés eliminar tu cuenta en cualquier momento desde Ajustes.</p>
<h2>4. Conducta</h2><p>No está permitido usar trampas, programas externos, explotar errores, suplantar a otras personas ni usar nombres ofensivos. El Titular puede suspender cuentas que incumplan estas reglas y quitar puntajes del ranking.</p>
<h2>5. Compras y contenido virtual</h2><ul>
<li>El Juego ofrece cosméticos (skins, estelas, estilos de nombre, música) y un pase de temporada. <b>Son solo visuales y no dan ninguna ventaja en el juego.</b></li>
<li>Lo que comprás es una licencia personal, no transferible, para usar ese contenido dentro del Juego mientras el servicio exista. No tiene valor monetario ni se puede canjear por dinero.</li>
<li>Los destellos (moneda del juego) se ganan jugando y no se venden.</li>
<li>Los pagos se procesan a través de Mercado Pago, PayPal o dLocal Go, según el medio que elijas; el Titular no guarda datos de tarjetas. Los precios se muestran en la moneda del país elegido y el monto final se confirma en la página de pago.</li>
<li>Derecho de arrepentimiento y reembolsos: ver <a href="reembolsos">Reembolsos</a> y <a href="arrepentimiento">Botón de arrepentimiento</a>.</li></ul>
<h2>6. Propiedad intelectual</h2><p>El Juego, su código, diseño, música y marcas pertenecen al Titular o a sus licenciantes. No podés copiarlos ni distribuirlos sin autorización.</p>
<h2>7. Responsabilidad</h2><p>El Juego se ofrece "tal cual". El Titular hace lo posible para que funcione bien, pero no garantiza que esté libre de errores o disponible siempre. Nada de esto limita los derechos que te da la Ley de Defensa del Consumidor (Ley 24.240).</p>
<h2>8. Cambios</h2><p>Si cambiamos estos términos, lo vamos a avisar en el Juego. Si seguís jugando después del aviso, se entiende que los aceptás.</p>
<h2>9. Ley aplicable y contacto</h2><p>Se aplican las leyes de la República Argentina. Consultas: ${CONTACTO}.</p>`],

  privacidad: ['Política de privacidad', `
<p>En esta política explicamos qué datos usa <b>Contracorriente</b>, para qué y cómo podés controlarlos. Responsable: ${TITULAR} (${CONTACTO}).</p>
<h2>Qué datos usamos</h2><ul>
<li><b>Sin cuenta:</b> tu progreso se guarda en tu propio dispositivo (almacenamiento del navegador). Si hay conexión, también se crea una copia de respaldo anónima con un código de recuperación.</li>
<li><b>Con cuenta:</b> tu email (o tu cuenta de Google), una contraseña guardada cifrada (nunca en texto plano) y tu progreso.</li>
<li><b>Para jugar online:</b> el nombre que elegís, tu aspecto en el juego, tu nivel y tu código de amigo.</li>
<li><b>Ranking:</b> tu nombre, nivel y puntajes.</li>
<li><b>Estadísticas de uso anónimas:</b> un identificador aleatorio del dispositivo, rondas jugadas, en qué parte del juego perdés y qué secciones abrís. No incluyen tu nombre ni tu email.</li>
<li><b>Compras:</b> qué compraste y el número de operación. Los datos de pago los manejan Mercado Pago, PayPal o dLocal Go; nosotros no vemos tu tarjeta.</li>
<li><b>Datos técnicos:</b> la dirección IP, solo para limitar abusos (por ejemplo, muchos intentos de inicio de sesión). No se guarda en forma permanente.</li></ul>
<h2>Para qué</h2><p>Para que puedas jugar, guardar y recuperar tu progreso, jugar con otras personas, mostrar el ranking, entregarte lo que compraste y mejorar el juego. No vendemos tus datos ni los usamos para publicidad.</p>
<h2>Dónde se guardan</h2><p>En los servidores del proveedor de hosting y de base de datos del Juego [COMPLETAR: por ejemplo, Render y Supabase], que pueden estar fuera de Argentina.</p>
<h2>Tus derechos</h2><p>Podés acceder a tus datos, corregirlos o pedir que se eliminen (Ley 25.326 de Protección de Datos Personales). Podés eliminar tu cuenta desde <b>Ajustes → Eliminar mi cuenta</b>, o escribirnos a ${CONTACTO}. La Agencia de Acceso a la Información Pública es el órgano de control de esta ley y atiende denuncias y reclamos.</p>
<h2>Menores</h2><p>El Juego no está dirigido a menores de 13 años. Si sos padre, madre o tutor y creés que un menor nos dio datos, escribinos y los eliminamos.</p>
<h2>Cookies y almacenamiento</h2><p>No usamos cookies de publicidad ni de seguimiento de terceros. Usamos el almacenamiento local del navegador para guardar tu progreso y tus ajustes.</p>`],

  reembolsos: ['Reembolsos', `
<p>Queremos que estés conforme con lo que comprás en <b>Contracorriente</b>.</p>
<h2>Derecho de arrepentimiento</h2><p>Por la Ley 24.240 (art. 34) podés revocar una compra dentro de los <b>10 días corridos</b> desde que la hiciste, sin dar explicaciones. Usá el <a href="arrepentimiento">Botón de arrepentimiento</a>. Te devolvemos el dinero por el mismo medio de pago y retiramos el contenido comprado de tu cuenta.</p>
<h2>Problemas con una compra</h2><p>Si pagaste y no recibiste lo que compraste, o se te cobró dos veces, escribinos a ${CONTACTO} con tu email de cuenta y el número de operación del medio de pago. Lo resolvemos y, si corresponde, te devolvemos el dinero.</p>
<h2>Fuera de esos casos</h2><p>El contenido virtual ya entregado no tiene devolución, salvo que la ley disponga otra cosa.</p>`],

  arrepentimiento: ['Botón de arrepentimiento', `
<div class="box"><p>Si compraste algo en Contracorriente en los últimos <b>10 días</b>, podés arrepentirte y pedir la devolución del dinero.</p>
<p><a href="mailto:${CONTACTO}?subject=Arrepentimiento%20de%20compra&body=Email%20de%20mi%20cuenta%3A%0AN%C3%BAmero%20de%20operaci%C3%B3n%20de%20Mercado%20Pago%3A%0AFecha%20de%20compra%3A%0AQu%C3%A9%20compr%C3%A9%3A" style="display:inline-block;background:#ffb547;color:#1a1333;font-weight:800;padding:12px 18px;border-radius:999px;text-decoration:none">Quiero arrepentirme de mi compra</a></p>
<p class="meta">Te vamos a responder con un código de trámite dentro de las 24 horas (Resolución 424/2020 de la Secretaría de Comercio Interior).</p></div>
<p>Incluí el email de tu cuenta, el número de operación del medio de pago y qué compraste. No tenés que explicar el motivo.</p>`],
};

for (const [file, [title, body]] of Object.entries(pages)) writeFileSync(join(out, file + '.html'), page(title, body));
console.log('Páginas legales generadas:', Object.keys(pages).join(', '));
