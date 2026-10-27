const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../sentence-core.js');
const word = (value, category = 'verb', lesson = 'b1-l1') => ({ key: `word:${lesson}:${encodeURIComponent(value)}`, aliases: [], category, word: value, label: value, meaning: '中文释义' });
const phrase = value => ({ key: `phrase:b1-l1:${encodeURIComponent(value)}`, aliases: [], category: 'phrase', phrase: value, label: value, meaning: '中文用法' });
const verbs = ['investigate', 'negotiate', 'persuade', 'accomplish'].map(value => word(value));
const phrases = ['take into account', 'put up with', 'come up with', 'make a decision', 'pay attention to'].map(phrase);
const labels = result => result.map(item => item.label);
const recommend = options => core.recommendOldWords({ profile: 'phrases-verbs', random: () => 0.999, count: 4, ...options });
const answers = extra => ({ affirmative: 'I use newword today.', negative: 'She does not use newword.', yesno: 'Do you use newword?', wh: 'Where do they use newword?', combined: `We use newword ${extra}.` });
const draft = (keys, extra, at = 10) => ({ targetKey: 'word:b1-l2:newword', selectedOldKeys: keys, answers: answers(extra), checkedAt: at });

test('focused profile excludes introductory words, inflections, names and unrelated categories', () => {
  assert.equal(typeof core.recommendationEligible, 'function');
  for (const value of ['be', 'IS', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'did', 'done', 'doing', 'go', 'goes', 'went', 'gone', 'going', 'come', 'came', 'coming', 'get', 'got', 'getting', 'make', 'made', 'making', 'read', 'reads', 'reading', 'write', 'wrote', 'written', 'writing']) {
    assert.equal(core.recommendationEligible(word(value)), false, value);
  }
  for (const item of [word('book', 'noun'), word('beautiful', 'adjective'), word('carefully', 'adverb'), word('Sandra', 'word'), word('investigation', 'noun')]) assert.equal(core.recommendationEligible(item), false, item.label);
  assert.deepEqual(recommend({ items: [word('book', 'noun'), word('go'), word('went'), phrase('thank you')] }), []);
});

test('simple phrase templates and inflected introductory phrases remain excluded', () => {
  for (const value of ['look at', 'Look at sb.', 'looked at something', 'at home', 'thank you', 'good morning', 'get up', 'got up', 'be able to do something', 'was able to do sth.']) {
    assert.equal(core.recommendationEligible(phrase(value)), false, value);
  }
});

test('auxiliaries, negative contractions and additional introductory verb forms are not recommendations', () => {
  for (const value of ['can', 'could', 'May', 'might', 'must', 'shall', 'should', 'will', 'would', "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't", "can't", 'cannot', "couldn't", "won't", "wouldn't", "shouldn't", "mustn't", "needn't", "CAN’T", 'fly', 'flies', 'flew', 'flown', 'flying', 'begin', 'begins', 'began', 'begun', 'beginning', 'turn', 'turns', 'turned', 'turning', 'arrive', 'arrives', 'arrived', 'arriving', 'show', 'shows', 'showed', 'shown', 'showing']) {
    assert.equal(core.recommendationEligible(word(value)), false, value);
    assert.equal(core.recommendationEligible(phrase(value)), false, `misclassified single-word phrase: ${value}`);
  }
});

test('verified source-name homographs are excluded without suppressing lower-case or other capitalized verbs', () => {
  for (const value of ['Bob', 'Mike', 'Peter', 'Harry', 'Dement']) {
    assert.equal(core.recommendationEligible(word(value)), false, value);
    assert.equal(core.recommendationEligible(word(value.toLowerCase())), true, `genuine lower-case verb: ${value.toLowerCase()}`);
    assert.equal(core.recommendationEligible({ ...word(value.toLowerCase()), label: value }), false, `source name label: ${value}`);
  }
  for (const value of ['Excuse', 'Mutilated', 'Gesticulating']) assert.equal(core.recommendationEligible(word(value)), true, `genuine capitalized verb: ${value}`);
});

