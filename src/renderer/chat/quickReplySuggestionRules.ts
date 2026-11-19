import { formatMessagePreview, isDeletedMessage, type MessageItem } from '../../shared/messages';

type ReplyLocale = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'pt' | 'ar' | 'ja' | 'zh';

type SuggestionRule = {
  test: RegExp;
  replies: Partial<Record<ReplyLocale, string[]>>;
};

const FALLBACK: Record<ReplyLocale, string[]> = {
  en: ['Got it', 'Thanks', 'Okay'],
  hi: ['Theek hai', 'Dhanyavaad', 'Samajh gaya'],
  es: ['Entendido', 'Gracias', 'Vale'],
  fr: ['Compris', 'Merci', "D'accord"],
  de: ['Verstanden', 'Danke', 'Okay'],
  pt: ['Entendi', 'Obrigado', 'Ok'],
  ar: ['تمام', 'شكراً', 'حسناً'],
  ja: ['わかりました', 'ありがとう', 'OK'],
  zh: ['好的', '谢谢', '收到'],
};

const QUESTION_FALLBACK: Record<ReplyLocale, string[]> = {
  en: ['Yes', 'No', 'Let me check'],
  hi: ['Haan', 'Nahi', 'Dekhta hoon'],
  es: ['Sí', 'No', 'Déjame ver'],
  fr: ['Oui', 'Non', 'Je vérifie'],
  de: ['Ja', 'Nein', 'Ich schaue nach'],
  pt: ['Sim', 'Não', 'Vou verificar'],
  ar: ['نعم', 'لا', 'سأتحقق'],
  ja: ['はい', 'いいえ', '確認します'],
  zh: ['好的', '不行', '我看看'],
};

const MEDIA_ACK: Record<ReplyLocale, string[]> = {
  en: ['Thanks', 'Got it', 'Looks good'],
  hi: ['Thanks', 'Mil gaya', 'Achha hai'],
  es: ['Gracias', 'Recibido', 'Se ve bien'],
  fr: ['Merci', 'Bien reçu', 'Super'],
  de: ['Danke', 'Erhalten', 'Sieht gut aus'],
  pt: ['Obrigado', 'Recebido', 'Ficou bom'],
  ar: ['شكراً', 'وصلني', 'رائع'],
  ja: ['ありがとう', '確認した', 'いいね'],
  zh: ['谢谢', '收到了', '不错'],
};

