// Version 1.0 — lib/email-translations.ts
//
// Translated strings for the signup key-delivery email
// (lib/send-email.ts). Deliberately a SEPARATE file/object from
// app/risk-api/i18n.ts's RISK_API_TRANSLATIONS, even though it reuses
// that file's LangCode type — the UI i18n dict holds short on-screen
// labels for a React component tree; this holds full paragraph-level
// email copy (explainer text, three option blocks). Mixing the two
// would bloat RiskApiTranslations with fields the on-screen form never
// uses, and vice versa. Same 7 languages, same "technical/API terms
// stay in English" convention already established there (mint, API
// key, safety_score, curl, Python, ChatGPT, Claude — none of these are
// translated in ANY of the 7 blocks below, exactly as the rest of the
// site already treats them).
//
// NOT translated: the actual AI-assistant prompt text and code
// snippets built in send-email.ts (curl/Python/the paste-into-an-AI
// block) — those are instructions FOR an AI or a terminal, not prose
// read by the person, and every mainstream AI assistant parses English
// instructions fine regardless of the recipient's own language. Only
// the human-facing explanation around them (titles, descriptions,
// warnings) is translated here.
//
// {dailyLimit} is a literal placeholder substituted by send-email.ts —
// kept as plain text (not a template function) to match this file's
// simple Record<LangCode, EmailTranslations> shape; send-email.ts does
// a single .replace() call after picking the right language block.

import type { LangCode } from '@/app/risk-api/i18n';

export interface EmailTranslations {
  keyReadyIntro: string; // "{dailyLimit}" placeholder inside
  mintExplainer: string; // contains inline <strong> HTML — used as-is in the HTML email, stripped for the plain-text version by send-email.ts
  optionATitle: string;
  optionADesc: string;
  optionAWarning: string;
  optionBTitle: string;
  optionBDesc: string;
  optionCTitle: string;
  keyWarning: string;
  docsLabel: string;
}

