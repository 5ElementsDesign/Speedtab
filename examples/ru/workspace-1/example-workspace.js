const exampleWorkspaceDefinition = [
  /**
   * Page: Главная (Main)
   * Module: Заметки (Notes)
   * Tab: Старт (Start)
   */
  {
    page: 'Главная',
    module: 'Заметки',
    tab: 'Старт',
    type: 'text',
    colorScheme: 'success',
    title: 'Моя первая заметка',
    content: `Используйте пароль 'Секрет' для разблокировки скрытой заметки`,
  },
  {
    page: 'Главная',
    module: 'Заметки',
    tab: 'Старт',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Секрет',
    title: 'Секрет',
    content: `Speedtab — это отлично!`,
  },
  {
    page: 'Главная',
    module: 'Заметки',
    tab: 'Старт',
    type: 'html',
    colorScheme: 'primary',
    title: 'Добро пожаловать в Speedtab',
    content: `
<div data-yai-tabs data-nav="top" data-theme="light" data-color-accent="primary" data-behavior="blur" data-swipe data-closable="false" data-auto-accessibility="false">
  <nav data-controller>
    <button data-tab-action="open" data-open="1" data-default>Добро пожаловать</button>
    <button data-tab-action="open" data-open="2">Полезно знать</button>
  </nav>
  <div data-content class="scrollbar-gutter-stable">
    <div data-tab="1" class="p-3">
      <h2>Добро пожаловать в Speedtab</h2>
      <p> Speedtab — это модульное рабочее пространство для новой вкладки с закладками, заметками, лентами новостей, ресурсами, удаленной синхронизацией и переносом данных. </p>
      <blockquote>
        <p> Эта заметка является <strong>HTML-заметкой</strong>. Она может использовать более богатую структуру, чем обычный текст, сохраняя всё внутри Speedtab. </p>
      </blockquote>
      <figure class="st-note-html-favicon-row">
        {{asset:image:1}}
        {{asset:image:2}}
        {{asset:image:3}}
      </figure>
      <div data-st-margin="0 0 .5rem" data-st-text-align="center">
        <section data-world-clock data-st-font-size="16px"><span data-clock-zone></span> - <b data-clock data-seconds></b> - <small data-date></small></section>
      </div>
      <h3>Главное</h3>
      <table>
        <thead>
          <tr> <th>Функция</th> <th>Описание</th> </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Закладки</strong></td>
            <td>Коллекции со вкладками, изображения предпросмотра, быстрые ссылки и управление значками страниц (favicon).</td>
          </tr>
          <tr>
            <td><strong>Заметки</strong></td>
            <td>Текст, код, ссылки, зашифрованные заметки и форматированные HTML-заметки.</td>
          </tr>
          <tr>
            <td><strong>Ленты новостей</strong></td>
            <td>Чтение RSS и Atom с управлением источниками и встроенными инструментами чтения.</td>
          </tr>
          <tr>
            <td><strong>Удаленная синхронизация</strong></td>
            <td>WebDAV push и pull со сравнением состояний, архивными снимками и проверкой целостности.</td>
          </tr>
          <tr>
            <td><strong>Виджеты</strong></td>
            <td>Глобальная панель инструментов с виджетами вроде погоды и часов, независимыми от основной сетки.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div data-tab="2" class="p-3">
      <h3>Полезно знать</h3>
      <ul>
        <li>Локальный экспорт и удаленная синхронизация — это две разные концепции.</li>
        <li>Зашифрованные заметки остаются заблокированными до ввода пароля.</li>
        <li>Открытые заметки могут плавать поверх страницы как мини-окна приложений.</li>
        <li>HTML-заметки очищаются перед отображением.</li>
      </ul>
      <h3>Пример макета</h3>
      <p> HTML-заметки отлично подходят для компактных панелей, руководств, списков изменений и блоков документации. </p>
      <pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Интернет-магазин Chrome&lt;/a&gt;</code></pre>
      <p> <small>Полезная ссылка:</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> Speedtab в Интернет-магазине Chrome </a> </p>
      <hr>
      <p> <strong>Совет:</strong> Эта заметка создана как стартовый шаблон. Скопируйте её и замените разделы собственными материалами. </p>
    </div>
  </div>
</div>
    `,
  },
]

export default exampleWorkspaceDefinition
