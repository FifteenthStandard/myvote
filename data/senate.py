from collections import namedtuple
import csv
import itertools
import json


CandidateTally = namedtuple(
    'CandidateTally', [
        'state', 'vacancies', 'total_papers', 'quota', 'count',
        'position', 'ticket', 'ticket_name',
        'surname', 'givenname', 'name', 'display_name',
        'papers', 'transferred', 'total_votes', 'transfer_value',
        'status', 'changed', 'order', 'comment',
    ]
)

def select_count(candidate): return candidate.count
def select_ticket(candidate): return candidate.ticket
def select_order(candidate): return candidate.order

def display_name(givenname, surname, ticket):
    if givenname == '':
        name = surname
    elif surname == '':
        name = givenname
    else:
        name = f'{surname}, {givenname}'

    return name if ticket == '' else f'{name} ({ticket})'

with open('./senate-tickets.json', 'r') as json_file:
    state_tickets = json.load(json_file)

def ticket_name(state, ticket):
    if ticket == '': return ticket
    return state_tickets[state][ticket]


def convert(input_filenames, output_filename):

    data = [
        convert_state(input_filename)
        for input_filename in input_filenames
    ]

    with open(output_filename, 'w') as json_file:
        json.dump(data, json_file)

def convert_state(input_filename):

    with open(input_filename, 'r') as csv_file:
        reader = csv.reader(csv_file)
        header = next(reader)
        rows = list(reader)

    rows = [
        CandidateTally(
            state, int(vacancies), int(total_papers), int(quota), int(count),
            int(position), ticket.strip(), ticket_name(state, ticket.strip()),
            surname, givenname,
            f'{givenname} {surname}'.strip(), display_name(givenname, surname, ticket_name(state, ticket.strip())),
            int(papers), int(transferred), int(total_votes), float(transfer_value),
            status, changed == 'True', int(order), comment,
         ) for [
            state, vacancies, total_papers, quota, count,
            position, ticket,
            surname, givenname,
            papers, transferred, total_votes, transfer_value,
            status, changed, order, comment,
        ] in rows
    ]

    counts = [
        (count, list(candidates))
        for (count, candidates)
        in itertools.groupby(rows, select_count)
    ]

    state = rows[0].state
    vacancies = rows[0].vacancies
    papers = rows[0].total_papers
    quota = rows[0].quota

    tickets = [
        {
            'id': ticket,
            'ticket': ticket_name(state, ticket),
            'candidates': [
                {
                    'name': candidate.name,
                    'displayName': candidate.display_name,
                    'ticket': candidate.ticket_name,
                    'position': candidate.position,
                } for candidate in candidates
            ]
        } for (ticket, candidates)
        in itertools.groupby(counts[0][1], select_ticket)
        if ticket != ''
    ]

    events = []

    data = {
        'state': state,
        'vacancies': vacancies,
        'papers': papers,
        'quota': quota,
        'tickets': tickets,
        'events': events
    }

    first_row = True

    total_votes = {}
    def count_papers(position, papers=0):
        total = total_votes.get(position, 0) + papers
        total_votes[position] = total
        return total

    for (count, candidates) in counts:
        tickets = [
            (ticket, list(candidates))
            for (ticket, candidates)
            in itertools.groupby(candidates, select_ticket)
        ]

        if not first_row:
            transfer_from = next((
                candidate
                for candidate in candidates
                if candidate.papers < 0
            ), None)
            if transfer_from is not None:
                events.append({
                    'type': 'transfer',
                    'after': count-1,
                    'from': {
                        'name': transfer_from.name,
                        'displayName': transfer_from.display_name,
                        'ticket': transfer_from.ticket_name,
                        'position': transfer_from.position,
                        'papers': count_papers(transfer_from.position),
                    },
                    'transferValue': transfer_from.transfer_value,
                    'votes': [
                        {
                            'id': ticket,
                            'ticket': ticket_name(state, ticket),
                            'candidates': [
                                {
                                    'name': candidate.name,
                                    'displayName': candidate.display_name,
                                    'ticket': candidate.ticket_name,
                                    'position': candidate.position,
                                    'papers': candidate.papers,
                                    'votes': candidate.transferred,
                                    'transferValue': candidate.transfer_value,
                                } for candidate in candidates
                            ]
                        } for (ticket, candidates) in tickets
                    ]
                })

        events.append({
            'type': 'count',
            'count': count,
            'votes': [
                {
                    'ticket': ticket,
                    'candidates': [
                        {
                            'name': candidate.name,
                            'displayName': candidate.display_name,
                            'ticket': candidate.ticket_name,
                            'position': candidate.position,
                            'papers': count_papers(candidate.position, candidate.papers),
                            'votes': candidate.total_votes,
                        } for candidate in candidates
                    ]
                } for (ticket, candidates) in tickets
            ]
        })

        elected = [
            {
                'type': 'elected',
                'name': candidate.name,
                'displayName': candidate.display_name,
                'ticket': candidate.ticket_name,
                'position': candidate.position,
                'order': candidate.order,
                'papers': count_papers(candidate.position),
                'votes': candidate.total_votes,
                'quota': quota,
                'surplus': candidate.total_votes - quota,
                'transferValue': (candidate.total_votes - quota) / count_papers(candidate.position),
                'votes': candidate.total_votes,
            }
            for candidate in sorted(candidates, key=select_order)
            if candidate.changed and candidate.status == 'Elected'
        ]

        events.extend(elected)

        excluded = [
            {
                'type': 'excluded',
                'name': candidate.name,
                'displayName': candidate.display_name,
                'ticket': candidate.ticket_name,
                'position': candidate.position,
                'papers': count_papers(candidate.position),
                'votes': candidate.total_votes,
            }
            for candidate in candidates
            if candidate.changed and candidate.status == 'Excluded'
        ]

        events.extend(excluded)

        first_row = False

    return data

if __name__ == '__main__':
    input_filenames = [
        './SenateStateDOPDownload-27966-ACT.csv',
        './SenateStateDOPDownload-27966-NSW.csv',
        './SenateStateDOPDownload-27966-NT.csv',
        './SenateStateDOPDownload-27966-QLD.csv',
        './SenateStateDOPDownload-27966-SA.csv',
        './SenateStateDOPDownload-27966-TAS.csv',
        './SenateStateDOPDownload-27966-VIC.csv',
        './SenateStateDOPDownload-27966-WA.csv',
    ]
    output_filename = './senate.json'
    convert(input_filenames, output_filename)