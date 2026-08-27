type QuantityFact = {
  subject: string;
  value: string;
};

const SUBJECTS: Record<string, string> = {
  spieler: 'Spieler',
  spielern: 'Spieler',
  mannschaft: 'Teams',
  mannschaften: 'Teams',
  team: 'Teams',
  teams: 'Teams',
  kontakt: 'Kontakte',
  kontakte: 'Kontakte',
  kontakten: 'Kontakte',
  meter: 'Meter',
  m: 'Meter',
  markierungsscheibe: 'Markierungsscheiben',
  markierungsscheiben: 'Markierungsscheiben',
  dummy: 'Dummies',
  dummies: 'Dummies',
  hürde: 'Hürden',
  hürden: 'Hürden',
  sprung: 'Sprünge',
  sprünge: 'Sprünge',
  sprüngen: 'Sprünge',
  ball: 'Bälle',
  bälle: 'Bälle',
  bällen: 'Bälle',
  zuspiel: 'Zuspiele',
  zuspiele: 'Zuspiele',
  zuspielen: 'Zuspiele',
  pass: 'Pässe',
  pässe: 'Pässe',
  pässen: 'Pässe',
  tor: 'Tore',
  tore: 'Tore',
  toren: 'Tore',
  großtor: 'Großtore',
  großtore: 'Großtore',
  großtoren: 'Großtore',
  station: 'Stationen',
  stationen: 'Stationen',
  durchgang: 'Durchgänge',
  durchgänge: 'Durchgänge',
  durchgängen: 'Durchgänge',
};

const NUMBER_WORDS: Record<string, string> = {
  beide: '2',
  beiden: '2',
  beides: '2',
  zwei: '2',
  drei: '3',
  vier: '4',
  fünf: '5',
  sechs: '6',
  sieben: '7',
  acht: '8',
  neun: '9',
  zehn: '10',
  elf: '11',
  zwölf: '12',
};

function quantityValue(token: string): string | null {
  if (/^\d+(?:-\d+)?$/.test(token)) return token;
  if (/^\d+er$/.test(token)) return token.slice(0, -2);
  return NUMBER_WORDS[token] ?? null;
}

function quantityTokens(value: string): string[] {
  let normalized = value.toLocaleLowerCase('de-AT');
  Object.entries(NUMBER_WORDS).forEach(([word, number]) => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), number);
  });
  return normalized
    .replace(/(\d+)\s*(?:-|–|—|bis)\s*(\d+)/g, '$1-$2')
    .match(/\d+(?:-\d+)?(?:er)?|[a-zäöüß]+/g) ?? [];
}

/**
 * Extracts explicit quantities together with the noun they describe. Articles
 * such as "ein/eine" and ordinals such as "zweiter" are intentionally ignored.
 */
export function extractQuantityFacts(value: string): QuantityFact[] {
  const tokens = quantityTokens(value);
  const facts: QuantityFact[] = [];

  tokens.forEach((token, index) => {
    const subject = SUBJECTS[token];
    if (!subject) return;

    let quantity: string | null = null;
    for (let offset = 1; offset <= 4 && index - offset >= 0; offset += 1) {
      const nearby = tokens[index - offset];
      if (SUBJECTS[nearby]) break;
      quantity = quantityValue(nearby);
      if (quantity) break;
    }
    if (quantity) facts.push({ subject, value: quantity });
  });

  return facts.filter((fact, index) => (
    facts.findIndex((candidate) => (
      candidate.subject === fact.subject && candidate.value === fact.value
    )) === index
  ));
}

/**
 * Detects explicit numeric contradictions without asking the language model.
 * Omitting an optional quantity is left to semantic fact verification, but a
 * candidate may never attach a different number to a protected subject.
 */
export function numericFactContradictions(source: string, candidate: string): string[] {
  const sourceFacts = extractQuantityFacts(source);
  const candidateFacts = extractQuantityFacts(candidate);
  const sourceBySubject = new Map<string, Set<string>>();

  sourceFacts.forEach(({ subject, value }) => {
    const values = sourceBySubject.get(subject) ?? new Set<string>();
    values.add(value);
    sourceBySubject.set(subject, values);
  });

  return candidateFacts.flatMap(({ subject, value }) => {
    const originalValues = sourceBySubject.get(subject);
    if (!originalValues || originalValues.has(value)) return [];
    return [`Zahlenwiderspruch bei ${subject}: Kurzfassung ${value}, Original ${[...originalValues].join(' oder ')}`];
  });
}