const RULES: SuggestionRule[] = [
  {
    test: /\b(good\s*night|goodnight|gn\b|nighty\s*night|शुभ रात्रि|शुभरात्रि)\b|शुभ रात/i,
    replies: {
      en: ['Good night', 'You too', 'Take care'],
      hi: ['Good night', 'Waise hi', 'Take care'],
    },
  },
  {
    test: /\b(good\s*morning|morning|gm\b|सुप्रभात|शुभ प्रभात)\b/i,
    replies: {
      en: ['Good morning', 'Morning', 'Hi'],
      hi: ['Good morning', 'Namaste', 'Hi'],
      es: ['Buenos días', 'Hola', 'Igualmente'],
    },
  },
  {
    test: /\b(good\s*afternoon|good\s*evening|शुभ संध्या)\b/i,
    replies: {
      en: ['You too', 'Hi', 'Hello'],
      hi: ['Waise hi', 'Namaste', 'Hi'],
    },
  },
  {
    test:
      /\b(thank(?:s| you)|thx|ty\b|appreciate|धन्यवाद|शुक्रिया|धन्यवाद्|gracias|merci|danke|obrigad[oa]|شكرا|ありがとう|谢谢|感谢)\b/i,
    replies: {
      en: ["You're welcome", 'No problem', 'Anytime'],
      hi: ['Welcome', 'Koi baat nahi', 'Anytime'],
      es: ['De nada', 'No hay de qué', 'Con gusto'],
      fr: ['De rien', 'Avec plaisir', 'Pas de souci'],
      de: ['Gern geschehen', 'Kein Problem', 'Bitte'],
      pt: ['De nada', 'Disponha', 'Imagina'],
      ar: ['عفواً', 'لا شكر على واجب', 'العفو'],
      ja: ['どういたしまして', 'いいえ', 'こちらこそ'],
      zh: ['不客气', '没事', '应该做的'],
    },
  },
  {
    test: /\b(sorry|apologize|my bad|माफ|क्षमा|maaf|perd[oó]n|désolé|entschuldigung)\b/i,
    replies: {
      en: ['No worries', "It's okay", 'All good'],
      hi: ['Koi baat nahi', 'Theek hai', 'All good'],
      es: ['No pasa nada', 'Tranquilo', 'Está bien'],
      fr: ["Pas de souci", 'Ça va', 'Aucun problème'],
    },
  },
  {
    test:
      /\b(how are you|how'?s it going|how have you been|how r u|are you (?:doing )?(?:alright|okay|ok|fine)|doing (?:alright|okay|ok|fine))\b|(?:kaise ho|kaisa hai|kya haal|theek ho|aap kaise|sab theek|kya chal raha)\b|(?:कैसे हो|कैसे हैं|क्या हाल|ठीक हो)|(?:cómo estás|como estas|qué tal)|(?:comment (?:ça va|allez-vous))|(?:wie geht|wie geht's)|(?:tudo bem|como vai)|(?:كيف حالك|كيفك)|(?:元気|お元気)|(?:你好吗|怎么样)/i,
    replies: {
      en: ["I'm good", 'Doing well', 'All good, thanks'],
      hi: ['Main theek hoon', 'Badhiya', 'Sab theek, thanks'],
      es: ['Bien, gracias', 'Todo bien', 'Muy bien'],
      fr: ['Ça va bien', 'Très bien', 'Bien, merci'],
      de: ['Gut, danke', 'Alles gut', 'Mir geht’s gut'],
      pt: ['Tudo bem', 'Bem, obrigado', 'Ótimo'],
      ar: ['بخير، شكراً', 'الحمد لله', 'تمام'],
      ja: ['元気です', '大丈夫です', 'ありがとう'],
      zh: ['挺好的', '还好', '谢谢关心'],
    },
  },
  {
    test:
      /\b(status|project|progress|update|deadline|timeline|on track)\b|(?:kya status|status kya|project ka|update kab)|(?:estado|proyecto|avance)|(?:état|projet)|(?:stand|projekt)|(?:وضع|مشروع)/i,
    replies: {
      en: ['On track', 'Will update you', 'Let me check'],
      hi: ['On track', 'Update deta hoon', 'Check karke batata hoon'],
      es: ['En marcha', 'Te actualizo', 'Déjame revisar'],
      fr: ['En bonne voie', 'Je vous tiens au courant', 'Je vérifie'],
    },
  },
  {
    test: /\b(see you|bye|cya|talk soon|catch you|alvida|अलविदा|adiós|au revoir|tschüss|tchau|مع السلامة|またね|再见)\b/i,
    replies: {
      en: ['Bye', 'See you', 'Take care'],
      hi: ['Bye', 'Milte hain', 'Take care'],
      es: ['Adiós', 'Nos vemos', 'Cuídate'],
      fr: ['Au revoir', 'À bientôt', 'Bonne journée'],
    },
  },
  {
    test: /\b(welcome|glad to have you|स्वागत)\b/i,
    replies: {
      en: ['Thanks', 'Thank you', 'Happy to be here'],
      hi: ['Thanks', 'Khushi hui', 'Thank you'],
    },
  },
  {
    test: /\b(okay|ok\b|sounds good|got it|perfect|makes sense|will do|theek|ठीक)\b/i,
    replies: {
      en: ['Sounds good', 'Thanks', 'Great'],
      hi: ['Theek hai', 'Thanks', 'Great'],
    },
  },
  {
    test: /^(hi|hey|hello|hola|bonjour|hallo|ola|olá|नमस्ते|नमस्कार|مرحبا|こんにちは|你好)\b|\b(nice to meet)\b/i,
    replies: {
      en: ['Hi', 'Hey', 'Hello'],
      hi: ['Hi', 'Namaste', 'Hello'],
      es: ['Hola', 'Qué tal', 'Buenas'],
      fr: ['Salut', 'Bonjour', 'Coucou'],
      de: ['Hallo', 'Hi', 'Guten Tag'],
      pt: ['Oi', 'Olá', 'Tudo bem'],
      ar: ['مرحبا', 'أهلاً', 'مرحباً بك'],
      ja: ['こんにちは', 'やあ', 'どうも'],
      zh: ['你好', '嗨', '您好'],
    },
  },
  {
    test: /\b(please|can you|could you|would you|kindly|कृपया|por favor|s'il vous plaît|bitte|por favor)\b/i,
    replies: {
      en: ['Sure', 'On it', 'Will do'],
      hi: ['Sure', 'Karta hoon', 'Will do'],
      es: ['Claro', 'En eso estoy', 'Hecho'],
      fr: ['Bien sûr', "Je m'en occupe", 'Entendu'],
    },
  },
  {
    test: /\b(lunch|coffee|meet|call|meeting)\b.*\?|\?.*\b(lunch|coffee|meet|call|meeting)\b/i,
    replies: {
      en: ['Yes', 'Sounds good', 'What time?'],
      hi: ['Haan', 'Theek hai', 'Kitne baje?'],
      es: ['Sí', 'Me parece bien', '¿A qué hora?'],
    },
  },
  {
    test: /\?\s*$/u,
    replies: {}, // filled via QUESTION_FALLBACK + locale
  },
];

const QUESTION_HINT =
  /\?|(?:\b(what|when|where|who|why|how|which|can|could|would|will|is|are|do|does|did)\b)|(?:\b(kya|kab|kahan|kaun|kyun|kaise)\b)|(?:[¿?])|(?:吗|呢|か)\s*$/u;

const MEDIA_PREVIEW =
  /^(📷|📎|🎤|🎬|📊|📄|🖼|photo|image|file|attachment|voice message|document|video|audio|poll|पोल|फ़ाइल)/iu;

function normalizeInput(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim();
}

function detectLocale(text: string): ReplyLocale {
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi';
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }
  if (/[\u3040-\u30FF]/.test(text)) {
    return 'ja';
  }
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return 'zh';
  }
  if (/(?:¿|¡|\b(hola|gracias|buenos|cómo|como|estás|estas|vale|sí|si)\b)/iu.test(text)) {
    return 'es';
  }
  if (/(?:\b(bonjour|merci|salut|comment|ça va|oui)\b)/iu.test(text)) {
    return 'fr';
  }
  if (/(?:\b(hallo|danke|bitte|wie geht)\b)/iu.test(text)) {
    return 'de';
  }
  if (/(?:\b(olá|ola|obrigad|tudo bem|você|voce)\b)/iu.test(text)) {
    return 'pt';
  }
  if (
    /(?:\b(kaise|kya|nahi|haan|theek|aap|main|ho|hai|hoon|chahiye|kab|kahan)\b)/iu.test(text)
  ) {
    return 'hi';
  }
  return 'en';
}

