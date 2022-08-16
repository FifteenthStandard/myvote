import { useEffect, useState } from "react";
import {
  sequence,
  setStateHandler,
  setStateFormHandler,
} from './lib';

function isValidBallot(votes) {
  if (votes.length === 0) return false;
  for (let expected = 1; expected <= votes.length; expected++) {
    if (!votes.find(([ _, vote ]) => (+vote) === expected)) return false;
  }
  return true;
}

export default function House() {
  const [data, setData] = useState([]);
  const [division, setDivision] = useState();
  const [votes, setVotes] = useState([]);

  useEffect(() => {
    if (!data.length) {
      (async function () {
        const resp = await fetch('./data/house.json');
        const json = await resp.json();
        setData(json);
      }());
    }
  });

  const { candidates, method, elected, events } =
    data
      .find(divisionResults => divisionResults.division === division)
    || { candidates: [], method: {}, elected: {}, events: [] };

  const validBallot = isValidBallot(votes);

  return <>
    <header>
      <h1>House of Representatives</h1>
    </header>
    <main>
      <section>
        <p>
          Begin by selecting your electorate division. If you are unsure which
          division you reside in, use the <a href="https://electorate.aec.gov.au/"
          >Find my electorate</a> tool provided by the Australian Electoral
          Commission.
        </p>
        <label htmlFor="division">My electorate division: </label>
        <select
          name="division" value={division} defaultValue={""}
          onChange={sequence(setStateHandler(setDivision), _ => setVotes([]))}
        >
          <option value="" disabled>Select a division</option>
          {
            data
              ? data.map(({ division }) =>
                <option key={division} value={division}>{division}</option>)
              : null
          }
        </select>
      </section>
      <section className={division ? '' : 'hidden'}>
        <p>
          At the 2022 Australian Federal Election, your House of
          Representatives ballot would have looked like this.
        </p>
        <form key={`votes-for-${division}`} className="ballot" onChange={setStateFormHandler(setVotes)}>
          <p><b>
            Number the boxes from 1 to {candidates.length} in the order of
            your choice.
          </b></p>
          {
            candidates
              .map(({ id, displayName }) => <fieldset key={`f-${id}`}>
                <input
                  type="number" name={id}
                  min="1" max={candidates.length} step="1"
                />
                <label htmlFor={id}> {displayName}</label>
              </fieldset>)
          }
        </form>
      </section>
      <section className={validBallot ? '' : 'hidden'}>
        <Results {...{ validBallot, candidates, method, elected, events, votes }} />
      </section>
    </main>
  </>;
}

function Results(props) {
  if (!props.validBallot) return null;
  switch (props.method.type) {
    case 'firstPreferences': return FirstPreferences(props);
    case 'twoCandidatePreferred': return TwoCandidatePreferred(props);
    case 'fullCount': return FullCount(props);
    default: return null;
  }
}

function FirstPreferences({
  candidates,
  method: { elected: { id, displayName, preferencesTotal, preferencesPercentage } },
  votes
}) {
  const firstPrefId = +votes.find(([_, vote]) => (+vote) === 1)[0];
  const firstPref = candidates.find(({ id }) => id === firstPrefId);
  const electedPref = votes.find(([candidate, _]) => (+candidate) === id)[1];

  return <>
    <p>
      After the first round of counting, <b>{displayName}</b> had a majority
      of votes and was elected, with {preferencesTotal.toLocaleString()} votes
      ({preferencesPercentage}% of the total vote).
    </p>
    <p>
      You preferenced this candidate at position <b>{electedPref}</b>.
    </p>
    <p>
      Your preferred candidate <b>{firstPref.displayName}</b> was excluded
      after the first round of counting along with all other candidates.
    </p>
  </>;
}