export const EMAIL_TRANSLATIONS: Record<LangCode, EmailTranslations> = {
  en: {
    keyReadyIntro: 'Your free-tier key ({dailyLimit} requests/day) is ready:',
    mintExplainer:
      "This key checks any Solana token for scam risk — mint authority, insider wallets, holder concentration, and more. To check a token, you need its <strong>mint address</strong> — a long string of letters and numbers that's the token's unique ID on Solana (not its name or ticker). You can copy it from <strong>DexScreener</strong> (click the token, copy the contract address), <strong>pump.fun</strong> (shown under the token name), or your wallet.",
    optionATitle: 'Option A — Easiest: ask an AI to check it for you',
    optionADesc: 'Copy this whole block, paste it into ChatGPT or Claude, and replace the placeholder with the token\'s mint address:',
    optionAWarning:
      'This only runs automatically if your AI assistant can actually execute code or browse the internet (e.g. Claude with Code Execution enabled, or ChatGPT with Code Interpreter / browsing turned on). A plain chat-only AI will just write you code instead of running it — in that case, use Option B below with whatever code it gives you.',
    optionBTitle: 'Option B — I already have a bot (Python)',
    optionBDesc: "Copy-paste this as-is to test it (it checks USDC as an example) — then swap the address on the marked line for the token you actually want to check:",
    optionCTitle: 'Option C — Terminal / curl (for developers)',
    keyWarning: 'This key is shown once on the website and cannot be retrieved again there — keep this email as your backup.',
    docsLabel: 'Docs:',
  },
  es: {
    keyReadyIntro: 'Tu key del nivel gratuito ({dailyLimit} peticiones/día) está lista:',
    mintExplainer:
      'Esta key comprueba cualquier token de Solana en busca de riesgo de estafa — mint authority, wallets de insiders, concentración de holders, y más. Para comprobar un token necesitas su <strong>dirección mint</strong> — una cadena larga de letras y números que es el identificador único del token en Solana (no su nombre ni su ticker). Puedes copiarla desde <strong>DexScreener</strong> (haz clic en el token, copia la dirección del contrato), <strong>pump.fun</strong> (se muestra debajo del nombre del token), o tu wallet.',
    optionATitle: 'Opción A — La más fácil: pídele a una IA que lo compruebe por ti',
    optionADesc: 'Copia todo este bloque, pégalo en ChatGPT o Claude, y sustituye el marcador de posición por la dirección mint del token:',
    optionAWarning:
      'Esto solo se ejecuta automáticamente si tu asistente de IA puede realmente ejecutar código o navegar por internet (por ejemplo, Claude con Code Execution activado, o ChatGPT con Code Interpreter / navegación activada). Una IA de solo chat simplemente te escribirá código en lugar de ejecutarlo — en ese caso, usa la Opción B con el código que te dé.',
    optionBTitle: 'Opción B — Ya tengo un bot (Python)',
    optionBDesc: 'Copia y pega esto tal cual para probarlo (comprueba USDC como ejemplo) — luego cambia la dirección en la línea marcada por el token que realmente quieres comprobar:',
    optionCTitle: 'Opción C — Terminal / curl (para desarrolladores)',
    keyWarning: 'Esta key se muestra una sola vez en el sitio web y no se puede recuperar allí de nuevo — guarda este email como tu copia de seguridad.',
    docsLabel: 'Docs:',
  },
  fr: {
    keyReadyIntro: 'Votre clé du niveau gratuit ({dailyLimit} requêtes/jour) est prête :',
    mintExplainer:
      "Cette clé vérifie tout token Solana pour détecter un risque d'arnaque — mint authority, wallets d'insiders, concentration des holders, et plus. Pour vérifier un token, vous avez besoin de son <strong>adresse mint</strong> — une longue chaîne de lettres et de chiffres qui est l'identifiant unique du token sur Solana (pas son nom ni son ticker). Vous pouvez la copier depuis <strong>DexScreener</strong> (cliquez sur le token, copiez l'adresse du contrat), <strong>pump.fun</strong> (affichée sous le nom du token), ou votre wallet.",
    optionATitle: 'Option A — Le plus simple : demandez à une IA de le vérifier pour vous',
    optionADesc: "Copiez tout ce bloc, collez-le dans ChatGPT ou Claude, et remplacez le placeholder par l'adresse mint du token :",
    optionAWarning:
      "Cela ne s'exécute automatiquement que si votre assistant IA peut réellement exécuter du code ou naviguer sur internet (par exemple Claude avec Code Execution activé, ou ChatGPT avec Code Interpreter / navigation activée). Une IA de simple chat vous écrira juste du code au lieu de l'exécuter — dans ce cas, utilisez l'Option B ci-dessous avec le code qu'elle vous donne.",
    optionBTitle: 'Option B — J\'ai déjà un bot (Python)',
    optionBDesc: 'Copiez-collez ceci tel quel pour le tester (il vérifie USDC comme exemple) — puis remplacez l\'adresse sur la ligne marquée par le token que vous voulez vraiment vérifier :',
    optionCTitle: 'Option C — Terminal / curl (pour développeurs)',
    keyWarning: "Cette clé n'est affichée qu'une seule fois sur le site et ne peut plus y être récupérée — conservez cet email comme sauvegarde.",
    docsLabel: 'Docs :',
  },
  el: {
    keyReadyIntro: 'Το δωρεάν key σου ({dailyLimit} αιτήματα/ημέρα) είναι έτοιμο:',
    mintExplainer:
      'Αυτό το key ελέγχει οποιοδήποτε Solana token για κίνδυνο απάτης — mint authority, insider wallets, συγκέντρωση holders, και άλλα. Για να ελέγξεις ένα token χρειάζεσαι τη <strong>διεύθυνση mint</strong> του — μια μεγάλη ακολουθία από γράμματα και αριθμούς που είναι το μοναδικό ID του token στο Solana (όχι το όνομα ή το ticker του). Μπορείς να την αντιγράψεις από το <strong>DexScreener</strong> (κάνε κλικ στο token, αντέγραψε τη διεύθυνση του συμβολαίου), το <strong>pump.fun</strong> (εμφανίζεται κάτω από το όνομα του token), ή το wallet σου.',
    optionATitle: 'Επιλογή A — Το πιο εύκολο: ζήτα από ένα AI να το ελέγξει για σένα',
    optionADesc: 'Αντέγραψε όλο αυτό το block, επικόλλησέ το στο ChatGPT ή στο Claude, και αντικατέστησε το placeholder με τη διεύθυνση mint του token:',
    optionAWarning:
      'Αυτό τρέχει αυτόματα μόνο αν ο AI βοηθός σου μπορεί πραγματικά να εκτελέσει κώδικα ή να περιηγηθεί στο internet (π.χ. Claude με ενεργοποιημένο Code Execution, ή ChatGPT με Code Interpreter / περιήγηση ενεργή). Ένα απλό AI μόνο-chat απλώς θα σου γράψει κώδικα αντί να τον τρέξει — σε αυτή την περίπτωση, χρησιμοποίησε την Επιλογή B παρακάτω με όποιον κώδικα σου δώσει.',
    optionBTitle: 'Επιλογή B — Έχω ήδη ένα bot (Python)',
    optionBDesc: 'Αντέγραψε-επικόλλησε αυτό όπως είναι για να το δοκιμάσεις (ελέγχει το USDC ως παράδειγμα) — μετά άλλαξε τη διεύθυνση στη σημειωμένη γραμμή με το token που πραγματικά θέλεις να ελέγξεις:',
    optionCTitle: 'Επιλογή C — Τερματικό / curl (για προγραμματιστές)',
    keyWarning: 'Αυτό το key εμφανίζεται μία φορά στο site και δεν μπορεί να ανακτηθεί ξανά εκεί — κράτησε αυτό το email ως εφεδρικό.',
    docsLabel: 'Docs:',
  },
  ru: {
    keyReadyIntro: 'Твой бесплатный ключ ({dailyLimit} запросов/день) готов:',
    mintExplainer:
      'Этот ключ проверяет любой Solana-токен на риск скама — mint authority, инсайдерские кошельки, концентрацию холдеров и другое. Чтобы проверить токен, нужен его <strong>mint-адрес</strong> — длинная строка из букв и цифр, уникальный ID токена в Solana (не название и не тикер). Его можно скопировать на <strong>DexScreener</strong> (открой токен, скопируй адрес контракта), на <strong>pump.fun</strong> (показан под названием токена), или в своём кошельке.',
    optionATitle: 'Вариант A — Проще всего: попроси ИИ проверить за тебя',
    optionADesc: 'Скопируй весь этот блок, вставь в ChatGPT или Claude, замени плейсхолдер на mint-адрес токена:',
    optionAWarning:
      'Это сработает автоматически, только если у твоего ИИ-ассистента реально включено выполнение кода или доступ в интернет (например, Claude с включённым Code Execution, или ChatGPT с Code Interpreter / браузингом). Обычный чат-ИИ без этого просто напишет тебе код, а не выполнит его — в таком случае используй Вариант B ниже с тем кодом, что он выдаст.',
    optionBTitle: 'Вариант B — У меня уже есть бот (Python)',
    optionBDesc: 'Скопируй и вставь как есть, чтобы протестировать (проверяет USDC для примера) — потом замени адрес на отмеченной строке на тот токен, который реально хочешь проверить:',
    optionCTitle: 'Вариант C — Терминал / curl (для разработчиков)',
    keyWarning: 'Этот ключ показывается на сайте один раз и не может быть получен там повторно — сохрани это письмо как резервную копию.',
    docsLabel: 'Документация:',
  },
  it: {
    keyReadyIntro: 'La tua key gratuita ({dailyLimit} richieste/giorno) è pronta:',
    mintExplainer:
      "Questa key controlla qualsiasi token Solana per rischio di truffa — mint authority, wallet di insider, concentrazione degli holder, e altro. Per controllare un token ti serve il suo <strong>indirizzo mint</strong> — una lunga stringa di lettere e numeri che è l'ID univoco del token su Solana (non il nome né il ticker). Puoi copiarlo da <strong>DexScreener</strong> (clicca sul token, copia l'indirizzo del contratto), <strong>pump.fun</strong> (mostrato sotto il nome del token), o dal tuo wallet.",
    optionATitle: "Opzione A — La più semplice: chiedi a un'IA di controllarlo per te",
    optionADesc: "Copia tutto questo blocco, incollalo in ChatGPT o Claude, e sostituisci il placeholder con l'indirizzo mint del token:",
    optionAWarning:
      "Questo funziona automaticamente solo se il tuo assistente IA può davvero eseguire codice o navigare in internet (ad esempio Claude con Code Execution attivo, o ChatGPT con Code Interpreter / navigazione attiva). Un'IA di solo chat ti scriverà semplicemente il codice invece di eseguirlo — in quel caso, usa l'Opzione B qui sotto con il codice che ti fornisce.",
    optionBTitle: 'Opzione B — Ho già un bot (Python)',
    optionBDesc: "Copia e incolla questo così com'è per testarlo (controlla USDC come esempio) — poi sostituisci l'indirizzo sulla riga contrassegnata con il token che vuoi davvero controllare:",
    optionCTitle: 'Opzione C — Terminale / curl (per sviluppatori)',
    keyWarning: 'Questa key viene mostrata una sola volta sul sito e non può più essere recuperata lì — conserva questa email come backup.',
    docsLabel: 'Docs:',
  },
  zh: {
    keyReadyIntro: '你的免费套餐密钥（每天 {dailyLimit} 次请求）已就绪：',
    mintExplainer:
      '此密钥可检测任意 Solana 代币的诈骗风险 —— 包括 mint authority（铸币权限）、内部人钱包、持仓集中度等。要检测某个代币，你需要它的 <strong>mint 地址</strong> —— 一串很长的字母数字组合，是该代币在 Solana 上的唯一标识（不是代币名称或代码）。你可以从 <strong>DexScreener</strong>（点击代币，复制合约地址）、<strong>pump.fun</strong>（显示在代币名称下方）或你的钱包中复制它。',
    optionATitle: '方案 A —— 最简单：让 AI 帮你检测',
    optionADesc: '复制下面整个代码块，粘贴到 ChatGPT 或 Claude 中，把占位符替换成代币的 mint 地址：',
    optionAWarning:
      '只有当你的 AI 助手真正能够执行代码或访问互联网时（例如开启了 Code Execution 的 Claude，或开启了 Code Interpreter / 联网功能的 ChatGPT），这段提示才会自动运行。普通的纯聊天 AI 只会给你写代码而不会执行它 —— 这种情况下，请用它给你的代码，参照下面的方案 B。',
    optionBTitle: '方案 B —— 我已经有一个机器人（Python）',
    optionBDesc: '直接复制粘贴以下代码进行测试（示例中检测的是 USDC）—— 然后把标注的那一行地址换成你真正想检测的代币：',
    optionCTitle: '方案 C —— 终端 / curl（面向开发者）',
    keyWarning: '此密钥在网站上仅显示一次，之后无法再次查看 —— 请保留此邮件作为备份。',
    docsLabel: '文档：',
  },
};
