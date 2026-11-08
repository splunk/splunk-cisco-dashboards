#!/usr/bin/env python3
"""Read-only, bounded SPL validation against the verified Forge lab.

Uses the existing local CLI session, validates the CA chain and pins the exact
local server certificate on every connection. Never ingests test data, updates
collection, writes Splunk configuration, or restarts services.
"""
import argparse
import hashlib
import http.client
import json
from pathlib import Path
import re
import ssl
import time
import urllib.parse
import xml.etree.ElementTree as ET

from generate_dc_networking_content import SEARCHES, PRODUCTS

LAB_INDEXES = 'index IN (nd,aci,nexus,mds,hyperfabric)'


def ephemeral_fixture(query, rows):
    """Transient in-search fixtures only: never collect/outputlookup/index them."""
    payload = json.dumps({'rows': rows}, separators=(',', ':'))
    prefix = ('| makeresults | eval fixture=' + json.dumps(payload) +
              ' | spath input=fixture path=rows{} output=row | mvexpand row | spath input=row'
              ' | eval _time=tonumber(event_time) | fields - fixture row\n')
    return prefix + query.split('\n', 1)[1]


def check_semantics(client):
    stamp = (int(time.time()) // 900 - 1) * 900 + 100
    nd = dict(sourcetype='cisco:dc:nd:anomalies', nd_account='lab', nd_host='controller-a',
              fabricName='fabric-a', anomalyId='same-id', event_time=stamp, cleared='false',
              expired='false', severity='major', entityName='leaf-a', anomalyType='test')
    rows = [nd, {**nd, 'event_time': stamp + 1, 'cleared': 'true'},
            {**nd, 'nd_host': 'controller-b'},
            {**nd, 'anomalyId': 'acknowledged', 'acknowledged': 'true'},
            {**nd, 'anomalyId': 'unknown-expiry', 'expired': None}]
    results, _ = client.search(ephemeral_fixture(SEARCHES['nd_anomalies']['query'], rows))
    assert sorted(r['SignalId'] for r in results) == ['acknowledged', 'same-id'], results
    queue, _ = client.search(ephemeral_fixture(SEARCHES['attention']['query'], rows))
    assert len(queue) == 2, queue
    trend, _ = client.search(ephemeral_fixture(SEARCHES['nd_active_history']['query'], rows + [rows[2]]))
    assert len(trend) == 1 and float(trend[0]['Metric']) == 2, trend
    cleared, _ = client.search(ephemeral_fixture(SEARCHES['nd_active_history']['query'], [rows[1]]))
    assert len(cleared) == 1 and float(cleared[0]['Metric']) == 0, cleared
    absent, _ = client.search(ephemeral_fixture(SEARCHES['nd_active_history']['query'], [rows[-1]]))
    assert not absent, absent
    hf = dict(sourcetype='cisco:dc:hyperfabric:performance', account='lab', fabric_name='hf-a',
              fabric_id='hf-id', resource_type='node_counter', event_time=stamp)
    results, _ = client.search(ephemeral_fixture(SEARCHES['hf_measurements']['query'], [hf]))
    assert len(results) == 1 and 'unknown' in results[0]['RateEvidence'] and 'PeakInMbps' not in results[0], results
    serials = [dict(sourcetype='cisco:dc:nd:switches', nd_account='lab', nd_host='nd',
                    serialNumber='SERIAL-A', hostname='leaf-a', fabricName='fabric-a', event_time=stamp),
               dict(sourcetype='cisco:dc:aci:health', component='fabricNode', account='apic',
                    apic_host='apic-a', serial='serial-a', name='leaf-a', event_time=stamp),
               dict(sourcetype='cisco:dc:aci:health', component='fabricNode', account='apic',
                    apic_host='apic-a', serial='different-serial', name='leaf-a', event_time=stamp)]
    results, _ = client.search(ephemeral_fixture(SEARCHES['inventory_matches']['query'], serials))
    assert len(results) == 1 and results[0]['Serial'] == 'SERIAL-A', results
    links = [dict(sourcetype='cisco:dc:nd:operational', account='lab', nd_host='nd',
                  fabricName='fabric-a', dataset='topology', topology_kind='link',
                  topology_id='a-b', source_name='leaf-a', source_id='id-a',
                  destination_name='leaf-b', destination_id='id-b', event_time=stamp)]
    for endpoint, expected in [('leaf-a', 1), ('leaf-b', 1), ('unrelated', 0)]:
        scoped = SEARCHES['reported_links']['query'].replace('| eval DCWorkspaceScope=1',
            '| eval DCWorkspaceScope=1\n| where lower(Device)="' + endpoint + '" OR lower(DevicePeer)="' + endpoint + '"')
        results, _ = client.search(ephemeral_fixture(scoped, links))
        assert len(results) == expected, (endpoint, results)
    return dict(status='passed', method='Ephemeral makeresults fixtures; no events indexed',
                checks=['latest cleared state excluded', 'controller collisions remain independent',
                        'acknowledged anomalies retained', 'unknown expiry excluded',
                        'attention queue is populated from explicit active state',
                        'absent rates stay unknown', 'serial matches are case normalized',
                        'matching device names alone do not establish inventory identity',
                        'topology scope matches the local endpoint',
                        'topology scope matches the remote endpoint',
                        'topology scope excludes unrelated devices',
                        'trend deduplicates polls per entity and bucket',
                        'observed cleared state produces a measured zero',
                        'unknown state creates no fabricated zero bucket'])


class LabClient:
    def __init__(self):
        home = Path('/opt/splunk')
        token_file = Path.home() / '.splunk/authToken_AKKHAMIS-M-3QD9_8089'
        self.token = ET.fromstring(token_file.read_text()).findtext('sessionkey')
        if not self.token:
            raise RuntimeError('No local Splunk CLI session is available')
        self.context = ssl.create_default_context(cafile=str(home / 'etc/auth/cacert.pem'))
        # Splunk's stock certificate CN is not localhost. Pin its public DER
        # certificate in addition to CA/date validation, instead of disabling TLS.
        self.context.check_hostname = False
        cert = re.search(r'-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----',
                         (home / 'etc/auth/server.pem').read_text()).group()
        self.pin = hashlib.sha256(ssl.PEM_cert_to_DER_cert(cert)).digest()

    def request(self, method, path, fields=None):
        conn = http.client.HTTPSConnection('127.0.0.1', 8089, context=self.context, timeout=60)
        try:
            conn.connect()
            if hashlib.sha256(conn.sock.getpeercert(binary_form=True)).digest() != self.pin:
                raise RuntimeError('Local Splunk certificate pin mismatch')
            body = urllib.parse.urlencode(fields).encode() if fields else None
            conn.request(method, path, body=body, headers={
                'Authorization': 'Splunk ' + self.token,
                'Content-Type': 'application/x-www-form-urlencoded',
            })
            response = conn.getresponse()
            data = response.read(12 * 1024 * 1024)
            if response.status >= 300:
                raise RuntimeError(f'Splunk HTTP {response.status}: {data.decode()[:800]}')
            return data
        finally:
            conn.close()

    def search(self, query, earliest='-4h', latest='now'):
        query = query.replace('`dc_workspace_indexes`', LAB_INDEXES)
        if not query.lstrip().startswith('|'):
            query = 'search ' + query
        root = '/servicesNS/admin/splunk-cisco-dashboards/search/jobs'
        created = json.loads(self.request('POST', root, {
            'search': query, 'earliest_time': earliest, 'latest_time': latest,
            'output_mode': 'json', 'max_time': '45', 'exec_mode': 'blocking',
            'auto_cancel': '60', 'status_buckets': '0',
        }))
        sid = urllib.parse.quote(created['sid'], safe='')
        path = root + '/' + sid
        try:
            state = json.loads(self.request('GET', path + '?output_mode=json'))['entry'][0]['content']
            if state['dispatchState'] != 'DONE' or state.get('isFailed') or state.get('isFinalized'):
                raise RuntimeError('Search failed or returned partial results: ' + json.dumps({
                    k: state.get(k) for k in ('dispatchState', 'isFailed', 'isFinalized', 'messages')
                }))
            data = json.loads(self.request('GET', path + '/results?output_mode=json&count=1001'))
            messages = state.get('messages', []) + data.get('messages', [])
            failures = [m for m in messages if m.get('type') in ('ERROR', 'FATAL')]
            if failures:
                raise RuntimeError(json.dumps(failures))
            return data.get('results', []), messages
        finally:
            self.request('DELETE', path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    client = LabClient()
    server = json.loads(client.request('GET', '/services/server/info?output_mode=json'))['entry'][0]['content']
    if server.get('serverName') != 'forge':
        raise RuntimeError('Refusing a different Splunk server')
    # Freeze one time interval for comparable read-only checks.
    latest = str(int(time.time()))
    earliest = str(int(latest) - 4 * 3600)
    report = dict(host='AKKHAMIS-M-3QD9', server='forge', target='/opt/splunk',
                  data='Existing lab observations; no customer claims or ingestion',
                  indexes=LAB_INDEXES, earliest=earliest, latest=latest,
                  certificate='CA chain validated; local server certificate pinned per connection', searches={})
    failed = False
    for key, record in SEARCHES.items():
        start = time.monotonic()
        try:
            rows, messages = client.search(record['query'], earliest, latest)
            result = dict(status='passed', rows=len(rows), seconds=round(time.monotonic()-start, 2),
                          columns=list(dict.fromkeys(field for row in rows for field in row)),
                          sample=rows[:2], messages=messages)
            if key == 'coverage':
                assert {r['Product'] for r in rows} == set(PRODUCTS), 'Five-product roster incomplete'
        except Exception as cause:
            failed = True
            result = dict(status='failed', error=str(cause))
        report['searches'][key] = result
        print(f"{key}: {result['status']} ({result.get('rows', '?')} rows)", flush=True)
    # Empty scope is a reference roster with unknown state, never zero health.
    empty = SEARCHES['coverage']['query'].replace('| eval DCWorkspaceScope=1', '| eval DCWorkspaceScope=1\n| where 1=0')
    rows, _ = client.search(empty, earliest, latest)
    assert len(rows) == 5 and all(r['Coverage'].startswith('No observations') and 'AgeMinutes' not in r for r in rows)
    report['empty_scope'] = dict(status='passed', rows=rows)
    report['semantics'] = check_semantics(client)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    if failed:
        raise SystemExit('Live SPL validation failed; inspect evidence before committing')


if __name__ == '__main__':
    main()