function TwoCandidatePreferred({ candidates, method, elected, votes }) {
  const [first, second] = method.candidates;
  const firstVote = votes.find(([candidate, _]) => (+candidate) === first.id)[1];
  const secondVote = votes.find(([candidate, _]) => (+candidate) === second.id)[1];

  const preferred = firstVote < secondVote ? first : second;
  const preferredVote = firstVote < secondVote ? firstVote : secondVote;
  const other = firstVote < secondVote ? second : first;
  const otherVote = firstVote < secondVote ? secondVote : firstVote;

  const firstPrefId = +votes.find(([_, vote]) => (+vote) === 1)[0];
  const firstPref = candidates.find(({ id }) => id === firstPrefId);
  const firstPrefDifferent = firstPrefId !== first.id && firstPrefId !== second.id;

  return <>
    <p>
      After the first round of counting, only two candidates reached a winnable
      position (there were not enough votes amongst the remaining candidates to
      overtake either of the first two candidates). This simplifies the
      counting process, as for each ballot you need only consider which of
      these two candidates is preferred above the other.
    </p>
    <p>
      The two candidates were <b>{first.displayName}</b> initially with {
      first.preferencesTotal.toLocaleString()} votes ({
      first.preferencesPercentage}% of the total vote) and <b>{
      second.displayName}</b> initially with {
      second.preferencesTotal.toLocaleString()} votes ({
      second.preferencesPercentage}% of the total vote).
    </p>
    {
    firstPrefDifferent ? <p>
      Your preferred candidate <b>{firstPref.displayName}</b> was excluded
      after the first round of counting along with all other candidates.
    </p> : null
    }
    <p>
      You preferenced <b>{preferred.displayName}</b> at position <b>{
      preferredVote}</b> ahead of <b>{other.displayName}</b> at
      position <b>{otherVote}</b>, and so your vote was counted towards <b>{
      preferred.displayName}</b>.
    </p>
    <p>
      After all votes were counted in this way, <b>{elected.displayName
      }</b> was elected with {elected.preferencesTotal.toLocaleString()} votes
      ({elected.preferencesPercentage}% of the total vote).
    </p>
  </>;
}

function FullCount({ candidates, votes, events }) {
  const voteIds = [...votes]
    .sort(([_, p1], [__, p2]) => (+p1) - (+p2));
  const preferences = voteIds.map(
    ([id, _]) => candidates.find(candidate => candidate.id === (+id)));
  let currentPref = 0;
  const excluded = new Set();
  const importantEvents = [
    <li key="initial">
      Your first preference was <b>{preferences[currentPref].displayName}</b>
    </li>
  ];
  for (const event of events) {
    switch (event.type) {
      case 'transfer':
        excluded.add(event.from.id);
        importantEvents.push(<li key={`excl-${event.from.id}`}>
          <b>{event.from.displayName}</b> was excluded and ballots were
          transferred to their next preferred candidate
        </li>)
        if (preferences[currentPref].id === event.from.id) {
          currentPref++;
          while (excluded.has(preferences[currentPref].id)) {
            importantEvents.push(<li key={`skip-${preferences[currentPref].id}`}>
              Your vote skipped over your next preferred candidate, <b>{
              preferences[currentPref].displayName}</b>, who has already been
              excluded
            </li>)
            currentPref++;
          }
          importantEvents.push(<li key={`transfer-${event.from.id}`}>
            Your vote was transferred to your next preferred candidate, <b>{
            preferences[currentPref].displayName}</b>
          </li>)
        }
        break;
      case 'elected':
        importantEvents.push(<li key={`elected-${event.elected.id}`}>
          <b>{event.elected.displayName})</b> was elected with {
            event.elected.preferencesTotal.toLocaleString()} votes ({
            event.elected.preferencesPercentage}% of the total vote)
        </li>);
        break;
      default:
        break;
    }
  }
  return <>
    <p>
      After the first round of counting, there were three or more candidates in
      a winnable position. At the end of each round of counting, the candidate
      with the lowest number of votes is excluded, and each ballot paper is
      transferred to their next preferred candidate. This process is repeated
      until a candidate reaches a majority of votes (above 50%).
    </p>
    <p>
      This is how your vote was counted.
    </p>
    <ol className="events">{importantEvents}</ol>
  </>;
}