for (const [item, label] of [[phrase('next weekend'), 'next weekend'], [word('phoned'), 'phoned'], [phrase('paid for'), 'paid for']]) {
  test(`observed mobile introductory suggestion ${label} is ineligible`, () => {
    assert.equal(core.recommendationEligible(item), false);
  });
}

test('remaining observed introductory verb families and source phrases stay out of focused recommendations', () => {
  for (const value of ['catch', 'caught', 'shut', 'shutting', 'dust', 'dusted', 'sweep', 'swept', 'climb', 'climbed', 'type', 'typing', 'paint', 'painted', 'drop', 'dropped', 'shine', 'shone', 'rise', 'risen', 'remember', 'remembered', 'enjoy', 'Enjoy', 'spend', 'spent', 'phone', 'phoning', 'telephone', 'telephoned', 'understand', 'understood', 'stay', 'stayed', 'believe', 'believed', 'decide', 'deciding', 'move', 'moved', 'miss', 'missed', 'fall', 'fallen', 'hope', 'hoping', 'hate', 'hating', 'knock', 'knocked', 'invite', 'invited', 'throw', 'thrown', 'count', 'counted', 'ring', 'rung', 'repeat', 'repeated', 'visit', 'visited', 'grow', 'grown', 'laugh', 'laughed', 'smile', 'smiled', 'jump', 'jumped', 'die', 'dying', 'bark', 'barked', 'rest', 'rested', 'slow', 'slowed', 'check', 'checked', 'post', 'posted', 'plan', 'planned', 'finish', 'finished', 'forget', 'forgotten', 'choose', 'chosen', 'break', 'broken', 'cut', 'cutting', 'push', 'pushed', 'carry', 'carried', 'change', 'changed']) assert.equal(core.recommendationEligible(word(value)), false, value);
  for (const value of ['come again', 'at the moment', 'come back', 'go to the theatre', 'turn round', 'in the end', 'have a good seat', 'get angry', 'take a seat', 'just then', 'until lunchtime', 'on the last day', 'once a month', 'ask for', 'pocket money', 'win a prize', 'make a path', 'build a bridge', 'be made in', 'play jazz', 'get a good salary', 'send a postcard', 'musical instruments', 'have plenty of time', 'be away', 'sail from', 'at present', 'as usual', 'on the way', 'pay for', 'in a few minutes', 'say goodbye to', 'pay the bill', 'have a letter from', 'all the time', 'know the way to', 'be interested in', 'have a good meal', 'plan to', 'look like', 'for a while', 'for a moment', 'go to church', 'at the entrance of']) assert.equal(core.recommendationEligible(phrase(value)), false, value);
});

test('literal elementary time expressions are excluded while nonliteral idioms remain available', () => {
  for (const value of ['next day', 'next week', 'next weekend', 'last month', 'this year', 'every day', 'every week', 'every weekend', 'every month', 'every year']) assert.equal(core.recommendationEligible(phrase(value)), false, value);
  for (const value of ['once in a blue moon', 'from time to time', 'against the clock']) assert.equal(core.recommendationEligible(phrase(value)), true, value);
});

test('valuable phrases with simple component verbs and useful verbs remain eligible', () => {
  for (const item of [...verbs, ...phrases, phrase('cling to sb./sth.'), phrase('look up to somebody'), phrase('take something into account'), phrase('on the house'), phrase('a large crowd of')]) assert.equal(core.recommendationEligible(item), true, item.label);
});

