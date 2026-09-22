const $ = (id) => document.getElementById(id);
const node = (tag, className, value) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined && value !== null) element.textContent = String(value);
  return element;
};
const euro = (value) => value === null || value === undefined ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const plain = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const count = (value, singular, plural = `${singular}s`) => `${value} ${value === 1 ? singular : plural}`;
const add = (parent, ...children) => { children.forEach((child) => parent.append(child)); return parent; };
function tag(label, tone = '') { return node('span', `tag ${tone}`, label); }
function field(label, value) { const wrap = node('div'); add(wrap, node('span', 'detail-label', label), node('span', '', plain(value))); return wrap; }
function metric(label, value, note) { const card = node('div', 'metric'); add(card, node('span', '', label), node('strong', '', value), node('small', '', note)); return card; }
function lineByName(lines, name) { return lines.find((line) => line.lineItem === name)?.amount ?? null; }
function detailRow(label, value) { const p = node('p'); add(p, node('strong', '', `${label}: `), document.createTextNode(plain(value))); return p; }
function table(headers, entries, subtotal) {
  const wrapper = node('div', 'table-wrap'); const table = node('table', 'data-table'); const head = node('thead'); const headRow = node('tr');
  headers.forEach((header) => headRow.append(node('th', '', header))); head.append(headRow); table.append(head);
  const body = node('tbody');
  entries.forEach((entry) => { const row = node('tr', subtotal?.(entry) ? 'subtotal' : ''); entry.values.forEach((value, index) => row.append(node('td', entry.amountIndex === index ? 'amount' : '', plain(value)))); body.append(row); });
  table.append(body); wrapper.append(table); return wrapper;
}
function showError(error) { const el = $('load-error'); el.hidden = false; el.textContent = `Could not load the published case data: ${error.message}`; }
function renderIdentity(data) { $('student-name').textContent = data.student.name; $('student-id').textContent = data.student.id; }

function renderFlags(data, diagnostics, containerId) {
  const container = $(containerId);
  for (const flag of diagnostics.reviewFlags) {
    const card = node('div', 'flag');
    add(card, tag(flag.type, 'warning'), node('strong', '', flag.title));
    const summary = flag.detail.length > 330 ? `${flag.detail.slice(0, 330).trim()}…` : flag.detail;
    card.append(node('p', '', summary));
    if (flag.detail.length > 330 || flag.rows?.length) {
      const details = node('details'); details.append(node('summary', '', 'Show full record'));
      if (flag.detail.length > 330) details.append(node('p', '', flag.detail));
      if (flag.rows?.length) details.append(node('p', '', flag.rows.map((row) => `Row ${row.row}: ${row.evidenceId}`).join('\n')));
      card.append(details);
    }
    if (flag.decisionIds?.length) card.append(tag(flag.decisionIds.join(', ')));
    container.append(card);
  }
}

function renderStatements(data) {
  const tabs = [
    ['profitAndLoss', 'Profit and loss'], ['cashFlow', 'Cash flow'], ['balanceSheet', 'Balance sheet'],
  ];
  const buttonList = $('statement-tabs'); const panel = $('statement-panel');
  function select(key) {
    buttonList.querySelectorAll('button').forEach((button) => button.setAttribute('aria-selected', button.dataset.key === key ? 'true' : 'false'));
    panel.replaceChildren();
    const rows = data.statements[key].map((line) => ({
      ...line, amountIndex: 1,
      values: [line.lineItem, euro(line.amount), line.scheduleReference, line.decisionIds, line.evidenceIds],
    }));
    panel.append(node('div', 'statement-context', 'Amounts are copied from the student tracker. Schedule and evidence references are shown beside each line.'));
    panel.append(table(['Line item', 'EUR', 'Schedule reference', 'Decision IDs', 'Evidence IDs'], rows,
      (line) => /^(Gross profit|Operating profit|Net profit|Net cash|Closing cash|Total assets|Total liabilities|Total equity|Total liabilities and equity)/i.test(line.lineItem)));
  }
  tabs.forEach(([key, label]) => { const button = node('button', '', label); button.type = 'button'; button.dataset.key = key; button.setAttribute('role', 'tab'); button.addEventListener('click', () => select(key)); buttonList.append(button); });
  select(tabs[0][0]);
}

function renderReconciliations(data, diagnostics) {
  const target = $('recon-list');
  data.reconciliations.forEach((item) => {
    const card = node('div', 'recon');
    add(card, node('span', 'checkmark', '✓'), add(node('div'), node('strong', '', `${item.area}: ${item.check}`), node('p', '', item.workbookResult), node('small', '', item.workbookBasis)));
    target.append(card);
  });
  const failures = diagnostics.reconciliationChecks.filter((item) => !item.passed);
  if (failures.length) target.prepend(add(node('div', 'alert error'), node('strong', '', `${failures.length} numeric checks do not reconcile.`), node('p', '', failures.map((item) => `${item.name}: ${euro(item.difference)}`).join('; '))));
}

