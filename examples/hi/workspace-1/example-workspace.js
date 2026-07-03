const exampleWorkspaceDefinition = [
  /**
   * Page: मुख्य (Main)
   * Module: नोट्स (Notes)
   * Tab: शुरुआत (Start)
   */
  {
    page: 'मुख्य',
    module: 'नोट्स',
    tab: 'शुरुआत',
    type: 'text',
    colorScheme: 'success',
    title: 'मेरा पहला नोट',
    content: `गुप्त नोट को अनलॉक करने के लिए पासफ़्रेज़ 'रहस्य' का उपयोग करें`,
  },
  {
    page: 'मुख्य',
    module: 'नोट्स',
    tab: 'शुरुआत',
    type: 'crypt',
    colorScheme: 'danger',
    passphrase: 'रहस्य',
    title: 'गुप्त',
    content: `Speedtab बहुत बढ़िया है!`,
  },
  {
    page: 'मुख्य',
    module: 'नोट्स',
    tab: 'शुरुआत',
    type: 'html',
    colorScheme: 'primary',
    title: 'Speedtab में आपका स्वागत है',
    content: `
<h2>Speedtab में आपका स्वागत है</h2>
<p> Speedtab बुकमार्क, नोट्स, फ़ीड्स, एसेट्स, रिमोट सिंक और पोर्टेबल एक्सपोर्ट के लिए एक मॉड्यूलर न्यू-टैब वर्कस्पेस है। </p>
<blockquote>
  <p> यह नोट एक <strong>HTML नोट</strong> है। यह प्लेन टेक्स्ट की तुलना में अधिक समृद्ध संरचना का उपयोग कर सकता है और फिर भी सब कुछ Speedtab के भीतर रख सकता है। </p>
</blockquote>
<figure class="st-note-html-favicon-row">
  {{asset:image:1}}
  {{asset:image:2}}
  {{asset:image:3}}
</figure>
<h3>मुख्य विशेषताएं</h3>
<table>
  <thead>
    <tr> <th>विशेषता</th> <th>यह क्या करता है</th> </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>बुकमार्क</strong></td>
      <td>टैब्ड कलेक्शन, प्रिव्यू इमेज, क्विकलिंक्स और फ़ेविकॉन प्रबंधन।</td>
    </tr>
    <tr>
      <td><strong>नोट्स</strong></td>
      <td>टेक्स्ट, कोड, लिंक्स, एन्क्रिप्टेड नोट्स और अब स्ट्रक्चर्ड HTML नोट्स।</td>
    </tr>
    <tr>
      <td><strong>फ़ीड्स</strong></td>
      <td>श्रोत प्रबंधन और लोकल रीडिंग टूल्स के साथ RSS और Atom रीडिंग।</td>
    </tr>
    <tr>
      <td><strong>रिमोट सिंक</strong></td>
      <td>स्टेट कंपैरिजन, आर्काइव स्नैपशॉट्स और रिपेयर चेक्स के साथ WebDAV पुश और पुल।</td>
    </tr>
    <tr>
      <td><strong>विजेट्स</strong></td>
      <td>सामान्य मॉड्यूल ग्रिड से स्वतंत्र, मौसम जैसे वैश्विक टूलरेल विजेट्स।</td>
    </tr>
  </tbody>
</table>
<h3>जानना महत्वपूर्ण है</h3>
<ul>
  <li>लोकल एक्सपोर्ट और रिमोट सिंक दो अलग-अलग अवधारणाएं हैं।</li>
  <li>एन्क्रिप्टेड नोट्स तब तक लॉक रहते हैं जब तक पासफ़्रेज़ दर्ज नहीं किया जाता।</li>
  <li>ओपन नोट्स छोटे ऐप विंडो की तरह पेज के ऊपर तैर सकते हैं।</li>
  <li>HTML नोट्स दिखाने से पहले सैनिटाइज़ किए जाते हैं।</li>
</ul>
<h3>उदाहरण लेआउट सामग्री</h3>
<p> HTML नोट्स कॉम्पैक्ट डैशबोर्ड, स्टार्टर गाइड, चेंजलॉग और छोटे डॉक्यूमेंटेशन ब्लॉक्स के लिए बहुत उपयुक्त हैं। </p>
<pre><code>&lt;a href="https://chromewebstore.google.com/" target="_blank"&gt;Chrome वेब स्टोर&lt;/a&gt;</code></pre>
<p> <small>उपयोगी लिंक:</small> <a href="https://chromewebstore.google.com/detail/speedtab/adkjbdepojalajhfkoobiedddlnoamff" target="_blank" rel="noopener noreferrer"> Chrome वेब स्टोर पर Speedtab </a> </p>
<hr>
<p> <strong>संकेत:</strong> यह नोट एक शुरुआती टेम्पलेट के रूप में डिज़ाइन किया गया है। इसे कॉपी करें और अनुभागों को अपने स्वयं के डैशबोर्ड गाइड से बदलें। </p>
    `,
  },
]

export default exampleWorkspaceDefinition