test('real introductory source-bank phrases cannot survive as supposedly useful recommendations', () => {
  for (const value of [
    'on the right', 'on the left', 'all right', 'make the bed', 'in front of', 'a bar of', 'a bottle of', 'a piece of', 'a cup of',
    'come from', 'have a conversation', 'at noon', 'on foot', 'by car', 'in bed', 'have a headache', 'have a cold', 'take some medicine',
    'on Sundays', 'on Mondays', 'on Tuesdays', 'on Wednesdays', 'on Thursdays', 'on Fridays', 'on Saturdays',
    'a quarter to', 'half past', 'in the country', 'the day before yesterday', 'be careful', 'at first', 'at the door', 'all day',
    'have been to', 'have gone to', 'on holiday', 'try to', 'what about', 'for sale', 'have done', 'move to', 'the day after tomorrow',
    'fly to', 'leave for', 'hurry up', 'at once', 'for a long time', 'write to', 'think about', 'a little', 'get off', 'get on', 'get out of',
    'knock at the door', 'at the station', 'go back', 'last summer', 'work for', 'have to', 'take a taxi', 'look out of', 'a long time ago',
    'wave to', 'go abroad', 'live abroad', 'look after', 'begin to', 'swimming pool', 'be late for', 'decide to', 'go for a walk', 'for a walk',
    'have', 'are', 'write'
  ]) assert.equal(core.recommendationEligible(phrase(value)), false, value);
});

test('focused profile defaults to three phrases and one verb without changing the manual source bank', () => {
  const items = [word('book', 'noun'), word('go'), ...verbs, phrase('at home'), ...phrases];
  const original = JSON.stringify(items);
  assert.deepEqual(labels(recommend({ items })), ['take into account', 'put up with', 'come up with', 'investigate']);
  assert.equal(JSON.stringify(items), original);
  assert.deepEqual(labels(core.recommendOldWords({ items: [word('book', 'noun'), word('go'), phrase('at home')], random: () => 0.999 })), ['at home', 'book', 'go']);
});

test('short and single-category pools fill only from eligible phrases or verbs', () => {
  assert.deepEqual(labels(recommend({ items: [phrases[0], ...verbs, word('book', 'noun')] })), ['take into account', 'investigate', 'negotiate', 'persuade']);
  assert.deepEqual(labels(recommend({ items: phrases })), labels(phrases.slice(0, 4)));
  assert.deepEqual(labels(recommend({ items: verbs })), labels(verbs));
  assert.deepEqual(labels(recommend({ items: [word('go'), phrase('at home'), phrases[0], verbs[0]] })), ['take into account', 'investigate']);
  assert.deepEqual(labels(recommend({ items: [...verbs, ...phrases], count: 1 })), ['take into account']);
});

test('checked actual use rotates eligible expressions without filling unused gaps with consumed or basic items', () => {
  const used = draft([phrases[0].key, verbs[0].key], 'and investigate what to take into account');
  const result = recommend({ items: [phrases[0], verbs[0], phrases[1], word('go'), word('book', 'noun')], drafts: [used] });
  assert.deepEqual(labels(result), ['put up with']);
  for (const unchecked of [{ ...used, checkedAt: 0 }, { ...used, answers: { affirmative: used.answers.affirmative } }]) {
    assert.deepEqual(labels(recommend({ items: [phrases[0], verbs[0]], drafts: [unchecked] })), ['take into account', 'investigate']);
  }
  const shown = { ...used, selectedOldKeys: [], recommendedOldKeys: used.selectedOldKeys };
  assert.deepEqual(labels(recommend({ items: [phrases[0], verbs[0], phrases[1]], drafts: [shown] })), ['put up with']);
});

test('eligible verb represents merged noun aliases and checked noun-source use still consumes it', () => {
  const noun = word('record', 'noun'), verb = word('record', 'verb', 'b1-l2');
  const items = [noun, verb, verbs[0]];
  const result = recommend({ items });
  assert.deepEqual(labels(result), ['record', 'investigate']);
  assert.equal(result[0], verb);
  assert.deepEqual(labels(recommend({ items, drafts: [draft([noun.key], 'and record the evidence')] })), ['investigate']);
  assert.deepEqual(noun.aliases, []);
  assert.deepEqual(verb.aliases, []);
});

