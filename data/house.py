from collections import namedtuple
import csv
import itertools
import json


CandidateTally = namedtuple(
    'CandidateTally', [
        'state', 'division_id', 'division_name', 'count',
        'position', 'candidate',
        'surname', 'givenname', 'name', 'display_name',
        'party_abr', 'party',
        'elected', 'historic_elected', 'calc_type', 'calc_value',
    ]
)

def select_division(candidate): return candidate.division_name
def select_count(candidate): return candidate.count
def select_candidate(candidate): return candidate.candidate

def display_name(givenname, surname, party):
    if givenname == '':
        name = surname
    elif surname == '':
        name = givenname
    else:
        name = f'{surname}, {givenname}'

    return name if party == '' else f'{name} ({party})'

def convert(input_filename, output_filename):

    with open(input_filename, 'r') as csv_file:
        reader = csv.reader(csv_file)
        header = next(reader)
        rows = list(reader)

    rows = [
        CandidateTally(
            state, division_id, division_name, int(count),
            int(position), int(candidate),
            surname, givenname,
            f'{givenname} {surname}'.strip(), display_name(givenname, surname, party),
            party_abr, party,
            elected == 'Y', historic_elected == 'Y', calc_type, float(calc_value),
        ) for [
            state, division_id, division_name, count,
            position, candidate,
            surname, givenname,
            party_abr, party,
            elected, historic_elected, calc_type, calc_value,
        ] in rows
    ]

    divisions = [
        (division, list(candidates))
        for (division, candidates) in itertools.groupby(rows, select_division)
    ]

    def convert_division(division, rows):

        counts = [
            (count, [
                list(calcs)
                for (_, calcs) in itertools.groupby(rows, select_candidate)
            ])
            for (count, rows) in itertools.groupby(rows, select_count)
        ]

        candidates = [
            {
                'id': pref_count.candidate,
                'name': pref_count.name,
                'displayName': pref_count.display_name,
                'party': pref_count.party,
                'position': pref_count.position,
            } for [pref_count, _, _, _] in counts[0][1]
        ]

        elected = sorted([
                {
                    'id': pref_count.candidate,
                    'name': pref_count.name,
                    'displayName': pref_count.display_name,
                    'party': pref_count.party,
                    'position': pref_count.position,
                    'preferencesTotal': int(pref_count.calc_value),
                    'preferencesPercentage': pref_perc.calc_value,
                } for [pref_count, pref_perc, _, _] in counts[-1][1]
            ],
            key=lambda candidate: candidate['preferencesTotal'],
            reverse=True)[0]

        events = []

        first_prefs = sorted([
            {
                'id': pref_count.candidate,
                'name': pref_count.name,
                'displayName': pref_count.display_name,
                'party': pref_count.party,
                'position': pref_count.position,
                'preferencesTotal': int(pref_count.calc_value),
                'preferencesPercentage': pref_perc.calc_value,
            }
            for [pref_count, pref_perc, _, _]
            in counts[0][1]
        ], key=lambda x: x['preferencesTotal'], reverse=True)

        if first_prefs[0]['preferencesPercentage'] > 50.0:
            method = {
                'type': 'firstPreferences',
                'elected': first_prefs[0],
            }
        elif (100.0 - first_prefs[0]['preferencesPercentage'] - first_prefs[1]['preferencesPercentage'] < first_prefs[1]['preferencesPercentage']):
            method = {
                'type': 'twoCandidatePreferred',
                'candidates': first_prefs[0:2],
            }
        else:
            method = {
                'type': 'fullCount',
            }

        data = {
            'division': division,
            'candidates': candidates,
            'elected': elected,
            'method': method,
            'events': events,
        }

        first_row = True

        for (count, candidates) in counts:
            if not first_row:
                excluded = next(
                    {
                        'id': transfer_perc.candidate,
                        'name': transfer_perc.name,
                        'displayName': transfer_perc.display_name,
                        'party': transfer_perc.party,
                        'position': transfer_perc.position,
                    }
                    for [_, _, _, transfer_perc]
                    in candidates
                    if transfer_perc.calc_value == -100.0
                )

                events.append({
                    'type': 'transfer',
                    'from': excluded,
                    'candidates': [
                        {
                            'id': pref_count.candidate,
                            'name': pref_count.name,
                            'displayName': pref_count.display_name,
                            'party': pref_count.party,
                            'position': pref_count.position,
                            'transferredTotal': int(transfer_count.calc_value),
                            'transferredPercentage': transfer_perc.calc_value,
                        }
                        for [pref_count, _, transfer_count, transfer_perc]
                        in candidates
                    ],
                })

            count = {
                'type': 'count',
                'count': count,
                'candidates': [
                    {
                        'id': pref_count.candidate,
                        'name': pref_count.name,
                        'displayName': pref_count.display_name,
                        'party': pref_count.party,
                        'position': pref_count.position,
                        'preferencesTotal': int(pref_count.calc_value),
                        'preferencesPercentage': pref_perc.calc_value,
                    }
                    for [pref_count, pref_perc, _, _]
                    in candidates
                ],
            }

            events.append(count)

            prefs = sorted(count['candidates'], key=lambda x: x['preferencesTotal'], reverse=True)

            if prefs[0]['preferencesPercentage'] > 50.0:
                events.append({
                    'type': 'elected',
                    'elected': prefs[0],
                })
            elif (100.0 - prefs[0]['preferencesPercentage'] - prefs[1]['preferencesPercentage'] < prefs[1]['preferencesPercentage']):
                events.append({
                    'type': 'twoCandidatePreferred',
                    'candidates': prefs[0:2],
                })

            first_row = False

        return data

    data = [
        convert_division(division, list(rows))
        for (division, rows) in itertools.groupby(rows, select_division)
    ]

    with open(output_filename, 'w') as json_file:
        json.dump(data, json_file)


if __name__ == '__main__':
    input_filename = './HouseDopByDivisionDownload-27966.csv'
    output_filename = './house.json'
    convert(input_filename, output_filename)