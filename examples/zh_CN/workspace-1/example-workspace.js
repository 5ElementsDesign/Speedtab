const exampleWorkspaceDefinition = [
  /**
   * Page: 主页 (Main)
   * Module: 笔记 (Notes)
   * Tab: 开始 (Start)
   */
  {
    page: '主页',
    module: '笔记',
    tab: '开始',
    type: 'text',
    colorScheme: 'success',
    title: '我的第一条笔记',
    content: `使用密码 'Secret' 解锁隐藏笔记`,
  },
  {
    page: '主页',
    module: '笔记',
    tab: '开始',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'Secret',
    title: '机密',
    content: `Speedtab 太棒了！`,
  },
  {
    page: '主页',
    module: '笔记',
    tab: '开始',
    type: 'html',
    colorScheme: 'primary',
    title: '欢迎使用 Speedtab',
    content: `
<h2>欢迎使用 Speedtab</h2>
<p> Speedtab 是一个模块化新标签页工作区，集成书签、笔记、订阅源、资源管理、远程同步和便携式导出功能。 </p>
<blockquote>
  <p> 此笔记是一条 <strong>HTML 笔记</strong>。它支持比纯文本更丰富的结构，并且完全保留在 Speedtab 本地。 </p>
</blockquote>
<figure class="st-note-html-favicon-row">
  {{asset:image:1}}
  {{asset:image:2}}
  {{asset:image:3}}
</figure>
<h3>功能亮点</h3>
<table>
  <thead>
    <tr> <th>功能</th> <th>说明</th> </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>书签</strong></td>
      <td>标签化集合、预览图、快捷链接和 Favicon 管理。</td>
    </tr>
    <tr>
      <td><strong>笔记</strong></td>
      <td>文本、代码、链接、加密笔记以及结构化 HTML 笔记。</td>
    </tr>
    <tr>
      <td><strong>订阅源</strong></td>
      <td>集成 RSS 和 Atom 阅读器，支持源管理与本地阅读工具。</td>
    </tr>
    <tr>
      <td><strong>远程同步</strong></td>
      <td>基于 WebDAV 和 Google Drive 的推送与拉取，具备状态对比、存档快照和修复检查。</td>
    </tr>
    <tr>
      <td><strong>小组件</strong></td>
      <td>独立于模块网格的全域工具组件（如天气和时钟）。</td>
    </tr>
  </tbody>
</table>
<h3>使用须知</h3>
<ul>
  <li>本地导出与远程同步是两个相互独立的功能。</li>
  <li>加密笔记在输入正确密码前将保持锁定状态。</li>
  <li>打开的笔记可以像悬浮窗口一样浮动在页面上方。</li>
  <li>HTML 笔记在渲染前都会进行安全净化处理。</li>
</ul>
<h3>示例布局内容</h3>
<p> HTML 笔记非常适合制作紧凑的仪表板、入门指南、更新日志和小导览卡片。 </p>
<pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Chrome 网上应用店&lt;/a&gt;</code></pre>
<p> <small>常用链接：</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> 在 Chrome 网上应用店查看 Speedtab </a> </p>
<hr>
<p> <strong>提示：</strong> 此笔记设计为入门模板。您可以自由复制并用自己的指南替换相应内容。 </p>
    `,
  },
]

export default exampleWorkspaceDefinition