test('manual refresh prefers a completely different eligible set over forcing the default category ratio', () => {
  assert.deepEqual(labels(recommend({ items: [...phrases, ...verbs], previousKeys: [phrases[0].key, phrases[1].key, phrases[2].key, verbs[0].key] })), ['make a decision', 'pay attention to', 'negotiate', 'persuade']);
  assert.deepEqual(labels(recommend({ items: [phrases[0], phrases[1], verbs[0], verbs[1]], previousKeys: [phrases[0].key, verbs[0].key] })), ['put up with', 'negotiate', 'take into account', 'investigate']);
});

test('exhausted focused pools retain least-recent-use within the preferred categories', () => {
  const items = [phrases[0], verbs[0], verbs[1]];
  const drafts = [draft([phrases[0].key], 'and take into account the news', 30), draft([verbs[0].key], 'and investigate the news', 10), draft([verbs[1].key], 'and negotiate the terms', 20)];
  assert.deepEqual(labels(recommend({ items, drafts, count: 2 })), ['take into account', 'investigate']);
});

test('eligibility and focused recommendation keep malformed data inert and never mutate frozen input', () => {
  const trap = () => { throw new Error('Do not invoke imported getter'); };
  const categoryGetter = Object.defineProperty({ word: 'investigate' }, 'category', { get: trap });
  const expressionGetter = Object.defineProperty({ category: 'verb' }, 'word', { get: trap });
  for (const value of [undefined, null, false, [], {}, Object.create(verbs[0]), categoryGetter, expressionGetter, { category: 'verb', word: {} }]) assert.equal(core.recommendationEligible(value), false);
  const metadataGetters = Object.defineProperties({ category: 'verb', word: 'investigate' }, { meaning: { get: trap }, label: { get: trap } });
  assert.equal(core.recommendationEligible(metadataGetters), true);
  const items = Object.freeze([...verbs, ...phrases].map(item => Object.freeze({ ...item, aliases: Object.freeze([]) })));
  const snapshot = JSON.stringify(items);
  assert.equal(recommend({ items }).length, 4);
  assert.equal(JSON.stringify(items), snapshot);
  assert.deepEqual(recommend({ items: [categoryGetter, expressionGetter, null] }), []);
  assert.deepEqual(labels(core.recommendOldWords(Object.assign(Object.create({ profile: 'phrases-verbs' }), { items: [word('book', 'noun')] }))), ['book']);
});

test('recommendation profile marker sanitizes independently without changing existing checked practice', () => {
  const input = { ...draft([verbs[0].key], 'and investigate the evidence'), recommendationProfile: 'phrases-verbs-v1', recommendedOldKeys: [phrases[0].key] };
  const clean = core.sanitizeDraft(input);
  assert.equal(clean.recommendationProfile, 'phrases-verbs-v1');
  assert.equal(clean.checkedAt, 10);
  assert.deepEqual(clean.answers, input.answers);
  assert.deepEqual(clean.selectedOldKeys, input.selectedOldKeys);
  assert.deepEqual(clean.recommendedOldKeys, input.recommendedOldKeys);
  for (const marker of [undefined, null, false, 1, {}, 'phrases-verbs', ' phrases-verbs-v1 ', 'PHRASES-VERBS-V1']) {
    const invalid = core.sanitizeDraft({ ...input, recommendationProfile: marker });
    assert.equal(invalid.recommendationProfile, '');
    assert.equal(invalid.checkedAt, 10);
    assert.deepEqual(invalid.answers, input.answers);
  }
  assert.equal(core.sanitizeDraft(null).recommendationProfile, '');
  assert.equal(core.sanitizeDraft(Object.create({ recommendationProfile: 'phrases-verbs-v1' })).recommendationProfile, '');
  const trap = Object.defineProperty({ ...input }, 'recommendationProfile', { get() { throw Error('Do not read imported profile getter'); } });
  assert.equal(core.sanitizeDraft(trap).recommendationProfile, '');
});
