#!/usr/bin/env python3
"""Validate shipped Dashboard Studio time inputs before packaging."""
import argparse
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
VIEWS = ROOT / 'packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views'
STANDARD = json.loads((ROOT / 'scripts/dashboard_time_range.json').read_text())


def validate(definition):
    errors = []
    inputs = definition.get('inputs', {})
    time_inputs = {key: value for key, value in inputs.items()
                   if value.get('type') in ('input.simpleTimePicker', 'input.timerange')}
    tokens = {value.get('options', {}).get('token') for value in time_inputs.values()}
    for token in re.findall(r'\$([\w]+)\.(?:earliest|latest|span)\$', json.dumps(definition)):
        if token not in tokens:
            errors.append(f'unbound time token: {token}')
    for key, value in time_inputs.items():
        options = value.get('options', {})
        if not options.get('token'):
            errors.append(f'{key}: missing time token')
        if value['type'] == 'input.timerange':
            # Native Studio dashboards retain their intentional original lookback.
            if len(options.get('defaultValue', '').split(',')) != 2:
                errors.append(f'{key}: native time range requires earliest,latest')
            continue
        if value != STANDARD:
            errors.append(f'{key}: shared time picker must match dashboard_time_range.json')
        layout = definition.get('layout', {})
        if key in layout.get('globalInputs', []):
            errors.append(f'{key}: shared picker belongs in the dashboard header, not globalInputs')
        for name, page in layout.get('layoutDefinitions', {'main': layout}).items():
            placed = [item for item in page.get('structure', []) if item.get('item') == key]
            if len(placed) != 1:
                errors.append(f'{key}/{name}: expected one positioned time picker')
                continue
            p = placed[0].get('position', {})
            width = page.get('options', {}).get('width', 0)
            if p.get('w', 0) < 360 or p.get('h', 0) < 60:
                errors.append(f'{key}/{name}: picker too small for five presets and Advanced')
            if p.get('x', 0) + p.get('w', 0) > width:
                errors.append(f'{key}/{name}: picker outside dashboard width')
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--views', type=Path, default=VIEWS)
    args = parser.parse_args()
    errors = []
    shared = native = dashboards = 0
    for path in sorted(args.views.glob('*.xml')):
        try:
            node = ET.parse(path).find('definition')
            if node is None:
                continue
            definition = json.loads(node.text or '{}')
            dashboards += 1
            for value in definition.get('inputs', {}).values():
                shared += value.get('type') == 'input.simpleTimePicker'
                native += value.get('type') == 'input.timerange'
            errors.extend(f'{path.name}: {error}' for error in validate(definition))
        except (ET.ParseError, ValueError) as error:
            errors.append(f'{path.name}: invalid dashboard definition: {error}')
    if errors:
        print('\n'.join(errors))
        return 1
    print(f'Time-input audit passed: {dashboards} Studio dashboards; {shared} shared pickers, {native} native pickers.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