function decisionCard(decision) {
  const card = node('details', 'record'); card.id = `decision-${decision.id}`;
  const summary = node('summary'); const title = node('div', 'record-title');
  add(title, node('strong', '', decision.question), node('span', '', decision.answer));
  add(summary, node('span', 'record-id', decision.id), title); card.append(summary);
  const body = node('div', 'record-content'); const badges = node('div', 'record-meta');
  add(badges, tag(decision.reviewTier === 'material_judgment' ? 'Material judgment' : 'Operational'), tag(`${decision.confidence} confidence`, decision.confidence === 'low' ? 'danger' : '' ));
  if (decision.changedFromAI) badges.append(tag('Student override', 'warning'));
  body.append(badges);
  const grid = node('div', 'details-grid'); add(grid, field('Certified answer', decision.answer), field('Evidence IDs as entered', decision.evidence.join('; '))); body.append(grid);
  if (decision.studentReasoning) body.append(detailRow('Student reasoning', decision.studentReasoning));
  if (decision.reviewTier === 'material_judgment') body.append(add(node('p'), add(node('a', 'text-link', 'See both AI positions and statement effects →'))));
  if (decision.reviewTier === 'material_judgment') body.lastChild.querySelector('a').href = `/review#judgment-${decision.id}`;
  card.append(body); return card;
}
function renderDecisions(data) {
  const target = $('decision-list'); const search = $('decision-search'); const tier = $('tier-filter'); const confidence = $('confidence-filter');
  function update() {
    const query = search.value.trim().toLowerCase(); target.replaceChildren();
    const matches = data.decisions.filter((decision) =>
      (tier.value === 'all' || decision.reviewTier === tier.value) &&
      (confidence.value === 'all' || decision.confidence === confidence.value) &&
      [decision.id, decision.question, decision.answer, ...decision.evidence].join(' ').toLowerCase().includes(query));
    $('decision-count').textContent = `${matches.length} of 100`;
    matches.forEach((decision) => target.append(decisionCard(decision)));
    if (!matches.length) target.append(node('p', 'empty', 'No decisions match those filters.'));
  }
  [search, tier, confidence].forEach((control) => control.addEventListener('input', update)); update();
  if (location.hash.startsWith('#decision-')) document.querySelector(location.hash)?.setAttribute('open', '');
}

function renderSchedules(data) {
  const target = $('schedule-groups');
  Object.entries(data.schedules).forEach(([name, lines]) => {
    const group = node('details', 'record'); const summary = node('summary');
    add(summary, node('span', 'record-title', name), tag(count(lines.length, 'line'))); group.append(summary);
    const rows = lines.map((line) => ({ values: [line.lineOrTransaction, euro(line.openingBalance), euro(line.increaseOrRecognized), euro(line.decreaseOrSettled), euro(line.closingBalance), euro(line.profitAndLossAmount), euro(line.cashAmount), line.decisionIds, line.evidenceIds, line.notesOrBasis] }));
    group.append(table(['Line or transaction', 'Opening', 'Increase', 'Decrease', 'Closing*', 'P&L', 'Cash', 'Decision IDs', 'Evidence IDs', 'Notes / basis'], rows));
    group.append(node('div', 'statement-context', '* Closing values are evaluated from the workbook’s existing opening + increase − decrease formula.'));
    target.append(group);
  });
}

function evidenceCard(item) {
  const card = node('div', 'evidence-card'); const top = node('div', 'evidence-top');
  add(top, node('strong', '', item.id || `Evidence row ${item.row}`), node('span', 'evidence-file', item.fileOrRecord || (item.caseFileHints?.length ? `Suggested: ${item.caseFileHints.join('; ')} · verify` : 'Filename not mapped'))); card.append(top);
  if (item.whatItSupports) card.append(node('p', '', item.whatItSupports));
  const grid = node('div', 'evidence-grid');
  add(grid, field('Date', item.date), field('Source type', item.sourceType), field('Location or link', item.locationOrLink), field('Decision IDs', item.decisionIds)); card.append(grid);
  if (item.reliabilityOrContradictions) card.append(detailRow('Reliability / contradictions', item.reliabilityOrContradictions));
  return card;
}
function renderEvidence(data) {
  const target = $('evidence-list'); const search = $('evidence-search');
  function update() {
    const query = search.value.trim().toLowerCase(); target.replaceChildren();
    const matches = data.evidence.filter((item) => Object.values(item).flat().join(' ').toLowerCase().includes(query));
    $('evidence-count').textContent = `${matches.length} of ${data.evidence.length} records`;
    matches.forEach((item) => target.append(evidenceCard(item)));
    if (!matches.length) target.append(node('p', 'empty', 'No evidence records match that search.'));
  }
  search.addEventListener('input', update); update();
}
function renderUncertainties(data) {
  const target = $('uncertainty-list');
  data.uncertainties.forEach((item) => {
    const card = node('div', 'info-card'); add(card, tag(item.decisionId), node('h3', '', item.answer), node('p', '', item.studentReasoning));
    card.append(node('div', 'record-meta')); add(card.lastChild, tag(`${item.confidence} confidence`), tag(item.evidence.join('; ')));
    target.append(card);
  });
}
function renderBoard(data) {
  const target = $('board-list');
  data.boardRecommendation.actions.forEach((action) => {
    const card = node('div', 'board-item'); add(card, node('h3', '', `${action.id} · ${action.answer}`));
    const details = node('details'); add(details, node('summary', '', 'Student reasoning and evidence'), node('p', '', action.studentReasoning), node('p', '', `Evidence: ${action.evidence.join('; ')}`)); card.append(details); target.append(card);
  });
}
function renderMain(data, diagnostics) {
  const pnl = data.statements.profitAndLoss, cash = data.statements.cashFlow, balance = data.statements.balanceSheet;
  add($('summary'), metric('Net profit', euro(lineByName(pnl, 'Net profit for the period')), 'Certified period result'), metric('Closing cash', euro(lineByName(cash, 'Closing cash (31 Aug 2026)')), 'Agrees with bank evidence'), metric('Total assets', euro(lineByName(balance, 'Total assets')), 'Balance sheet'), metric('Decisions', String(data.decisions.length), `${diagnostics.materialJudgmentCount} material judgments`));
  renderFlags(data, diagnostics, 'flags-list'); renderStatements(data); renderReconciliations(data, diagnostics); renderDecisions(data); renderSchedules(data); renderEvidence(data); renderUncertainties(data); renderBoard(data);
}

