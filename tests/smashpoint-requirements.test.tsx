import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { useTournamentStore } from '../src/features/tournaments/store/tournamentStore.ts';
import { useAuthStore } from '../src/store/authStore.ts';
import { default as PlayerPage } from '../src/features/player/pages/PlayerTournamentListPage.tsx';
  const category = { id: 'c', name: 'Doubles', eventType: 'DOUBLES', registrationPhase: 'OPEN' };
  const base = { organizerId: 'owner', status: 'PUBLISHED', tournamentDate: '2026-09-30', categories: [category] };
  const tournaments = [
    { ...base, id: 'old', name: 'Older tournament', createdAt: '2026-09-01' },
    { ...base, id: 'invalid', name: 'Unknown date tournament', createdAt: 'invalid' },
    { ...base, id: 'new', name: 'Newest tournament', createdAt: '2026-09-12', categories: [{ ...category, registrationPhase: 'CLOSED' }] },
  ];
  useTournamentStore.setState({ tournaments, tournament: tournaments[0], loading: false, error: null });
  useAuthStore.setState({ user: { id: 'owner', role: 'ORGANIZER' } });
  Object.assign(useTournamentStore.getInitialState(), useTournamentStore.getState());
  Object.assign(useAuthStore.getInitialState(), useAuthStore.getState());
  const playerHTML = () => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(PlayerPage)));
  for (let refresh = 0; refresh < 2; refresh++) {
    const html = playerHTML();
    assert.doesNotMatch(html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0] ?? '', /checked/);
    assert.doesNotMatch(html, /Newest tournament/);
    assert.ok(html.indexOf('Older tournament') < html.indexOf('Unknown date tournament'));
    assert.match(html, /value="OPEN" selected=""/);
  }
  assert.deepEqual(useTournamentStore.getState().tournaments.map(x => x.id), ['old', 'invalid', 'new']);
import { default as FixturePage } from '../src/features/organizer/pages/CategoryFixturePage.tsx';
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/organizer/tournaments/old/categories/c'] },
    React.createElement(Routes, null, React.createElement(Route, { path: '/organizer/tournaments/:tournamentId/categories/:categoryId', element: React.createElement(FixturePage) }))));
import ManagementPage from '../src/features/organizer/pages/TournamentRegistrationsPage.tsx';
  const managementHTML = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/organizer/tournaments/old/registrations'] },
    React.createElement(Routes, null, React.createElement(Route, { path: '/organizer/tournaments/:tournamentId/registrations', element: React.createElement(ManagementPage) }))));
  assert.match(managementHTML, /Close Registration/);
  assert.doesNotMatch(html, /Close Registration|Confirm Close/);
  assert.match(html, /Registration Phase/); assert.match(html, /Generate Fixture/);
import { useOptimisticMatchScore } from '../src/features/matches/hooks/useOptimisticMatchScore.ts';
  let queue;
  function Harness() { queue = useOptimisticMatchScore(); return null; }
  renderToStaticMarkup(React.createElement(Harness));
  for (const winningPoints of [15, 21, 30]) {
    const match = { id: String(winningPoints), status: 'LIVE', winningPoints, participant1Score: winningPoints, participant2Score: 10 };
    let current, submitted = 0;
    const submit = async () => { submitted++; return { ...match, participant1Score: winningPoints + submitted }; };
    const apply = value => { current = value; };
    const fail = message => { throw new Error(message); };
    queue.enqueue(match, 'PARTICIPANT_1', 1, submit, apply, fail);
    queue.enqueue(match, 'PARTICIPANT_1', 1, submit, apply, fail); // rapid click before rerender
    assert.equal(current.participant1Score, winningPoints + 2); assert.equal(current.status, 'LIVE');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(submitted, 2); assert.equal(current.participant1Score, winningPoints + 2); assert.equal(current.status, 'LIVE');

    let decrements = 0;
    const aboveTarget = { ...match, id: `down-${winningPoints}`, participant1Score: winningPoints + 2 };
    queue.enqueue(aboveTarget, 'PARTICIPANT_1', -1, async () => { decrements++; return { ...aboveTarget, participant1Score: winningPoints + 1 }; }, apply, fail);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(decrements, 1); assert.equal(current.participant1Score, winningPoints + 1);
    let zeroSubmits = 0;
    queue.enqueue({ ...aboveTarget, id: `zero-${winningPoints}`, participant1Score: 0 }, 'PARTICIPANT_1', -1, async () => { zeroSubmits++; return aboveTarget; }, apply, fail);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(zeroSubmits, 0);
  }
  console.log('PASS: fixture controls, default filter, immutable createdAt ordering, repeat render and optimistic scoring beyond 15/21/30 targets');
