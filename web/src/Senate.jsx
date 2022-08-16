import { useEffect, useState } from "react";
import {
  sequence,
  setStateHandler,
  setStateFormHandler,
} from './lib';

function isValidBallot(method, votes) {
  function numberedCorrectly(n) {
    for (let expected = 1; expected <= n; expected++) {
      if (!votes.find(([_, vote]) => (+vote) === expected)) return false;
    }
    return true;
  }

  switch (method) {
    case 'atl': return numberedCorrectly(6);
    case 'btl': return numberedCorrectly(12);
    default: return false;
  }
}

export default function Senate() {
  const [data, setData] = useState([]);
  const [state, setState] = useState();
  const [method, setMethod] = useState();
  const [votes, setVotes] = useState([]);

  useEffect(() => {
    if (!data.length) {
      (async function () {
        const resp = await fetch('./data/senate.json');
        const json = await resp.json();
        setData(json);
      }());
    }
  });

  const { vacancies, papers, quota, tickets, events } =
    data
      .find(stateResults => stateResults.state === state)
    || { tickets: [], events: [] };
  
  const validBallot = isValidBallot(method, votes);

  return <>
    <header>
      <h1>Senate</h1>
    </header>
    <main>
      <section>
        <p>
          Begin by selecting your state.
        </p>
        <label htmlFor="state">My state: </label>
        <select
          name="state" value={state} defaultValue={""}
          onChange={sequence(setStateHandler(setState), _ => setMethod(), _ => setVotes([]))}
        >
          <option value="" disabled>Select a state</option>
          {
            data
              ? data.map(({ state }) => <option key={state} value={state}>{state}</option>)
              : null
          }
        </select>
      </section>
      <section className={state ? '' : 'hidden'}>
        <p>
          There are two valid ways to vote in a Senate election: above the line
          (for parties or groups) or below the line (for individual
          candidates). Please start by selecting a voting method.
        </p>
        <fieldset key={`methods-for-${state}`} onChange={setStateHandler(setMethod)}>
          <legend>Voting method:</legend>
          <label htmlFor="atl"><input type="radio" id="atl" name="method" value="atl" /> Above the line</label>
          <label htmlFor="btl"><input type="radio" id="btl" name="method" value="btl" /> Below the line</label>
        </fieldset>
      </section>
      <section className={method === 'atl' ? '' : 'hidden'}>
        <form key={`votes-for-${state}-${method}`} className="ballot" onChange={setStateFormHandler(setVotes)}>
          <p><b>
            Number at least 6 boxes of these boxes in the order of your choice
            (with number 1 as your first choice)
          </b></p>
          {
            tickets
              .filter(({ id }) => id !== 'UG')
              .map(({ id, ticket, candidates }) => <fieldset key={`f-${id}`}>
                <input
                  type="number" name={id}
                  min="1" max={tickets.length} step="1"
                />
                <label htmlFor={id}> {ticket || 'Untitled'}</label>
                <p>
                  {
                    candidates.map(({ name }) => name).join('; ')
                  }
                </p>
              </fieldset>)
          }
        </form>
      </section>
      <section className={method === 'btl' ? '' : 'hidden'}>
        <form key={`votes-for-${state}-${method}`} className="ballot" onChange={setStateFormHandler(setVotes)}>
          <p><b>
            Number at least 12 boxes of these boxes in the order of your choice
            (with number 1 as your first choice)
          </b></p>
          {
            tickets
              .map(({ id, ticket, candidates }) => <fieldset key={`f-${id}`}>
                <legend>{ticket || 'Untitled'}</legend>
                {
                  candidates.map(({ name, position }) => <div key={`c-${position}`}>
                    <input
                      type="number" name={position}
                      min="1" step="1"
                    />
                    <label htmlFor={position}> {name}</label>
                  </div>)
                }
              </fieldset>)
          }
        </form>
      </section>
      <section className={validBallot ? '' : 'hidden'}>
        <Results {...{ validBallot, state, method, votes, vacancies, papers, quota, tickets, events }} />
      </section>
    </main>
  </>;
}

