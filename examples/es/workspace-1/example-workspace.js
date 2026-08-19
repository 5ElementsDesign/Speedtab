const exampleWorkspaceDefinition = [
  /**
   * Page: Principal
   * Module: Notas
   * Tab: Inicio
   */
  {
    page: 'Principal',
    module: 'Notas',
    tab: 'Inicio',
    type: 'text',
    colorScheme: 'success',
    title: 'Mi primera nota',
    content: `Usa la frase de paso 'Secret' para desbloquear el secreto`,
  },
  {
    page: 'Principal',
    module: 'Notas',
    tab: 'Inicio',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Secret',
    title: 'Secreto',
    content: `¡Speedtab es increíble!`,
  },
  {
    page: 'Principal',
    module: 'Notas',
    tab: 'Inicio',
    type: 'html',
    colorScheme: 'primary',
    title: 'Bienvenido a Speedtab',
    content: `
<div data-yai-tabs="" data-nav="top" data-theme="light" data-color-accent="primary" data-behavior="blur" data-swipe="" data-closable="false" data-auto-accessibility="false">
  <nav data-controller="">
    <button data-tab-action="open" data-open="1" data-default="">Bienvenido</button>
    <button data-tab-action="open" data-open="2">A tener en cuenta</button>
  </nav>
  <div data-content="">
    <div data-tab="1" class="p-3">
      <div data-swipe-ignore>
        <h2>Bienvenido a Speedtab</h2>
        <p> Speedtab es un espacio de trabajo modular para la página de nueva pestaña con marcadores, notas, fuentes RSS, recursos, sincronización remota y exportaciones portátiles. </p>
        <blockquote>
          <p> Esta nota es una <strong>nota HTML</strong>. Puedes usar una estructura más rica que el texto plano mientras mantienes todo dentro de Speedtab. </p>
        </blockquote>
        <figure class="st-note-html-favicon-row">
          {{asset:image:1}}
          {{asset:image:2}}
          {{asset:image:3}}
        </figure>
        <h3>Aspectos destacados</h3>
        <table>
          <thead>
            <tr> <th>Función</th> <th>Qué hace</th> </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Marcadores</strong></td>
              <td>Colecciones con pestañas, imágenes de vista previa, enlaces rápidos y gestión de favicons.</td>
            </tr>
            <tr>
              <td><strong>Notas</strong></td>
              <td>Texto, código, enlaces, notas cifradas y notas HTML estructuradas.</td>
            </tr>
            <tr>
              <td><strong>Fuentes RSS</strong></td>
              <td>Lectura de RSS y Atom con gestión de fuentes y herramientas de lectura locales.</td>
            </tr>
            <tr>
              <td><strong>Sincronización remota</strong></td>
              <td>Envío y obtención por WebDAV con comparación de estados, capturas de archivo y comprobaciones de reparación.</td>
            </tr>
            <tr>
              <td><strong>Widgets</strong></td>
              <td>Widgets globales en la barra como el clima, independientes de la cuadrícula de módulos habitual.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div data-tab="2" class="p-3">
      <div data-swipe-ignore>
        <h2>A tener en cuenta</h2>
        <ul>
          <li>La exportación local y la sincronización remota son conceptos independientes.</li>
          <li>Las notas cifradas permanecen bloqueadas hasta que se introduce una frase de paso.</li>
          <li>Las notas abiertas pueden flotar sobre la página como pequeñas ventanas de aplicación.</li>
          <li>Las notas HTML se depuran antes de renderizarse.</li>
        </ul>
        <h3>Ejemplo de contenido de diseño</h3>
        <p> Las notas HTML funcionan genial para paneles compactos, tarjetas de bienvenida, guías, registros de cambios y pequeños bloques de documentación. </p>
        <pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Chrome Web Store&lt;/a&gt;</code></pre>
        <p> <small>Enlace útil:</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> Speedtab en Chrome Web Store </a> </p>
        <hr>
        <p> <strong>Consejo:</strong> Esta nota está pensada como una plantilla inicial. Duplícala y reemplaza las secciones con tu propia guía para el panel. </p>
      </div>
    </div>
  </div>
</div>
    `,
  },
]

export default exampleWorkspaceDefinition