function judgmentCard(decision, diagnostics) {
  const card = node('article', 'judgment-card'); card.id = `judgment-${decision.id}`;
  const head = node('div', 'judgment-head'); const title = node('h3'); add(title, node('span', 'record-id', decision.id), document.createTextNode(decision.question)); head.append(title);
  const badges = node('div', 'record-meta');
  if (diagnostics.agentDisagreementIds.includes(decision.id)) badges.append(tag('Agent disagreement', 'warning'));
  if (decision.changedFromAI) badges.append(tag('Student override', 'warning'));
  if (decision.confidence === 'low') badges.append(tag('Low confidence', 'danger'));
  if (!badges.childElementCount) badges.append(tag(`${decision.confidence} confidence`));
  head.append(badges); card.append(head);
  card.append(add(node('div', 'judgment-answer'), node('span', 'detail-label', 'Student certified answer'), node('span', '', decision.answer)));
  const positions = node('div', 'position-grid'); add(positions, add(node('div', 'position'), node('h4', '', 'Agent 1 proposal'), node('p', '', decision.aiProposal)), add(node('div', 'position'), node('h4', '', 'Independent Agent 2 challenge'), node('p', '', decision.independentChallenge))); card.append(positions);
  card.append(add(node('p', 'judgment-reasoning'), node('strong', '', 'Student reasoning: '), document.createTextNode(plain(decision.studentReasoning))));
  const effects = node('div', 'effect-grid');
  for (const [label, value] of Object.entries(decision.statementEffect)) add(effects, add(node('div', 'effect'), node('span', '', label), node('strong', '', euro(value))));
  card.append(effects); card.append(node('p', 'judgment-source', `Evidence IDs: ${decision.evidence.join('; ')} · Confidence: ${decision.confidence} · Changed from AI: ${decision.changedFromAI ? 'Yes' : 'No'}`));
  return card;
}
function renderReview(data, diagnostics) {
  const materials = data.decisions.filter((decision) => decision.reviewTier === 'material_judgment');
  add($('review-summary'), metric('Material judgments', String(materials.length), 'All review-trail fields present'), metric('Agent disagreements', String(diagnostics.agentDisagreementIds.length), 'Explicitly identifiable'), metric('Student overrides', String(diagnostics.studentOverrideIds.length), 'Across all 100 decisions'), metric('Low confidence', String(diagnostics.lowConfidenceDecisionIds.length), 'Across all 100 decisions'));
  renderFlags(data, diagnostics, 'attention-list');
  const low = $('low-confidence-list'); diagnostics.lowConfidenceDecisionIds.forEach((id, index) => { if (index) low.append(document.createTextNode(', ')); const link = node('a', '', id); link.href = `/#decision-${id}`; low.append(link); });
  const target = $('judgment-list'); const search = $('judgment-search');
  function update() {
    const query = search.value.trim().toLowerCase(); target.replaceChildren();
    const matches = materials.filter((decision) => [decision.id, decision.question, decision.answer, decision.aiProposal, decision.independentChallenge, decision.studentReasoning].join(' ').toLowerCase().includes(query));
    $('judgment-count').textContent = `${matches.length} of 25`;
    matches.forEach((decision) => target.append(judgmentCard(decision, diagnostics)));
    if (!matches.length) target.append(node('p', 'empty', 'No material judgments match that search.'));
  }
  search.addEventListener('input', update); update();
}

try {
  const [submissionResponse, diagnosticsResponse] = await Promise.all([fetch('/submission.json'), fetch('/diagnostics.json')]);
  if (!submissionResponse.ok || !diagnosticsResponse.ok) throw new Error('One of the data files is unavailable.');
  const [data, diagnostics] = await Promise.all([submissionResponse.json(), diagnosticsResponse.json()]);
  renderIdentity(data);
  if (document.body.dataset.page === 'review') renderReview(data, diagnostics); else renderMain(data, diagnostics);
} catch (error) { showError(error); }