function Results({ validBallot, state, method,
  votes, vacancies, papers, quota, tickets, events }) {
  if (!validBallot) return null;
  const voteIds = [...votes]
    .filter(([_, p]) => p !== '')
    .sort(([_, p1], [__, p2]) => (+p1) - (+p2));

  const candidates = tickets.flatMap(({ candidates }) => candidates);

  let currentPref = 0;
  const elected = new Set();
  const excluded = new Set();

  const preferences = method === 'atl'
    ? voteIds.flatMap(([ticket, _]) => tickets.find(({ id }) => id === ticket).candidates)
    : voteIds.map(([candidate, _]) => candidates.find(({ position }) => position === (+candidate)));

  const importantEvents = [
    <li key="initial">
      Your first preference was <b>{preferences[currentPref].displayName}</b>
    </li>
  ];

  let batch = [];

  const helped = [];

  for (const event of events) {
    switch (event.type) {
      case 'elected':
        elected.add(event.position);
        batch = [];
        if (event.surplus >= 0) {
          importantEvents.push(<li key={`elected-${event.position}`}>
            <b>{event.displayName}</b> was elected with {
            event.votes.toLocaleString()} votes (from {
            event.papers.toLocaleString()} ballots), with a quota of {
            event.quota.toLocaleString()} and a surplus of {
            event.surplus.toLocaleString()}. All ballots will be transferred to
            their next preferred candidate with a transfer value of {
            (event.transferValue*100).toFixed(2)}%
          </li>);
        } else {
          importantEvents.push(<li key={`elected-${event.position}`}>
            <b>{event.displayName}</b> was elected to one of the remaining
            vacancies with {event.votes.toLocaleString()} votes (from {
            event.papers.toLocaleString()} ballots), below the quota of {
            event.quota.toLocaleString()} with a deficit of {
            (-event.surplus).toLocaleString()}
          </li>);
        }
        if (currentPref < preferences.length && event.position === preferences[currentPref].position) {
          helped.push(event);
          if (elected.size < vacancies) {
            currentPref++;
            let wasExcluded;
            while (currentPref < preferences.length && ((wasExcluded = excluded.has(preferences[currentPref].position))
            || elected.has(preferences[currentPref].position))) {
              importantEvents.push(<li key={`skip-${currentPref}`}>
                Your vote skipped over your next preferred candidate, <b>{
                preferences[currentPref].displayName}</b>, who has already been {
                wasExcluded ? 'excluded' : 'elected'}
              </li>);
              currentPref++;
            }
            if (currentPref < preferences.length) {
              importantEvents.push(<li key={`transfer-${event.position}`}>
                Your vote was transferred to your next preferred candidate, <b>{
                preferences[currentPref].displayName}</b>
              </li>);
            } else {
              importantEvents.push(<li key={`transfer-${event.position}`}>
                Your vote was exhausted
              </li>);
            }
          }
        }
        break;
      case 'excluded':
        excluded.add(event.position);
        batch.push(event);
        if (currentPref < preferences.length && event.position === preferences[currentPref].position) {
          batch = [];
          importantEvents.push(<li key={`excluded-${event.position}`}>
            <b>{event.displayName}</b> was excluded with {
            event.votes.toLocaleString()} votes (from {
              event.papers.toLocaleString()} ballots). All of these ballots will
            be transferred to their next preferred candidate
          </li>);
          currentPref++;
          let wasExcluded;
          while (currentPref < preferences.length && ((wasExcluded = excluded.has(preferences[currentPref].position))
          || elected.has(preferences[currentPref].position))) {
            importantEvents.push(<li key={`skip-${currentPref}`}>
              Your vote skipped over your next preferred candidate, <b>{
              preferences[currentPref].displayName}</b>, who has already been {
              wasExcluded ? 'excluded' : 'elected'}
            </li>);
            currentPref++;
          }
          if (currentPref < preferences.length) {
            importantEvents.push(<li key={`transfer-${event.position}`}>
              Your vote was transferred to your next preferred candidate, <b>{
              preferences[currentPref].displayName}</b>
            </li>);
          } else {
            importantEvents.push(<li key={`transfer-${event.position}`}>
              Your vote was exhausted
            </li>);
          }
        }
        else if (batch.length === 1) {
          importantEvents.push(<li key={`excluded-${event.position}`}>
            <b>{event.displayName}</b> was excluded with {
            event.votes.toLocaleString()} votes (from {
            event.papers.toLocaleString()} ballots). All of these ballots will
            be transferred to their next preferred candidate
          </li>);
        }
        else {
          importantEvents.pop();
          const votes = batch.reduce((v, event) => v + event.votes, 0);
          const papers = batch.reduce((v, event) => v + event.papers, 0);
          importantEvents.push(<li key={`excluded-${event.position}`}>
            {batch.length} candidates were excluded with {
            votes.toLocaleString()} votes (from {
            papers.toLocaleString()} ballots). All of these ballots will be
            transferred to their next preferred candidate
          </li>);
        }
        break;
      default:
        break;
    }
  }

  const electedEvents = [];

  if (helped.length) {
    let lastTransfer = 1;
    for (const event of helped) {
      const position = preferences.findIndex(({ position }) => position === event.position) + 1
      electedEvents.push(<li key={`helped-${event.position}`}>
        {((lastTransfer - event.transferValue) * 100).toFixed(2)}% of your ballot
        helped <b>{event.displayName}</b> (your position <b>{position}</b>) get
        elected
      </li>);
      lastTransfer = event.transferValue;
    }
    electedEvents.push(<li key='bwa-bwam'>
      The remaining {(lastTransfer*100).toFixed(2)}% of your ballot was
      exhausted
    </li>);
  }
  else {
    electedEvents.push(<li key='bwa-bwam'>
      Your ballot did not help any candidate get elected
    </li>);
  }

  return <>
    <p>
      The short version:
    </p>
    <ol className="events">{electedEvents}</ol>
    <p>
      The long version:
    </p>
    <p>
      The Senate ballot counting process is extremely complicated. {state
      } had {vacancies} vacant Senate positions at the election and {
      papers.toLocaleString()} formal ballots were cast. To determine the quota
      of votes required to be elected, you compute {
      papers.toLocaleString()}/({vacancies}+1)+1 to get {quota.toLocaleString()}.
    </p>
    <p>
      Ballots are initially counted towards the first preference listed. Note
      that voting above the line is equivalent to voting below the line for
      each candidate in the group in the order they are listed.
    </p>
    <p>
      At the end of each round of counting, any candidate who reaches the quota
      is elected. Some candidates receive a "surplus" of votes which should be
      transferred to the next preferred candidate to avoid wasted votes.
      However, it's not fair to say which individual ballot papers should be
      counted towards the candidate and which were "surplus" that should be
      transferred, because picking and choosing which ballots flow via
      preferences could determine the election of subsequent candidates.
      Instead, all ballots are transferred to their next preference but the
      value of each ballot is scaled down such that the total amount of voting
      power transferred is just the surplus.
    </p>
    <p>
      If a ballot runs out of preferences, it is exhausted and can no longer be
      transferred.
    </p>
    <p>
      If at the end of a round of counting there are no candidates who reach
      the quota, the candidate with the lowest number of votes is excluded and
      their ballots are transferred to their next preference. Some of these
      ballots will be first preferences (which have never been transferred
      before), and will get transferred at full value. Others will have been
      transferred from other candidates who were elected and had their surplus
      transferred, and will get transferred at the same value again.
    </p>
    <p>
      If the number of remaining candidates reduces to the number of remaining
      vacancies, all of those candidates are elected even if they are still
      below the quota. Otherwise, counting stops when all vacancies are filled.
    </p>
    <p>
      This is how your vote was counted.
    </p>
    <ol className="events">{importantEvents}</ol>
  </>;
}