function resolveReplies(rule: SuggestionRule, locale: ReplyLocale): string[] {
  if (rule.test.source.includes('\\?')) {
    return QUESTION_FALLBACK[locale];
  }
  const localized = rule.replies[locale];
  if (localized && localized.length > 0) {
    return localized.slice(0, 3);
  }
  const english = rule.replies.en;
  if (english && english.length > 0) {
    return english.slice(0, 3);
  }
  const first = Object.values(rule.replies).find((items) => items && items.length > 0);
  return first ? first.slice(0, 3) : FALLBACK[locale];
}

export function readQuickReplySourceText(
  message: Pick<
    MessageItem,
    'content' | 'media' | 'messageType' | 'deletedForEveryone' | 'poll' | 'isOwn'
  >,
): string {
  if (message.isOwn) {
    return '';
  }

  const normalized = {
    ...message,
    content: message.content ?? '',
    media: message.media ?? [],
  };

  if (isDeletedMessage(normalized)) {
    return '';
  }

  return formatMessagePreview(normalized).trim() || normalized.content.trim();
}

/** Local quick-reply chips (no AI API). Returns up to 3 short options. */
export function buildQuickReplySuggestions(messageText: string): string[] {
  const normalized = normalizeInput(messageText);

  if (!normalized) {
    return [];
  }

  const locale = detectLocale(normalized);

  if (MEDIA_PREVIEW.test(normalized)) {
    return MEDIA_ACK[locale];
  }

  for (const rule of RULES) {
    if (rule.test.test(normalized)) {
      return resolveReplies(rule, locale);
    }
  }

  if (QUESTION_HINT.test(normalized)) {
    return QUESTION_FALLBACK[locale];
  }

  if (normalized.length <= 320) {
    return FALLBACK[locale];
  }

  return FALLBACK[locale];
}